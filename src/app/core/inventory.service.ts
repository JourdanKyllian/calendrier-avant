import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  Unsubscribe,
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import { CalendarConfigService } from './calendar-config.service';
import { CalendarService } from './calendar.service';
import { ensureAnonymousAuth, getFirebaseClients } from './firebase';
import { ChocolateConsumption, ChocolateStockEntry } from './models';
import { TradeService } from './trade.service';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly authService = inject(AuthService);
  private readonly calendarService = inject(CalendarService);
  private readonly configService = inject(CalendarConfigService);
  private readonly tradeService = inject(TradeService);

  readonly consumptions = signal<ChocolateConsumption[]>([]);
  readonly consumptionsLoaded = signal(false);

  private unsubscribe: Unsubscribe | null = null;
  private loadedForUid: string | null | undefined = undefined;

  readonly stockByMemberUid = computed<Record<string, ChocolateStockEntry[]>>(() => {
    const participants = this.calendarService.participants();
    const claims = this.calendarService.claims();
    const dayConfigs = this.configService.dayConfigsMap();
    const trades = this.tradeService.trades().filter((t) => t.status === 'accepted');
    const eaten = this.consumptions();

    const buckets: Record<string, Map<string, { label: string; qty: number }>> = {};
    for (const p of participants) {
      buckets[p.uid] = new Map();
    }

    const addQty = (uid: string, chocoName: string, delta: number) => {
      const map = buckets[uid];
      if (!map) return;
      const key = chocoName.trim().toLowerCase();
      if (!key) return;
      const prev = map.get(key);
      map.set(key, {
        label: prev?.label ?? chocoName.trim(),
        qty: (prev?.qty ?? 0) + delta,
      });
    };

    for (const claim of claims) {
      const cfg = dayConfigs[claim.dayNumber];
      if (cfg) {
        addQty(claim.memberUid, cfg.chocolateName, cfg.quantityPerPerson);
      }
    }

    for (const trade of trades) {
      addQty(trade.authorUid, trade.offeredChocolate, -1);
      if (
        trade.requestedChocolate &&
        trade.requestedChocolate.toLowerCase() !== 'peu importe' &&
        trade.requestedChocolate.toLowerCase() !== 'à décider ensemble'
      ) {
        addQty(trade.authorUid, trade.requestedChocolate, 1);
      }
      if (trade.acceptedByUid) {
        addQty(trade.acceptedByUid, trade.offeredChocolate, 1);
        if (
          trade.requestedChocolate &&
          trade.requestedChocolate.toLowerCase() !== 'peu importe' &&
          trade.requestedChocolate.toLowerCase() !== 'à décider ensemble'
        ) {
          addQty(trade.acceptedByUid, trade.requestedChocolate, -1);
        }
      }
    }

    for (const c of eaten) {
      addQty(c.memberUid, c.chocolateName, -c.quantity);
    }

    const result: Record<string, ChocolateStockEntry[]> = {};
    for (const p of participants) {
      result[p.uid] = Array.from(buckets[p.uid].values())
        .filter((entry) => entry.qty > 0)
        .map((entry) => ({ chocolateName: entry.label, quantity: entry.qty }))
        .sort((a, b) => a.chocolateName.localeCompare(b.chocolateName, 'fr'));
    }
    return result;
  });

  readonly supervisorSurplus = computed<ChocolateStockEntry[]>(() => {
    const supervisors = new Set(
      this.calendarService
        .members()
        .filter((m) => m.isSupervisor)
        .map((m) => m.uid)
    );
    const catalog = this.configService.chocolates();
    const participantsCount = Math.max(1, this.calendarService.participants().length);
    const dayConfigs = Object.values(this.configService.dayConfigsMap());
    const trades = this.tradeService.trades().filter((t) => t.status === 'accepted');

    const map = new Map<string, { label: string; qty: number }>();
    const addQty = (name: string, delta: number) => {
      const key = name.trim().toLowerCase();
      if (!key) return;
      const prev = map.get(key);
      map.set(key, { label: prev?.label ?? name.trim(), qty: (prev?.qty ?? 0) + delta });
    };

    for (const item of catalog) {
      if (item.totalCount > 0) {
        addQty(item.name, item.totalCount);
      }
    }

    for (const cfg of dayConfigs) {
      addQty(cfg.chocolateName, -(cfg.quantityPerPerson * participantsCount));
    }

    for (const trade of trades) {
      if (supervisors.has(trade.authorUid)) {
        addQty(trade.offeredChocolate, -1);
        if (
          trade.requestedChocolate &&
          trade.requestedChocolate.toLowerCase() !== 'peu importe' &&
          trade.requestedChocolate.toLowerCase() !== 'à décider ensemble'
        ) {
          addQty(trade.requestedChocolate, 1);
        }
      }
      if (trade.acceptedByUid && supervisors.has(trade.acceptedByUid)) {
        addQty(trade.offeredChocolate, 1);
        if (
          trade.requestedChocolate &&
          trade.requestedChocolate.toLowerCase() !== 'peu importe' &&
          trade.requestedChocolate.toLowerCase() !== 'à décider ensemble'
        ) {
          addQty(trade.requestedChocolate, -1);
        }
      }
    }

    for (const c of this.consumptions()) {
      if (supervisors.has(c.memberUid)) {
        addQty(c.chocolateName, -c.quantity);
      }
    }

    return Array.from(map.values())
      .filter((entry) => entry.qty > 0)
      .map((entry) => ({ chocolateName: entry.label, quantity: entry.qty }))
      .sort((a, b) => a.chocolateName.localeCompare(b.chocolateName, 'fr'));
  });

  readonly openTradeReservationsByUid = computed<Record<string, Record<string, number>>>(() => {
    const reserved: Record<string, Record<string, number>> = {};
    for (const trade of this.tradeService.openTrades()) {
      const key = trade.offeredChocolate.trim().toLowerCase();
      if (!key) continue;
      reserved[trade.authorUid] ??= {};
      reserved[trade.authorUid][key] = (reserved[trade.authorUid][key] ?? 0) + 1;
    }
    return reserved;
  });

  getAvailableTradeStock(memberUid: string): ChocolateStockEntry[] {
    const member = this.calendarService.members().find((m) => m.uid === memberUid);
    const baseStock = member?.isSupervisor
      ? this.supervisorSurplus()
      : (this.stockByMemberUid()[memberUid] ?? []);
    const reserved = this.openTradeReservationsByUid()[memberUid] ?? {};

    return baseStock
      .map((entry) => {
        const used = reserved[entry.chocolateName.trim().toLowerCase()] ?? 0;
        return {
          chocolateName: entry.chocolateName,
          quantity: entry.quantity - used,
        };
      })
      .filter((entry) => entry.quantity > 0);
  }

  constructor() {
    effect(() => {
      const user = this.authService.currentMember();
      const nextUid = user?.uid ?? null;
      if (this.loadedForUid === nextUid) return;
      this.loadedForUid = nextUid;
      this.teardown();

      if (!user || !this.authService.firebaseConfigured()) {
        this.consumptions.set([]);
        this.consumptionsLoaded.set(true);
        return;
      }

      this.consumptionsLoaded.set(false);
      let active = true;
      void ensureAnonymousAuth()
        .then(() => {
          if (!active) return;
          const { db } = getFirebaseClients();
          this.unsubscribe = onSnapshot(
            query(collection(db, 'consumptions'), orderBy('createdAt', 'desc')),
            (snap) => {
              const list = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<ChocolateConsumption, 'id'>),
              }));
              this.consumptions.set(list);
              this.consumptionsLoaded.set(true);
            },
            (err) => {
              console.error('Erreur Firestore consumptions :', err);
              this.consumptionsLoaded.set(true);
            }
          );
        })
        .catch((err) => console.error('Erreur Auth anonyme consumptions :', err));

      this.unsubscribe = () => {
        active = false;
      };
    });
  }

  private teardown(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  getMemberStock(uid: string): ChocolateStockEntry[] {
    return this.stockByMemberUid()[uid] ?? [];
  }

  async markEaten(
    chocolateName: string,
    quantity = 1,
    options?: {
      sourceMemberUid?: string;
      recipient?: { uid: string; name: string } | null;
    }
  ): Promise<void> {
    const member = this.authService.currentMember();
    if (!member) {
      throw new Error('Connexion requise.');
    }

    const targetSourceUid = options?.sourceMemberUid?.trim() || member.uid;
    if (member.isSupervisor && !options?.sourceMemberUid) {
      throw new Error('Sélectionne le stock ou le membre concerné.');
    }
    if (!member.isSupervisor && targetSourceUid !== member.uid) {
      throw new Error('Action réservée au superviseur.');
    }

    await ensureAnonymousAuth();
    const { db } = getFirebaseClients();
    await addDoc(collection(db, 'consumptions'), {
      memberUid: targetSourceUid,
      chocolateName: chocolateName.trim(),
      quantity,
      createdAt: Date.now(),
      ...(options?.recipient?.uid
        ? {
            recipientUid: options.recipient.uid,
            recipientName: options.recipient.name,
          }
        : {}),
    });
  }
}
