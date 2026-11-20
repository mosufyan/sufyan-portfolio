/**
 * Optional Firebase Admin SDK for server-side telemetry writes after OTP verification.
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON (stringified service account) or
 * GOOGLE_APPLICATION_CREDENTIALS pointing at a JSON key file.
 *
 * When configured, Express can write cv_downloads / contact_messages with Admin privileges
 * so clients no longer need an unauthenticated Firestore create path for those logs.
 */
import { createRequire } from 'module';

type FirestoreLike = {
  collection: (name: string) => {
    doc: (id: string) => {
      set: (data: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<void>;
    };
  };
};

type AdminApp = {
  firestore: () => FirestoreLike;
};

type AdminModule = {
  apps: AdminApp[];
  initializeApp: (opts: { credential: unknown }) => AdminApp;
  credential: {
    cert: (serviceAccount: object) => unknown;
    applicationDefault: () => unknown;
  };
  firestore: {
    FieldValue: {
      serverTimestamp: () => unknown;
    };
  };
};

let adminModule: AdminModule | null = null;
let firestore: FirestoreLike | null = null;
let initAttempted = false;

function tryInitAdmin(): boolean {
  if (initAttempted) return firestore != null;
  initAttempted = true;

  const inlineJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const credPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (!inlineJson && !credPath) {
    return false;
  }

  try {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const admin = require('firebase-admin') as AdminModule;
    adminModule = admin;

    const app: AdminApp =
      admin.apps.length > 0
        ? admin.apps[0]
        : admin.initializeApp({
            credential: inlineJson
              ? admin.credential.cert(JSON.parse(inlineJson) as object)
              : admin.credential.applicationDefault(),
          });

    firestore = app.firestore();
    return true;
  } catch (error) {
    console.error('Firebase Admin init failed; client Firestore writes remain active:', error);
    adminModule = null;
    firestore = null;
    return false;
  }
}

export function isFirebaseAdminConfigured(): boolean {
  return tryInitAdmin();
}

export async function adminWriteCvDownload(
  downloadId: string,
  data: Record<string, unknown>
): Promise<boolean> {
  if (!tryInitAdmin() || !firestore || !adminModule) return false;
  try {
    await firestore.collection('cv_downloads').doc(downloadId).set({
      ...data,
      createdAt: adminModule.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Admin cv_downloads write failed:', error);
    return false;
  }
}

export async function adminWriteContactMessage(
  messageId: string,
  data: Record<string, unknown>
): Promise<boolean> {
  if (!tryInitAdmin() || !firestore || !adminModule) return false;
  try {
    await firestore.collection('contact_messages').doc(messageId).set({
      ...data,
      createdAt: adminModule.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Admin contact_messages write failed:', error);
    return false;
  }
}
