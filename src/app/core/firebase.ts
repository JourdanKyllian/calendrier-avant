import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, User, getAuth, signInAnonymously } from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { environment } from '../../environments/environment';

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let inflightAnonSignIn: Promise<User> | null = null;

export function isFirebaseConfigured(): boolean {
  const cfg = environment.firebase;
  return Boolean(
    cfg &&
      cfg.apiKey &&
      !cfg.apiKey.startsWith('YOUR_') &&
      cfg.projectId &&
      !cfg.projectId.startsWith('YOUR_')
  );
}

export function getFirebaseClients(): { app: FirebaseApp; db: Firestore; auth: Auth } {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured yet.');
  }
  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApps()[0] : initializeApp(environment.firebase);
  }
  if (!cachedDb) {
    try {
      cachedDb = initializeFirestore(cachedApp, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      cachedDb = getFirestore(cachedApp);
    }
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
  }
  return { app: cachedApp, db: cachedDb, auth: cachedAuth };
}

/**
 * Ensures the browser holds a silent Firebase Auth session (Anonymous provider)
 * so Firestore rules can reject unauthenticated public API requests.
 */
export async function ensureAnonymousAuth(): Promise<User> {
  const { auth } = getFirebaseClients();
  await auth.authStateReady();
  if (auth.currentUser) {
    return auth.currentUser;
  }
  if (!inflightAnonSignIn) {
    inflightAnonSignIn = signInAnonymously(auth)
      .then((cred) => cred.user)
      .finally(() => {
        inflightAnonSignIn = null;
      });
  }
  return inflightAnonSignIn;
}
