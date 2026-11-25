import { Injectable } from '@angular/core';
import {
  Unsubscribe,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { isSupervisorRecord } from './auth-helpers';
import { ensureAnonymousAuth, getFirebaseClients } from './firebase';
import { DayClaim, Member } from './models';

@Injectable({ providedIn: 'root' })
export class FirebaseCalendarStore {
  subscribeMembers(
    onData: (members: Member[]) => void,
    onError: () => void
  ): Unsubscribe {
    let active = true;
    let unsub: Unsubscribe | null = null;

    void ensureAnonymousAuth()
      .then(() => {
        if (!active) return;
        const { db } = getFirebaseClients();
        unsub = onSnapshot(
          collection(db, 'members'),
          (snap) => {
            const list = snap.docs
              .map((d) => {
                const raw = d.data() as Partial<Member> & { isSupervisor?: unknown; role?: unknown };
                return {
                  uid: d.id,
                  name: raw.name ?? 'Membre',
                  slug: raw.slug ?? '',
                  emoji: raw.emoji ?? '🎄',
                  color: raw.color ?? '#8B2635',
                  isAdmin: Boolean(raw.isAdmin),
                  isSupervisor: isSupervisorRecord(raw),
                  hasDefaultPin: raw.hasDefaultPin !== false,
                };
              })
              .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            onData(list);
          },
          (err) => {
            console.error('Erreur Firestore members :', err);
            onError();
          }
        );
      })
      .catch((err) => {
        console.error('Erreur Auth anonyme members :', err);
        onError();
      });

    return () => {
      active = false;
      unsub?.();
    };
  }

  subscribeClaims(
    onData: (claims: DayClaim[]) => void,
    onError: () => void
  ): Unsubscribe {
    let active = true;
    let unsub: Unsubscribe | null = null;

    void ensureAnonymousAuth()
      .then(() => {
        if (!active) return;
        const { db } = getFirebaseClients();
        unsub = onSnapshot(
          query(collection(db, 'claims'), orderBy('createdAt', 'desc')),
          (snap) => {
            const loaded = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<DayClaim, 'id'>),
            }));
            onData(loaded);
          },
          onError
        );
      })
      .catch(onError);

    return () => {
      active = false;
      unsub?.();
    };
  }

  async createClaim(payload: Omit<DayClaim, 'id'>): Promise<DayClaim> {
    const { db } = getFirebaseClients();
    const docRef = await addDoc(collection(db, 'claims'), payload);
    return { id: docRef.id, ...payload };
  }

  async deleteClaim(claimId: string): Promise<void> {
    const { db } = getFirebaseClients();
    await deleteDoc(doc(db, 'claims', claimId));
  }

  async deleteClaimsBatch(claimIds: string[]): Promise<void> {
    const { db } = getFirebaseClients();
    const batch = writeBatch(db);
    for (const id of claimIds) {
      batch.delete(doc(db, 'claims', id));
    }
    await batch.commit();
  }

  async updateMember(uid: string, updates: Partial<Member>): Promise<void> {
    const { db } = getFirebaseClients();
    await updateDoc(doc(db, 'members', uid), updates);
  }
}
