import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Unsubscribe } from 'firebase/firestore';
import { AuthService } from './auth.service';
import { normalizeMemberSlug } from './auth-helpers';
import {
  UNDO_WINDOW_MS,
  canCancelClaim,
  computeMemberProgressStats,
  getUnlockedDaysCount,
} from './equity';
import { FirebaseCalendarStore } from './firebase-calendar.store';
import { DayClaim, Member } from './models';

export interface PendingUndoBatch {
  claims: DayClaim[];
  startedAt: number;
  secondsLeft: number;
}

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly authService = inject(AuthService);
  private readonly store = inject(FirebaseCalendarStore);

  readonly members = signal<Member[]>([]);
  readonly claims = signal<DayClaim[]>([]);
  readonly pendingUndo = signal<PendingUndoBatch | null>(null);
  readonly syncStatus = signal<'live' | 'offline'>('offline');

  readonly unlockedDaysCount = computed(() => getUnlockedDaysCount(new Date()));
  readonly participants = computed(() => this.members().filter((m) => !m.isSupervisor));
  readonly totalClaimsCount = computed(() => this.claims().length);
  readonly memberStats = computed(() =>
    computeMemberProgressStats(this.members(), this.claims(), this.unlockedDaysCount())
  );

  private unsubscribers: Unsubscribe[] = [];
  private undoTimer: ReturnType<typeof setInterval> | null = null;
  private loadedForUid: string | null | undefined = undefined;

  constructor() {
    effect(() => {
      const user = this.authService.currentMember();
      const nextUid = user?.uid ?? null;
      if (this.loadedForUid === nextUid) {
        return;
      }
      this.loadedForUid = nextUid;
      this.teardownListeners();
      this.dismissPendingUndo();

      if (!user || !this.authService.firebaseConfigured()) {
        this.syncStatus.set('offline');
        return;
      }

      this.attachFirebaseListeners();
    });
  }

  private recordClaimInUndoWindow(claim: DayClaim): void {
    const current = this.pendingUndo();
    if (current) {
      const secondsLeft = Math.max(
        1,
        Math.ceil((UNDO_WINDOW_MS - (Date.now() - current.startedAt)) / 1000)
      );
      this.pendingUndo.set({
        claims: [...current.claims, claim],
        startedAt: current.startedAt,
        secondsLeft,
      });
      return;
    }

    const startedAt = claim.createdAt;
    const initialSeconds = Math.max(1, Math.round(UNDO_WINDOW_MS / 1000));
    this.clearUndoTimer();
    this.pendingUndo.set({ claims: [claim], startedAt, secondsLeft: initialSeconds });

    this.undoTimer = setInterval(() => {
      const active = this.pendingUndo();
      if (!active) {
        this.clearUndoTimer();
        return;
      }
      const secondsLeft = Math.max(
        0,
        Math.ceil((UNDO_WINDOW_MS - (Date.now() - active.startedAt)) / 1000)
      );
      if (secondsLeft <= 0) {
        this.dismissPendingUndo();
      } else {
        this.pendingUndo.set({ ...active, secondsLeft });
      }
    }, 1000);
  }

  private clearUndoTimer(): void {
    if (this.undoTimer) {
      clearInterval(this.undoTimer);
      this.undoTimer = null;
    }
  }

  dismissPendingUndo(): void {
    this.clearUndoTimer();
    this.pendingUndo.set(null);
  }

  async undoPendingClaims(): Promise<number> {
    const pending = this.pendingUndo();
    if (!pending || pending.claims.length === 0) return 0;

    const member = this.authService.currentMember();
    if (!member) {
      throw new Error('Connexion requise.');
    }

    const cancellable = pending.claims.filter((c) => canCancelClaim(c, member));
    if (cancellable.length === 0) {
      this.dismissPendingUndo();
      throw new Error('Délai de 30 secondes dépassé : ces prises sont définitivement confirmées.');
    }

    await this.store.deleteClaimsBatch(cancellable.map((c) => c.id));
    this.dismissPendingUndo();
    return cancellable.length;
  }

  private teardownListeners(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }

  private attachFirebaseListeners(): void {
    const membersUnsub = this.store.subscribeMembers(
      (list) => {
        this.members.set(list);
        const current = this.authService.currentMember();
        if (current) {
          const fresh = list.find((m) => m.uid === current.uid);
          if (fresh) {
            this.authService.currentMember.set(fresh);
          }
        }
        this.syncStatus.set('live');
      },
      () => this.syncStatus.set('offline')
    );

    const claimsUnsub = this.store.subscribeClaims(
      (loaded) => {
        this.claims.set(loaded);
        this.syncStatus.set('live');
      },
      () => this.syncStatus.set('offline')
    );

    this.unsubscribers.push(membersUnsub, claimsUnsub);
  }

  async claimDay(dayNumber: number): Promise<DayClaim> {
    const member = this.authService.currentMember();
    if (!member) {
      throw new Error('Connexion requise.');
    }
    if (member.isSupervisor) {
      throw new Error('Compte superviseur : lecture seule.');
    }

    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 24) {
      throw new Error('Case invalide.');
    }

    if (dayNumber > this.unlockedDaysCount()) {
      throw new Error(`Cette case sera disponible le ${dayNumber} décembre.`);
    }

    const alreadyClaimed = this.claims().some(
      (c) => c.memberUid === member.uid && c.dayNumber === dayNumber
    );
    if (alreadyClaimed) {
      throw new Error(`Tu as déjà réclamé la case ${dayNumber}.`);
    }

    const payload: Omit<DayClaim, 'id'> = {
      memberUid: member.uid,
      memberName: member.name,
      dayNumber,
      createdAt: Date.now(),
    };

    const created = await this.store.createClaim(payload);
    this.recordClaimInUndoWindow(created);
    return created;
  }

  async cancelClaim(claim: DayClaim): Promise<void> {
    const member = this.authService.currentMember();
    if (!member) {
      throw new Error('Connexion requise.');
    }
    if (claim.memberUid !== member.uid) {
      throw new Error('Tu peux uniquement annuler tes propres prises.');
    }
    if (!canCancelClaim(claim, member)) {
      throw new Error('Délai de 30 secondes dépassé : cette prise est définitivement confirmée.');
    }

    await this.store.deleteClaim(claim.id);

    const pending = this.pendingUndo();
    if (pending && pending.claims.some((c) => c.id === claim.id)) {
      const remaining = pending.claims.filter((c) => c.id !== claim.id);
      if (remaining.length === 0) {
        this.dismissPendingUndo();
      } else {
        this.pendingUndo.set({ ...pending, claims: remaining });
      }
    }
  }

  async updateMemberProfile(
    uid: string,
    patch: { name?: string; emoji?: string; color?: string }
  ): Promise<void> {
    const cleanName = patch.name?.trim().slice(0, 24);
    const updates: Partial<Member> = {};
    if (cleanName) {
      updates.name = cleanName;
      updates.slug = normalizeMemberSlug(cleanName);
    }
    if (patch.emoji) {
      updates.emoji = patch.emoji;
    }
    if (patch.color) {
      updates.color = patch.color;
    }

    await this.store.updateMember(uid, updates);
  }
}
