/**
 * Firestore security rules — default-deny + collection smoke.
 * Run via: npm run test:rules (starts emulator through firebase emulators:exec).
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'demo-sufyan-portfolio';
const RULES = readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES,
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('firestore.rules', () => {
  it('denies unauthenticated create on cv_downloads (server-only path)', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, 'cv_downloads', 'dl-test-1'), {
        downloadId: 'dl-test-1',
      })
    );
  });

  it('denies unauthenticated create on contact_messages', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, 'contact_messages', 'MSG-test'), {
        messageId: 'MSG-test',
      })
    );
  });

  it('denies unauthenticated read of portfolio_settings', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'portfolio_settings', 'site'), {
        maintenanceMode: false,
      });
    });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'portfolio_settings', 'site')));
  });

  it('allows unauthenticated get of a published announcement', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'announcements', 'ann-public-1'), {
        date: '2026-01-01',
        title: 'Public milestone',
        summary: 'A published announcement for rules smoke testing.',
        badge: 'MILESTONE',
        linkUrl: '',
        status: 'published',
        scheduledAtMs: 0,
        authorUid: 'owner-uid',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, 'announcements', 'ann-public-1')));
  });

  it('denies unauthenticated get of a draft announcement', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'announcements', 'ann-draft-1'), {
        date: '2026-01-01',
        title: 'Draft only',
        summary: 'This draft must stay owner-private under rules.',
        badge: 'MILESTONE',
        linkUrl: '',
        status: 'draft',
        scheduledAtMs: 0,
        authorUid: 'owner-uid',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'announcements', 'ann-draft-1')));
  });
});
