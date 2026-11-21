import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfigFile from '../firebase-applet-config.json';
import { toUserFacingError } from './utils/userFacingError.ts';

/**
 * Firebase web config: non-secret project identifiers may live in
 * firebase-applet-config.json. apiKey / recaptchaSiteKey come from env so they
 * are not committed (restrict the browser key in Google Cloud Console).
 */
const firebaseConfig = {
  ...firebaseConfigFile,
  // Never fall back to committed JSON for secrets/public keys — env only.
  apiKey:
    typeof import.meta.env.VITE_FIREBASE_API_KEY === 'string'
      ? import.meta.env.VITE_FIREBASE_API_KEY.trim()
      : '',
  recaptchaSiteKey:
    typeof import.meta.env.VITE_RECAPTCHA_SITE_KEY === 'string'
      ? import.meta.env.VITE_RECAPTCHA_SITE_KEY.trim()
      : '',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Firebase App Check (reCAPTCHA Enterprise).
 * Set VITE_RECAPTCHA_SITE_KEY (or recaptchaSiteKey via env-backed config),
 * then enable App Check enforcement in the Firebase Console for Firestore.
 */
const appCheckSiteKey = firebaseConfig.recaptchaSiteKey;

if (typeof window !== 'undefined' && appCheckSiteKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    console.warn('Firebase App Check init skipped:', error);
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  // Keep diagnostics in the console only — never rethrow JSON / PII into UI banners.
  console.error('Firestore Error:', errInfo);
  throw new Error(
    toUserFacingError(error, 'Unable to complete that action right now. Please try again.')
  );
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  void testConnection();
}
