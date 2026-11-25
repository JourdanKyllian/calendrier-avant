import { Injectable, computed, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ensureAnonymousAuth, getFirebaseClients } from './firebase';

const PUSH_SUB_ID_KEY = 'chocoavent_push_sub_id_v1';
const PUSH_REMINDER_KEY = 'chocoavent_push_reminder_v1';

function hashEndpointShort(endpoint: string): string {
  let h = 2166136261;
  for (let i = 0; i < endpoint.length; i++) {
    h ^= endpoint.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly swPush = inject(SwPush, { optional: true });
  private readonly authService = inject(AuthService);

  readonly isPushConfigured = computed(() =>
    Boolean(environment.push?.workerUrl?.trim() && environment.push?.vapidPublicKey?.trim())
  );

  readonly permissionState = signal<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  readonly isSubscribed = signal<boolean>(Boolean(localStorage.getItem(PUSH_SUB_ID_KEY)));
  readonly reminderTime = signal<string>(localStorage.getItem(PUSH_REMINDER_KEY) || '');

  readonly needsHomeScreenInstall = computed(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isStandalone =
      Boolean((navigator as { standalone?: boolean }).standalone) ||
      window.matchMedia?.('(display-mode: standalone)').matches;
    return isIos && !isStandalone;
  });

  constructor() {
    if (this.swPush?.isEnabled) {
      this.swPush.subscription.subscribe((sub) => {
        this.isSubscribed.set(Boolean(sub));
        if (typeof Notification !== 'undefined') {
          this.permissionState.set(Notification.permission);
        }
      });
    }
  }

  async enableNotifications(): Promise<void> {
    const member = this.authService.currentMember();
    if (!member) {
      throw new Error('Connexion requise.');
    }
    if (this.needsHomeScreenInstall()) {
      throw new Error(
        "Sur iPhone, ajoute d'abord ChocoAvent sur l'écran d'accueil puis ouvre-la depuis l'icône."
      );
    }
    if (!this.isPushConfigured()) {
      throw new Error('Le serveur Cloudflare Push n’est pas encore configuré.');
    }
    if (!this.swPush?.isEnabled) {
      throw new Error('Les notifications Push nécessitent la version installée/HTTPS.');
    }

    const sub = await this.swPush.requestSubscription({
      serverPublicKey: environment.push.vapidPublicKey.trim(),
    });

    if (typeof Notification !== 'undefined') {
      this.permissionState.set(Notification.permission);
    }

    const p256dh = arrayBufferToBase64Url(sub.getKey('p256dh'));
    const auth = arrayBufferToBase64Url(sub.getKey('auth'));
    const subId = `${member.uid}_${hashEndpointShort(sub.endpoint)}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';

    await ensureAnonymousAuth();
    const { db } = getFirebaseClients();
    await setDoc(
      doc(db, 'push_subscriptions', subId),
      {
        memberUid: member.uid,
        memberName: member.name,
        endpoint: sub.endpoint,
        keys: { p256dh, auth },
        reminderTime: this.reminderTime() || '',
        timezone,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    localStorage.setItem(PUSH_SUB_ID_KEY, subId);
    this.isSubscribed.set(true);
  }

  async saveReminderTime(time: string): Promise<void> {
    const cleanTime = time.trim();
    if (cleanTime && !/^\d{2}:\d{2}$/.test(cleanTime)) {
      throw new Error('Format d’heure invalide (ex. 18:30).');
    }

    this.reminderTime.set(cleanTime);
    if (cleanTime) {
      localStorage.setItem(PUSH_REMINDER_KEY, cleanTime);
    } else {
      localStorage.removeItem(PUSH_REMINDER_KEY);
    }

    const subId = localStorage.getItem(PUSH_SUB_ID_KEY);
    const member = this.authService.currentMember();
    if (!subId || !member || !this.authService.firebaseConfigured()) {
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
    await ensureAnonymousAuth();
    const { db } = getFirebaseClients();
    await setDoc(
      doc(db, 'push_subscriptions', subId),
      {
        memberUid: member.uid,
        memberName: member.name,
        reminderTime: cleanTime,
        timezone,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  }

  async disableNotifications(): Promise<void> {
    const subId = localStorage.getItem(PUSH_SUB_ID_KEY);
    if (this.swPush?.isEnabled) {
      await this.swPush.unsubscribe().catch(() => {});
    }
    if (subId && this.authService.firebaseConfigured()) {
      await ensureAnonymousAuth().catch(() => {});
      const { db } = getFirebaseClients();
      await deleteDoc(doc(db, 'push_subscriptions', subId)).catch(() => {});
    }
    localStorage.removeItem(PUSH_SUB_ID_KEY);
    this.isSubscribed.set(false);
  }

  async sendTestNotification(): Promise<{ ok: boolean; status?: number; detail?: string }> {
    const workerUrl = environment.push?.workerUrl?.trim().replace(/\/+$/, '');
    if (!workerUrl) {
      throw new Error('Worker Cloudflare non configuré.');
    }
    const subId = localStorage.getItem(PUSH_SUB_ID_KEY);
    if (!subId) {
      throw new Error('Active d’abord les notifications sur cet appareil.');
    }

    const res = await fetch(`${workerUrl}/test-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subId }),
    });
    const data = (await res.json()) as { ok: boolean; status?: number; detail?: string };
    return data;
  }

  async notifyTradeEvent(
    kind: 'proposed' | 'accepted',
    payload: {
      authorUid: string;
      authorName: string;
      targetUid?: string;
      targetName?: string;
      message: string;
      acceptedByUid?: string;
      acceptedByName?: string;
    }
  ): Promise<void> {
    const workerUrl = environment.push?.workerUrl?.trim().replace(/\/+$/, '');
    if (!workerUrl) return;

    try {
      await fetch(`${workerUrl}/notify-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ...payload }),
      });
    } catch {
      // Never block trade UI if push delivery fails.
    }
  }
}
