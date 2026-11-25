import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push';

export interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_API_KEY: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

interface StoredSub {
  docId: string;
  memberUid: string;
  memberName: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  reminderTime: string;
  timezone: string;
  lastReminderDate: string;
}

interface FirestoreDoc {
  name: string;
  fields?: Record<
    string,
    {
      stringValue?: string;
      mapValue?: { fields?: Record<string, { stringValue?: string }> };
    }
  >;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function firestoreBase(projectId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

async function getWorkerAuthToken(apiKey: string): Promise<string | null> {
  if (!apiKey) return null;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { idToken?: string };
  return json.idToken ?? null;
}

async function listSubscriptions(projectId: string, idToken: string | null): Promise<StoredSub[]> {
  const headers: Record<string, string> = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(`${firestoreBase(projectId)}/push_subscriptions?pageSize=100`, {
    headers,
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { documents?: FirestoreDoc[] };
  const docs = json.documents ?? [];
  const subs: StoredSub[] = [];

  for (const d of docs) {
    const f = d.fields;
    if (!f) continue;
    const endpoint = f['endpoint']?.stringValue;
    const p256dh = f['keys']?.mapValue?.fields?.['p256dh']?.stringValue;
    const auth = f['keys']?.mapValue?.fields?.['auth']?.stringValue;
    const memberUid = f['memberUid']?.stringValue ?? '';
    if (!endpoint || !p256dh || !auth || !memberUid) continue;

    subs.push({
      docId: d.name.split('/').pop() ?? '',
      memberUid,
      memberName: f['memberName']?.stringValue ?? 'Membre',
      endpoint,
      p256dh,
      auth,
      reminderTime: f['reminderTime']?.stringValue ?? '',
      timezone: f['timezone']?.stringValue || 'Europe/Paris',
      lastReminderDate: f['lastReminderDate']?.stringValue ?? '',
    });
  }
  return subs;
}

async function deleteSubscription(
  projectId: string,
  docId: string,
  idToken: string | null
): Promise<void> {
  if (!docId) return;
  const headers: Record<string, string> = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  await fetch(`${firestoreBase(projectId)}/push_subscriptions/${docId}`, {
    method: 'DELETE',
    headers,
  }).catch(() => {});
}

async function markReminderSent(
  projectId: string,
  docId: string,
  dateStr: string,
  idToken: string | null
): Promise<void> {
  if (!docId) return;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  await fetch(
    `${firestoreBase(projectId)}/push_subscriptions/${docId}?updateMask.fieldPaths=lastReminderDate`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        fields: {
          lastReminderDate: { stringValue: dateStr },
        },
      }),
    }
  ).catch(() => {});
}

async function sendNgswPush(
  env: Env,
  sub: StoredSub,
  idToken: string | null,
  notification: { title: string; body: string; url: string }
): Promise<{ ok: boolean; status: number; detail: string }> {
  const pushSub: PushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  const payload = JSON.stringify({
    notification: {
      title: notification.title,
      body: notification.body,
      icon: '/icons/santa-192x192.png',
      badge: '/icons/santa-72x72.png',
      data: {
        onActionClick: {
          default: {
            operation: 'openWindow',
            url: notification.url,
          },
        },
      },
    },
  });

  const packet = await buildPushPayload(
    { data: payload, options: { ttl: 3600 } },
    pushSub,
    {
      subject: env.VAPID_SUBJECT,
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    }
  );

  const res = await fetch(sub.endpoint, {
    method: packet.method,
    headers: packet.headers,
    body: packet.body,
  });
  const detail = await res.text().catch(() => '');

  if (res.status === 404 || res.status === 410) {
    await deleteSubscription(env.FIREBASE_PROJECT_ID, sub.docId, idToken);
    return { ok: false, status: res.status, detail: detail || 'Abonnement expiré' };
  }
  return { ok: res.ok, status: res.status, detail };
}

function getLocalClock(timezone: string): { dateStr: string; minutes: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return { dateStr, minutes: hour * 60 + minute };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST') {
      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
    }

    if (url.pathname === '/test-push') {
      try {
        const body = (await request.json()) as { subId?: string };
        const idToken = await getWorkerAuthToken(env.FIREBASE_API_KEY);
        const subs = await listSubscriptions(env.FIREBASE_PROJECT_ID, idToken);
        const sub = subs.find((s) => s.docId === body.subId);
        if (!sub) {
          return new Response(
            JSON.stringify({
              ok: false,
              status: 404,
              detail: 'Abonnement introuvable en base (réactive les notifications).',
            }),
            { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        const result = await sendNgswPush(env, sub, idToken, {
          title: '🔔 Test ChocoAvent',
          body: 'Les notifications Push fonctionnent bien sur cet appareil !',
          url: '/tabs/profile',
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({
            ok: false,
            status: 500,
            detail: err instanceof Error ? err.message : 'Erreur test push',
          }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (url.pathname !== '/notify-trade') {
      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
    }

    try {
      const body = (await request.json()) as {
        kind?: 'proposed' | 'accepted';
        authorUid?: string;
        targetUid?: string;
        acceptedByUid?: string;
        message?: string;
      };

      const actorUid = body.kind === 'accepted' ? body.acceptedByUid : body.authorUid;
      const title =
        body.kind === 'accepted' ? '🤝 Échange accepté !' : '🍫 Proposition d’échange';
      const text = body.message || 'Un échange de chocolat est disponible dans ChocoAvent.';

      const idToken = await getWorkerAuthToken(env.FIREBASE_API_KEY);
      const subs = await listSubscriptions(env.FIREBASE_PROJECT_ID, idToken);
      const targets = subs.filter((s) => {
        if (s.memberUid === actorUid) return false;
        if (body.kind === 'proposed' && body.targetUid) {
          return s.memberUid === body.targetUid;
        }
        if (body.kind === 'accepted' && body.authorUid) {
          return s.memberUid === body.authorUid;
        }
        return true;
      });

      const results = await Promise.all(
        targets.map((sub) =>
          sendNgswPush(env, sub, idToken, { title, body: text, url: '/tabs/history' })
            .then((r) => r.ok)
            .catch(() => false)
        )
      );

      const sent = results.filter(Boolean).length;
      return new Response(JSON.stringify({ ok: true, sent }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'error' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const idToken = await getWorkerAuthToken(env.FIREBASE_API_KEY);
    const subs = await listSubscriptions(env.FIREBASE_PROJECT_ID, idToken);
    for (const sub of subs) {
      if (!/^\d{2}:\d{2}$/.test(sub.reminderTime)) continue;
      const [hh, mm] = sub.reminderTime.split(':').map(Number);
      const targetMinutes = hh * 60 + mm;

      let local: { dateStr: string; minutes: number };
      try {
        local = getLocalClock(sub.timezone);
      } catch {
        local = getLocalClock('Europe/Paris');
      }

      if (sub.lastReminderDate === local.dateStr) continue;
      if (local.minutes >= targetMinutes && local.minutes < targetMinutes + 5) {
        const sent = await sendNgswPush(env, sub, idToken, {
          title: '🍫 N’oublie pas ton chocolat !',
          body: 'Ta case du calendrier de l’Avent t’attend aujourd’hui.',
          url: '/tabs/calendar',
        })
          .then((r) => r.ok)
          .catch(() => false);

        if (sent) {
          await markReminderSent(env.FIREBASE_PROJECT_ID, sub.docId, local.dateStr, idToken);
        }
      }
    }
  },
};
