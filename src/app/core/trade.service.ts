import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  Unsubscribe,
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import { ensureAnonymousAuth, getFirebaseClients } from './firebase';
import { TradeOffer } from './models';
import { PushNotificationService } from './push-notification.service';

export function isOpenRequestedChocolate(requestedChocolate?: string): boolean {
  const normalized = (requestedChocolate ?? '').trim().toLowerCase();
  return !normalized || normalized === 'peu importe' || normalized === 'à décider ensemble';
}

export function formatTradeMessage(
  authorName: string,
  offeredChocolate: string,
  requestedChocolate: string,
  targetName?: string
): string {
  const offered = offeredChocolate.trim();
  const requested = requestedChocolate.trim();
  const targetPrefix = targetName?.trim() ? `à ${targetName.trim()} ` : '';
  if (isOpenRequestedChocolate(requested)) {
    return `${authorName} propose ${targetPrefix}d’échanger son ${offered} (à décider ensemble)`;
  }
  return `${authorName} propose ${targetPrefix}d’échanger son ${offered} contre un ${requested}`;
}

@Injectable({ providedIn: 'root' })
export class TradeService {
  private readonly authService = inject(AuthService);
  private readonly pushService = inject(PushNotificationService);

  readonly trades = signal<TradeOffer[]>([]);
  readonly tradesLoaded = signal(false);
  readonly openTrades = computed(() => this.trades().filter((t) => t.status === 'open'));

  private unsubscribe: Unsubscribe | null = null;
  private loadedForUid: string | null | undefined = undefined;

  constructor() {
    effect(() => {
      const user = this.authService.currentMember();
      const nextUid = user?.uid ?? null;
      if (this.loadedForUid === nextUid) {
        return;
      }
      this.loadedForUid = nextUid;
      this.teardown();

      if (!user || !this.authService.firebaseConfigured()) {
        this.trades.set([]);
        this.tradesLoaded.set(true);
        return;
      }

      this.tradesLoaded.set(false);
      let active = true;
      void ensureAnonymousAuth()
        .then(() => {
          if (!active) return;
          const { db } = getFirebaseClients();
          this.unsubscribe = onSnapshot(
            query(collection(db, 'trades'), orderBy('createdAt', 'desc')),
            (snap) => {
              const list = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<TradeOffer, 'id'>),
              }));
              this.trades.set(list);
              this.tradesLoaded.set(true);
            },
            (err) => {
              console.error('Erreur Firestore trades :', err);
              this.tradesLoaded.set(true);
            }
          );
        })
        .catch((err) => console.error('Erreur Auth anonyme trades :', err));

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

  async proposeTrade(
    offeredChocolate: string,
    requestedChocolate: string,
    target?: { uid: string; name: string } | null
  ): Promise<TradeOffer> {
    const member = this.authService.currentMember();
    if (!member) {
      throw new Error('Connexion requise.');
    }

    const offered = offeredChocolate.trim();
    if (!offered) {
      throw new Error('Choisis le chocolat que tu proposes.');
    }
    const requested = target?.uid
      ? requestedChocolate.trim() || 'À décider ensemble'
      : 'À décider ensemble';
    if (!isOpenRequestedChocolate(requested) && offered.toLowerCase() === requested.toLowerCase()) {
      throw new Error('Impossible d’échanger un chocolat contre le même chocolat.');
    }
    const message = formatTradeMessage(member.name, offered, requested, target?.name);

    const payload: Omit<TradeOffer, 'id'> = {
      authorUid: member.uid,
      authorName: member.name,
      ...(target?.uid ? { targetUid: target.uid, targetName: target.name } : {}),
      offeredChocolate: offered,
      requestedChocolate: requested,
      message,
      status: 'open',
      createdAt: Date.now(),
    };

    const { db } = getFirebaseClients();
    const ref = await addDoc(collection(db, 'trades'), payload);
    const created: TradeOffer = { id: ref.id, ...payload };

    void this.pushService.notifyTradeEvent('proposed', {
      authorUid: member.uid,
      authorName: member.name,
      targetUid: target?.uid,
      targetName: target?.name,
      message,
    });

    return created;
  }

  async acceptTrade(trade: TradeOffer, chosenReturnChocolate?: string): Promise<void> {
    const member = this.authService.currentMember();
    if (!member) {
      throw new Error('Connexion requise.');
    }
    if (trade.status !== 'open') {
      throw new Error('Cet échange n’est plus disponible.');
    }
    if (trade.authorUid === member.uid) {
      throw new Error('Tu ne peux pas accepter ton propre échange.');
    }
    if (trade.targetUid && trade.targetUid !== member.uid) {
      throw new Error(`Cet échange est réservé à ${trade.targetName}.`);
    }

    const finalRequested = isOpenRequestedChocolate(trade.requestedChocolate)
      ? (chosenReturnChocolate ?? '').trim()
      : trade.requestedChocolate.trim();
    if (!finalRequested) {
      throw new Error('Choisis le chocolat que tu donnes en échange.');
    }
    if (finalRequested.toLowerCase() === trade.offeredChocolate.trim().toLowerCase()) {
      throw new Error('Impossible d’échanger un chocolat contre le même chocolat.');
    }

    const updatedMessage = `${trade.authorName} échange son ${trade.offeredChocolate} contre le ${finalRequested} de ${member.name}`;

    const { db } = getFirebaseClients();
    await updateDoc(doc(db, 'trades', trade.id), {
      status: 'accepted',
      requestedChocolate: finalRequested,
      message: updatedMessage,
      acceptedByUid: member.uid,
      acceptedByName: member.name,
      acceptedAt: Date.now(),
    });

    void this.pushService.notifyTradeEvent('accepted', {
      authorUid: trade.authorUid,
      authorName: trade.authorName,
      acceptedByUid: member.uid,
      acceptedByName: member.name,
      message: `${member.name} a accepté l'échange de ${trade.authorName} (${trade.offeredChocolate} ↔ ${finalRequested})`,
    });
  }

  async counterProposeTrade(trade: TradeOffer, newOfferedChocolate: string): Promise<TradeOffer> {
    const member = this.authService.currentMember();
    if (!member) {
      throw new Error('Connexion requise.');
    }
    if (trade.status !== 'open') {
      throw new Error('Cet échange n’est plus disponible.');
    }
    if (trade.authorUid === member.uid) {
      throw new Error('Tu ne peux pas contre-proposer ton propre échange.');
    }
    if (trade.targetUid && trade.targetUid !== member.uid) {
      throw new Error(`Cet échange est réservé à ${trade.targetName}.`);
    }
    const offered = newOfferedChocolate.trim();
    if (!offered) {
      throw new Error('Choisis le chocolat que tu proposes en échange.');
    }
    if (offered.toLowerCase() === trade.offeredChocolate.trim().toLowerCase()) {
      throw new Error('Impossible de contre-proposer le même chocolat.');
    }

    const { db } = getFirebaseClients();
    await updateDoc(doc(db, 'trades', trade.id), {
      status: 'cancelled',
    });

    return this.proposeTrade(offered, trade.offeredChocolate, {
      uid: trade.authorUid,
      name: trade.authorName,
    });
  }

  async cancelTrade(trade: TradeOffer): Promise<void> {
    const member = this.authService.currentMember();
    if (!member) {
      throw new Error('Connexion requise.');
    }
    if (trade.authorUid !== member.uid || trade.status !== 'open') {
      throw new Error('Impossible d’annuler cet échange.');
    }

    const { db } = getFirebaseClients();
    await updateDoc(doc(db, 'trades', trade.id), {
      status: 'cancelled',
    });
  }
}
