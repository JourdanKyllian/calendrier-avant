import { Injectable, signal } from '@angular/core';
import { collection, deleteField, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import {
  DEFAULT_PIN,
  hashPinLocal,
  isSupervisorRecord,
  isValidPin,
  normalizeMemberSlug,
} from './auth-helpers';
import { ensureAnonymousAuth, getFirebaseClients, isFirebaseConfigured } from './firebase';
import { MEMBER_COLORS, MEMBER_EMOJIS, Member } from './models';

const SESSION_UID_KEY = 'chocoavent_member_uid_v1';
const SESSION_MEMBER_CACHE_KEY = 'chocoavent_member_cache_v2';
const MEMBERS_WARMUP_TTL_MS = 30_000;

interface CachedMemberDoc {
  id: string;
  data: FirestoreMemberRecord;
  index: number;
}

interface FirestoreMemberRecord {
  name?: string;
  slug?: string;
  emoji?: string;
  color?: string;
  pin?: string | number;
  pinHash?: string;
  hasDefaultPin?: boolean;
  isSupervisor?: boolean | string;
  role?: string;
}

function matchesPin(record: FirestoreMemberRecord, enteredPin: string): boolean {
  if (record.pinHash) {
    return record.pinHash === hashPinLocal(enteredPin);
  }
  if (record.pin !== undefined && record.pin !== null) {
    return String(record.pin).trim() === enteredPin;
  }
  return enteredPin === DEFAULT_PIN;
}

function toMemberModel(uid: string, data: FirestoreMemberRecord, index = 0): Member {
  const rawName = (data.name ?? 'Membre').trim();
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const hasDefault =
    data.hasDefaultPin !== undefined
      ? Boolean(data.hasDefaultPin)
      : data.pinHash
        ? data.pinHash === hashPinLocal(DEFAULT_PIN)
        : String(data.pin ?? DEFAULT_PIN).trim() === DEFAULT_PIN;

  const isSupervisor = isSupervisorRecord(data);

  return {
    uid,
    name: displayName,
    slug: data.slug || normalizeMemberSlug(displayName),
    emoji: data.emoji || MEMBER_EMOJIS[index % MEMBER_EMOJIS.length],
    color: data.color || MEMBER_COLORS[index % MEMBER_COLORS.length],
    isAdmin: false,
    isSupervisor,
    hasDefaultPin: hasDefault,
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentMember = signal<Member | null>(null);
  readonly authReady = signal<boolean>(false);
  readonly firebaseConfigured = signal<boolean>(isFirebaseConfigured());

  private readyResolvers: Array<() => void> = [];
  private prefetchedMembers: CachedMemberDoc[] | null = null;
  private prefetchedAt = 0;
  private inflightMembersFetch: Promise<CachedMemberDoc[]> | null = null;

  constructor() {
    this.restoreSession();
  }

  private writeSessionCache(member: Member | null): void {
    if (!member) {
      localStorage.removeItem(SESSION_UID_KEY);
      localStorage.removeItem(SESSION_MEMBER_CACHE_KEY);
      return;
    }
    localStorage.setItem(SESSION_UID_KEY, member.uid);
    try {
      localStorage.setItem(SESSION_MEMBER_CACHE_KEY, JSON.stringify(member));
    } catch {
      // Ignore storage quota issues.
    }
  }

  private readSessionCache(expectedUid: string): Member | null {
    try {
      const raw = localStorage.getItem(SESSION_MEMBER_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Member;
      return parsed && parsed.uid === expectedUid ? parsed : null;
    } catch {
      return null;
    }
  }

  private async fetchMembersList(forceRefresh: boolean): Promise<CachedMemberDoc[]> {
    const isFresh =
      !forceRefresh &&
      this.prefetchedMembers !== null &&
      Date.now() - this.prefetchedAt < MEMBERS_WARMUP_TTL_MS;
    if (isFresh && this.prefetchedMembers) {
      return this.prefetchedMembers;
    }

    if (!forceRefresh && this.inflightMembersFetch) {
      return this.inflightMembersFetch;
    }

    const { db } = getFirebaseClients();
    const request = ensureAnonymousAuth()
      .then(() => getDocs(collection(db, 'members')))
      .then((snap) => {
        const list = snap.docs.map((d, idx) => ({
          id: d.id,
          data: d.data() as FirestoreMemberRecord,
          index: idx,
        }));
        this.prefetchedMembers = list;
        this.prefetchedAt = Date.now();
        return list;
      })
      .finally(() => {
        if (this.inflightMembersFetch === request) {
          this.inflightMembersFetch = null;
        }
      });

    this.inflightMembersFetch = request;
    return request;
  }

  warmupMembersCache(): void {
    if (!this.firebaseConfigured()) return;
    void this.fetchMembersList(false).catch(() => {});
  }

  waitUntilReady(): Promise<void> {
    if (this.authReady()) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.readyResolvers.push(resolve);
    });
  }

  private markReady(): void {
    if (!this.authReady()) {
      this.authReady.set(true);
      const pending = this.readyResolvers.splice(0);
      for (const resolve of pending) {
        resolve();
      }
    }
  }

  private async restoreSession(): Promise<void> {
    try {
      if (!this.firebaseConfigured()) {
        this.currentMember.set(null);
        return;
      }
      const savedUid = localStorage.getItem(SESSION_UID_KEY);
      if (!savedUid) {
        this.currentMember.set(null);
        return;
      }

      const cached = this.readSessionCache(savedUid);
      if (cached) {
        this.currentMember.set(cached);
        this.markReady();
        void this.refreshSessionInBackground(savedUid);
        return;
      }

      await this.refreshSessionInBackground(savedUid);
    } catch (err) {
      console.error('Impossible de restaurer la session :', err);
      this.currentMember.set(null);
    } finally {
      this.markReady();
    }
  }

  private async refreshSessionInBackground(savedUid: string): Promise<void> {
    try {
      await ensureAnonymousAuth();
      const { db } = getFirebaseClients();
      const snap = await getDoc(doc(db, 'members', savedUid));
      if (!snap.exists()) {
        this.writeSessionCache(null);
        this.currentMember.set(null);
        return;
      }
      const fresh = toMemberModel(snap.id, snap.data() as FirestoreMemberRecord);
      this.writeSessionCache(fresh);
      this.currentMember.set(fresh);
    } catch (err) {
      console.error('Impossible de rafraîchir la session :', err);
      if (!this.currentMember()) {
        this.currentMember.set(null);
      }
    }
  }

  private findMemberBySlugAndPin(
    list: CachedMemberDoc[],
    targetSlug: string,
    pin: string
  ): CachedMemberDoc | null {
    const matched = list.find((entry) => {
      const docSlug = entry.data.slug || normalizeMemberSlug(entry.data.name || '');
      return docSlug === targetSlug;
    });
    if (!matched || !matchesPin(matched.data, pin)) {
      return null;
    }
    return matched;
  }

  async login(name: string, pin: string): Promise<void> {
    if (!this.firebaseConfigured()) {
      throw new Error('Firebase n’est pas encore configuré dans environment.ts.');
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Entre ton nom ou prénom pour te connecter.');
    }
    if (!isValidPin(pin)) {
      throw new Error('Le code PIN doit contenir exactement 4 chiffres.');
    }

    const targetSlug = normalizeMemberSlug(trimmedName);
    const hadWarmCache =
      this.prefetchedMembers !== null &&
      Date.now() - this.prefetchedAt < MEMBERS_WARMUP_TTL_MS;

    const firstList = await this.fetchMembersList(false);
    let found = this.findMemberBySlugAndPin(firstList, targetSlug, pin);

    if (!found && hadWarmCache) {
      const freshList = await this.fetchMembersList(true);
      found = this.findMemberBySlugAndPin(freshList, targetSlug, pin);
    }

    if (!found) {
      throw new Error('Nom ou code PIN incorrect.');
    }

    const member = toMemberModel(found.id, found.data, found.index);

    // Populate optional display defaults and migrate plain initial `pin` to `pinHash` in background
    const missingPatch: Record<string, unknown> = {};
    if (!found.data.slug) missingPatch['slug'] = member.slug;
    if (!found.data.emoji) missingPatch['emoji'] = member.emoji;
    if (!found.data.color) missingPatch['color'] = member.color;
    if (found.data.hasDefaultPin === undefined) missingPatch['hasDefaultPin'] = member.hasDefaultPin;
    if (!found.data.pinHash) {
      missingPatch['pinHash'] = hashPinLocal(pin);
      missingPatch['pin'] = deleteField();
    }

    this.writeSessionCache(member);
    this.currentMember.set(member);

    if (Object.keys(missingPatch).length > 0) {
      this.prefetchedMembers = null;
      const { db } = getFirebaseClients();
      void updateDoc(doc(db, 'members', found.id), missingPatch).catch((err) =>
        console.warn('Mise à jour différée du profil membre échouée :', err)
      );
    }
  }

  /**
   * Changes the user's 4-digit PIN directly in Firestore (hashed via SHA-256)
   * without disconnecting the user.
   */
  async changePin(currentPin: string, newPin: string): Promise<void> {
    if (!isValidPin(currentPin) || !isValidPin(newPin)) {
      throw new Error('Les codes PIN doivent contenir exactement 4 chiffres.');
    }
    const active = this.currentMember();
    if (!active) {
      throw new Error('Tu dois être connecté pour changer ton code PIN.');
    }

    await ensureAnonymousAuth();
    const { db } = getFirebaseClients();
    const memberRef = doc(db, 'members', active.uid);
    const snap = await getDoc(memberRef);
    if (!snap.exists()) {
      throw new Error('Profil introuvable dans la base.');
    }

    const data = snap.data() as FirestoreMemberRecord;
    if (!matchesPin(data, currentPin)) {
      throw new Error('Le code PIN actuel est incorrect.');
    }

    const hasDefaultPin = newPin === DEFAULT_PIN;
    await updateDoc(memberRef, {
      pinHash: hashPinLocal(newPin),
      pin: deleteField(),
      hasDefaultPin,
    });

    this.prefetchedMembers = null;
    this.currentMember.update((m) => {
      const updated = m ? { ...m, hasDefaultPin } : m;
      this.writeSessionCache(updated);
      return updated;
    });
  }

  async logout(): Promise<void> {
    this.prefetchedMembers = null;
    this.writeSessionCache(null);
    this.currentMember.set(null);
  }
}
