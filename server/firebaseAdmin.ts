/**
 * Optional Firebase Admin SDK for server-side telemetry writes after OTP verification.
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON (stringified service account) or
 * GOOGLE_APPLICATION_CREDENTIALS pointing at a JSON key file.
 *
 * When configured, Express can write cv_downloads / contact_messages with Admin privileges
 * so clients no longer need an unauthenticated Firestore create path for those logs.
 *
 * Compatible with firebase-admin v12+ modular surface (getApps / cert / getFirestore).
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  OWNER_METRICS_CHAT_DOC,
  OWNER_METRICS_COLLECTION,
  OWNER_METRICS_SITE_DOC,
  sanitizeSiteTelemetry,
  type SiteTelemetryState,
} from './ownerDurableState.ts';

type FirestoreLike = {
  collection: (name: string) => {
    doc: (id: string) => {
      set: (data: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<void>;
      update: (data: Record<string, unknown>) => Promise<void>;
      get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
    };
  };
};

/** Defaults so owner console triage updates always have a complete CRM schema. */
const CONTACT_TRIAGE_DEFAULTS = {
  triageStatus: 'new',
  ownerNote: '',
  leadCompany: '',
  leadRole: '',
  leadSource: '',
  leadPriority: '',
  leadNextAction: '',
  leadNextActionDueAtMs: 0,
  leadOutcome: '',
} as const;

type AdminApp = {
  name?: string;
};

type AdminAppModule = {
  getApps: () => AdminApp[];
  initializeApp: (opts: { credential: unknown }) => AdminApp;
  cert: (serviceAccount: object) => unknown;
  applicationDefault: () => unknown;
};

type AdminFirestoreModule = {
  getFirestore: (app?: AdminApp, databaseId?: string) => FirestoreLike;
  FieldValue: {
    serverTimestamp: () => unknown;
    increment: (n: number) => unknown;
  };
};

let adminAppModule: AdminAppModule | null = null;
let firestoreModule: AdminFirestoreModule | null = null;
let firestore: FirestoreLike | null = null;
let initAttempted = false;

function readConfiguredFirestoreDatabaseId(): string {
  try {
    const configPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'firebase-applet-config.json'
    );
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { firestoreDatabaseId?: string };
    const id = (parsed.firestoreDatabaseId || '(default)').trim();
    return id || '(default)';
  } catch {
    return '(default)';
  }
}

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
    const appMod = require('firebase-admin/app') as AdminAppModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsMod = require('firebase-admin/firestore') as AdminFirestoreModule;
    adminAppModule = appMod;
    firestoreModule = fsMod;

    const credential = inlineJson
      ? appMod.cert(JSON.parse(inlineJson) as object)
      : appMod.applicationDefault();

    const existing = appMod.getApps();
    const app = existing.length > 0 ? existing[0] : appMod.initializeApp({ credential });

    const databaseId = readConfiguredFirestoreDatabaseId();
    firestore =
      databaseId && databaseId !== '(default)'
        ? fsMod.getFirestore(app, databaseId)
        : fsMod.getFirestore(app);
    return true;
  } catch (error) {
    console.error('Firebase Admin init failed; client Firestore writes remain active:', error);
    adminAppModule = null;
    firestoreModule = null;
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
  if (!tryInitAdmin() || !firestore || !firestoreModule) return false;
  try {
    await firestore.collection('cv_downloads').doc(downloadId).set({
      ...data,
      createdAt: firestoreModule.FieldValue.serverTimestamp(),
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
  if (!tryInitAdmin() || !firestore || !firestoreModule) return false;
  try {
    await firestore.collection('contact_messages').doc(messageId).set({
      ...CONTACT_TRIAGE_DEFAULTS,
      ...data,
      createdAt: firestoreModule.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Admin contact_messages write failed:', error);
    return false;
  }
}

export async function adminGetContactMessage(
  messageId: string
): Promise<{
  senderEmail: string;
  senderName: string;
  ownerNote?: string;
  theme?: string;
  accent?: string;
} | null> {
  if (!tryInitAdmin() || !firestore) return null;
  try {
    const snap = await firestore.collection('contact_messages').doc(messageId).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const senderEmail =
      typeof data.senderEmail === 'string' ? data.senderEmail.trim().toLowerCase() : '';
    if (!senderEmail) return null;
    const senderName = typeof data.senderName === 'string' ? data.senderName.trim() : '';
    const ownerNote = typeof data.ownerNote === 'string' ? data.ownerNote : '';
    const theme = typeof data.theme === 'string' ? data.theme : undefined;
    const accent = typeof data.accent === 'string' ? data.accent : undefined;
    return { senderEmail, senderName, ownerNote, theme, accent };
  } catch (error) {
    console.error('Admin contact_messages read failed:', error);
    return null;
  }
}

export async function adminLoadSiteTelemetry(): Promise<SiteTelemetryState | null> {
  if (!tryInitAdmin() || !firestore) return null;
  try {
    const snap = await firestore.collection(OWNER_METRICS_COLLECTION).doc(OWNER_METRICS_SITE_DOC).get();
    if (!snap.exists) return null;
    return sanitizeSiteTelemetry(snap.data() || {});
  } catch (error) {
    console.error('Admin owner_metrics/site read failed:', error);
    return null;
  }
}

/** Full replace of site telemetry counters (merge-safe via caller taking max first). */
export async function adminSaveSiteTelemetry(state: SiteTelemetryState): Promise<boolean> {
  if (!tryInitAdmin() || !firestore || !firestoreModule) return false;
  try {
    const clean = sanitizeSiteTelemetry(state);
    await firestore.collection(OWNER_METRICS_COLLECTION).doc(OWNER_METRICS_SITE_DOC).set(
      {
        pageviews: clean.pageviews,
        ogShares: clean.ogShares,
        ogByTrack: clean.ogByTrack,
        updatedAtIso: clean.updatedAtIso,
        updatedAt: firestoreModule.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Admin owner_metrics/site write failed:', error);
    return false;
  }
}

export async function adminLoadChatCacheSnapshot(): Promise<Record<string, unknown> | null> {
  if (!tryInitAdmin() || !firestore) return null;
  try {
    const snap = await firestore.collection(OWNER_METRICS_COLLECTION).doc(OWNER_METRICS_CHAT_DOC).get();
    if (!snap.exists) return null;
    const data = snap.data();
    return data && typeof data === 'object' ? data : null;
  } catch (error) {
    console.error('Admin owner_metrics/chat_cache read failed:', error);
    return null;
  }
}

/** Persist owner chat sessions + lifetime counters (Admin SDK; survives Cloud Run redeploys). */
export async function adminSaveChatCacheSnapshot(
  payload: Record<string, unknown>
): Promise<boolean> {
  if (!tryInitAdmin() || !firestore || !firestoreModule) return false;
  try {
    // Strip undefined; Firestore rejects undefined field values.
    const body = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    await firestore.collection(OWNER_METRICS_COLLECTION).doc(OWNER_METRICS_CHAT_DOC).set(
      {
        ...body,
        updatedAt: firestoreModule.FieldValue.serverTimestamp(),
      },
      { merge: false }
    );
    return true;
  } catch (error) {
    console.error('Admin owner_metrics/chat_cache write failed:', error);
    return false;
  }
}

/** Mark inquiry replied after a successful owner outbound email (bypasses client rules). */
export async function adminMarkContactReplied(
  messageId: string,
  replyBody: string
): Promise<boolean> {
  if (!tryInitAdmin() || !firestore || !firestoreModule) return false;
  const id = messageId.trim();
  if (id.length < 4) return false;
  try {
    const ref = firestore.collection('contact_messages').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return false;
    const existing = snap.data() || {};
    const prevNote = typeof existing.ownerNote === 'string' ? existing.ownerNote.trim() : '';
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const snippet = replyBody.trim().slice(0, 220);
    const line = `[Reply ${stamp}] ${snippet}`;
    const ownerNote = (prevNote ? `${prevNote}\n${line}` : line).slice(0, 1000);

    await ref.set(
      {
        ...CONTACT_TRIAGE_DEFAULTS,
        triageStatus: 'replied',
        ownerNote,
        triagedAt: firestoreModule.FieldValue.serverTimestamp(),
        // Preserve any CRM fields already set on the inquiry.
        leadCompany: typeof existing.leadCompany === 'string' ? existing.leadCompany : '',
        leadRole: typeof existing.leadRole === 'string' ? existing.leadRole : '',
        leadSource: typeof existing.leadSource === 'string' ? existing.leadSource : '',
        leadPriority: typeof existing.leadPriority === 'string' ? existing.leadPriority : '',
        leadNextAction: typeof existing.leadNextAction === 'string' ? existing.leadNextAction : '',
        leadNextActionDueAtMs:
          typeof existing.leadNextActionDueAtMs === 'number' &&
          Number.isFinite(existing.leadNextActionDueAtMs)
            ? Math.floor(existing.leadNextActionDueAtMs)
            : 0,
        leadOutcome: typeof existing.leadOutcome === 'string' ? existing.leadOutcome : '',
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Admin contact_messages mark-replied failed:', error);
    return false;
  }
}
