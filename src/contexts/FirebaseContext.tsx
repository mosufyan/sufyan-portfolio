import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { ANNOUNCEMENTS } from '../data/portfolioData';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  generateAnnouncementId,
  isPortfolioOwner,
  type AnnouncementBadge,
  type AnnouncementDraft,
  type AnnouncementRecord,
  validateAnnouncementDraft,
} from '../utils/announcementValidation';
import {
  sanitizeCvDownloadLogPayload,
  type CvDownloadLogRecord,
  type CvTrackingSummary,
} from '../utils/cvDownloadLogValidation';
import {
  normalizeContactTriageStatus,
  sanitizeContactMessageLogPayload,
  sanitizeContactTriageUpdate,
  type ContactMessageLogRecord,
  type ContactMessageSummary,
  type ContactTriageStatus,
} from '../utils/contactMessageLogValidation';
import {
  DEFAULT_PORTFOLIO_SETTINGS,
  generateRuleId,
  sanitizeAdminAuditPayload,
  sanitizePortfolioSettings,
  validateAccessRuleDraft,
  type AccessRuleDraft,
  type AccessRuleMatchType,
  type AccessRuleRecord,
  type AccessRuleType,
  type AdminAuditEventType,
  type AdminAuditLogRecord,
  type PortfolioSettings,
} from '../utils/ownerGovernance';

const STARTER_ANNOUNCEMENTS: AnnouncementRecord[] = ANNOUNCEMENTS.map((item) => ({
  id: item.id,
  date: item.date,
  title: item.title,
  summary: item.summary,
  badge: 'VERIFIED',
  linkUrl: '',
  source: 'starter',
}));

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  isOwner: boolean;
  announcements: AnnouncementRecord[];
  usingStarterFallback: boolean;
  loadingAnnouncements: boolean;
  cvDownloadLogs: CvDownloadLogRecord[];
  loadingDownloadLogs: boolean;
  contactMessageLogs: ContactMessageLogRecord[];
  loadingContactLogs: boolean;
  portfolioSettings: PortfolioSettings;
  loadingSettings: boolean;
  adminAuditLogs: AdminAuditLogRecord[];
  loadingAuditLogs: boolean;
  accessRules: AccessRuleRecord[];
  loadingAccessRules: boolean;
  signInAsOwner: () => Promise<void>;
  signOutOwner: () => Promise<void>;
  createAnnouncement: (draft: AnnouncementDraft, importStarterIfEmpty?: boolean) => Promise<void>;
  updateAnnouncement: (id: string, draft: AnnouncementDraft) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  importStarterAnnouncements: () => Promise<void>;
  recordCvDownloadLog: (summary: CvTrackingSummary) => Promise<void>;
  deleteCvDownloadLog: (downloadId: string) => Promise<void>;
  recordContactMessageLog: (summary: ContactMessageSummary) => Promise<void>;
  deleteContactMessageLog: (messageId: string) => Promise<void>;
  updateContactMessageTriage: (
    messageId: string,
    triage: { triageStatus: ContactTriageStatus; ownerNote: string }
  ) => Promise<void>;
  savePortfolioSettings: (next: PortfolioSettings) => Promise<void>;
  createAccessRule: (draft: AccessRuleDraft) => Promise<void>;
  deleteAccessRule: (ruleId: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudAnnouncements, setCloudAnnouncements] = useState<AnnouncementRecord[] | null>(null);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [cvDownloadLogs, setCvDownloadLogs] = useState<CvDownloadLogRecord[]>([]);
  const [loadingDownloadLogs, setLoadingDownloadLogs] = useState(false);
  const [contactMessageLogs, setContactMessageLogs] = useState<ContactMessageLogRecord[]>([]);
  const [loadingContactLogs, setLoadingContactLogs] = useState(false);
  const [portfolioSettings, setPortfolioSettings] = useState<PortfolioSettings>(() => ({
    ...DEFAULT_PORTFOLIO_SETTINGS,
  }));
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLogRecord[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [accessRules, setAccessRules] = useState<AccessRuleRecord[]>([]);
  const [loadingAccessRules, setLoadingAccessRules] = useState(false);
  const lastPolicyDigestRef = useRef<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const path = 'announcements';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: AnnouncementRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            date: typeof data.date === 'string' ? data.date : '',
            title: typeof data.title === 'string' ? data.title : '',
            summary: typeof data.summary === 'string' ? data.summary : '',
            badge: (typeof data.badge === 'string' ? data.badge : 'VERIFIED') as AnnouncementBadge,
            linkUrl: typeof data.linkUrl === 'string' ? data.linkUrl : '',
            source: 'cloud',
          };
        });
        setCloudAnnouncements(items);
        setLoadingAnnouncements(false);
      },
      (error) => {
        setLoadingAnnouncements(false);
        setCloudAnnouncements((prev) => prev ?? []);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [authReady]);

  // Public singleton portfolio_settings/global subscription
  useEffect(() => {
    if (!authReady) return;

    const path = 'portfolio_settings/global';
    const ref = doc(db, 'portfolio_settings', 'global');
    const unsubscribe = onSnapshot(
      ref,
      (docSnap) => {
        if (docSnap.exists()) {
          setPortfolioSettings(sanitizePortfolioSettings(docSnap.data() as Partial<PortfolioSettings>));
        } else {
          setPortfolioSettings({ ...DEFAULT_PORTFOLIO_SETTINGS });
        }
        setLoadingSettings(false);
      },
      (error) => {
        setLoadingSettings(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [authReady]);

  const isOwner = isPortfolioOwner(user);

  // Strictly attach cv_downloads PII stream ONLY when verified portfolio owner is signed in
  useEffect(() => {
    if (!authReady || !isOwner) {
      setCvDownloadLogs([]);
      setLoadingDownloadLogs(false);
      return;
    }

    setLoadingDownloadLogs(true);
    const path = 'cv_downloads';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(250));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logs: CvDownloadLogRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const ts = d.createdAt as Timestamp | undefined;
          const ms = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now();
          return {
            downloadId: typeof d.downloadId === 'string' ? d.downloadId : docSnap.id,
            sessionId: typeof d.sessionId === 'string' ? d.sessionId : '',
            visitorName: typeof d.visitorName === 'string' ? d.visitorName : '',
            visitorEmail: typeof d.visitorEmail === 'string' ? d.visitorEmail : '',
            visitorPhone: typeof d.visitorPhone === 'string' ? d.visitorPhone : '',
            reason: typeof d.reason === 'string' ? d.reason : '',
            action: (d.action as CvDownloadLogRecord['action']) || 'pdf',
            formatLabel: typeof d.formatLabel === 'string' ? d.formatLabel : 'Executive Summary',
            theme: d.theme === 'light' ? 'light' : 'dark',
            verificationStatus:
              (d.verificationStatus as CvDownloadLogRecord['verificationStatus']) || 'mx_verified',
            ipAddress: typeof d.ipAddress === 'string' ? d.ipAddress : '',
            country: typeof d.country === 'string' ? d.country : 'Unknown',
            region: typeof d.region === 'string' ? d.region : '',
            city: typeof d.city === 'string' ? d.city : '',
            isp: typeof d.isp === 'string' ? d.isp : '',
            asn: typeof d.asn === 'string' ? d.asn : '',
            timezone: typeof d.timezone === 'string' ? d.timezone : '',
            clientTimezone: typeof d.clientTimezone === 'string' ? d.clientTimezone : '',
            isVpnSuspected: Boolean(d.isVpnSuspected),
            isProxy: Boolean(d.isProxy),
            isHosting: Boolean(d.isHosting),
            timezoneMismatch: Boolean(d.timezoneMismatch),
            riskLevel: (d.riskLevel as CvDownloadLogRecord['riskLevel']) || 'low',
            riskReasons: typeof d.riskReasons === 'string' ? d.riskReasons : '',
            referrer: typeof d.referrer === 'string' ? d.referrer : '',
            userAgent: typeof d.userAgent === 'string' ? d.userAgent : '',
            isSubsequent: Boolean(d.isSubsequent),
            createdAtMs: ms,
            createdAtIso: new Date(ms).toISOString(),
          };
        });
        setCvDownloadLogs(logs);
        setLoadingDownloadLogs(false);
      },
      (error) => {
        setLoadingDownloadLogs(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [authReady, isOwner]);

  // Strictly attach contact_messages PII stream ONLY when verified portfolio owner is signed in
  useEffect(() => {
    if (!authReady || !isOwner) {
      setContactMessageLogs([]);
      setLoadingContactLogs(false);
      return;
    }

    setLoadingContactLogs(true);
    const path = 'contact_messages';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(250));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logs: ContactMessageLogRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const ts = d.createdAt as Timestamp | undefined;
          const ms = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now();
          const triagedTs = d.triagedAt as Timestamp | undefined;
          const triagedMs =
            triagedTs && typeof triagedTs.toMillis === 'function' ? triagedTs.toMillis() : null;
          return {
            messageId: typeof d.messageId === 'string' ? d.messageId : docSnap.id,
            senderName: typeof d.senderName === 'string' ? d.senderName : '',
            senderEmail: typeof d.senderEmail === 'string' ? d.senderEmail : '',
            senderPhone: typeof d.senderPhone === 'string' ? d.senderPhone : '',
            subject: typeof d.subject === 'string' ? d.subject : '',
            message: typeof d.message === 'string' ? d.message : '',
            theme: d.theme === 'light' ? 'light' : 'dark',
            ipAddress: typeof d.ipAddress === 'string' ? d.ipAddress : '',
            country: typeof d.country === 'string' ? d.country : 'Unknown',
            region: typeof d.region === 'string' ? d.region : '',
            city: typeof d.city === 'string' ? d.city : '',
            isp: typeof d.isp === 'string' ? d.isp : '',
            asn: typeof d.asn === 'string' ? d.asn : '',
            timezone: typeof d.timezone === 'string' ? d.timezone : '',
            clientTimezone: typeof d.clientTimezone === 'string' ? d.clientTimezone : '',
            isVpnSuspected: Boolean(d.isVpnSuspected),
            riskLevel: (d.riskLevel as ContactMessageLogRecord['riskLevel']) || 'low',
            riskReasons: typeof d.riskReasons === 'string' ? d.riskReasons : '',
            referrer: typeof d.referrer === 'string' ? d.referrer : '',
            userAgent: typeof d.userAgent === 'string' ? d.userAgent : '',
            triageStatus: normalizeContactTriageStatus(d.triageStatus),
            ownerNote: typeof d.ownerNote === 'string' ? d.ownerNote : '',
            triagedAtMs: triagedMs,
            createdAtMs: ms,
            createdAtIso: new Date(ms).toISOString(),
          };
        });
        setContactMessageLogs(logs);
        setLoadingContactLogs(false);
      },
      (error) => {
        setLoadingContactLogs(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [authReady, isOwner]);

  // Strictly attach admin_audit_logs ONLY when verified portfolio owner is signed in
  useEffect(() => {
    if (!authReady || !isOwner) {
      setAdminAuditLogs([]);
      setLoadingAuditLogs(false);
      return;
    }

    setLoadingAuditLogs(true);
    const path = 'admin_audit_logs';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(200));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: AdminAuditLogRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const ts = d.createdAt as Timestamp | undefined;
          const ms = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now();
          return {
            auditId: typeof d.auditId === 'string' ? d.auditId : docSnap.id,
            eventType: (d.eventType as AdminAuditEventType) || 'owner_login',
            actorEmail: typeof d.actorEmail === 'string' ? d.actorEmail : '',
            actorUid: typeof d.actorUid === 'string' ? d.actorUid : '',
            summary: typeof d.summary === 'string' ? d.summary : '',
            userAgent: typeof d.userAgent === 'string' ? d.userAgent : '',
            timezone: typeof d.timezone === 'string' ? d.timezone : '',
            hostname: typeof d.hostname === 'string' ? d.hostname : '',
            createdAtMs: ms,
            createdAtIso: new Date(ms).toISOString(),
          };
        });
        setAdminAuditLogs(items);
        setLoadingAuditLogs(false);
      },
      (error) => {
        setLoadingAuditLogs(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [authReady, isOwner]);

  // Strictly attach access_rules ONLY when verified portfolio owner is signed in
  useEffect(() => {
    if (!authReady || !isOwner) {
      setAccessRules([]);
      setLoadingAccessRules(false);
      return;
    }

    setLoadingAccessRules(true);
    const path = 'access_rules';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(200));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: AccessRuleRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const ts = d.createdAt as Timestamp | undefined;
          const ms = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now();
          return {
            ruleId: typeof d.ruleId === 'string' ? d.ruleId : docSnap.id,
            ruleType: (d.ruleType === 'allow' ? 'allow' : 'block') as AccessRuleType,
            matchType: (d.matchType === 'email' || d.matchType === 'ip'
              ? d.matchType
              : 'domain') as AccessRuleMatchType,
            value: typeof d.value === 'string' ? d.value : '',
            note: typeof d.note === 'string' ? d.note : '',
            createdByUid: typeof d.createdByUid === 'string' ? d.createdByUid : '',
            createdAtMs: ms,
            createdAtIso: new Date(ms).toISOString(),
          };
        });
        setAccessRules(items);
        setLoadingAccessRules(false);
      },
      (error) => {
        setLoadingAccessRules(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [authReady, isOwner]);

  const syncOwnerPolicyToServer = useCallback(
    async (
      targetUser: User | null,
      rules: AccessRuleRecord[],
      settings: PortfolioSettings
    ) => {
      if (!targetUser || !isPortfolioOwner(targetUser)) return;
      const payload = {
        rules: rules.map((r) => ({
          ruleType: r.ruleType,
          matchType: r.matchType,
          value: r.value,
          note: r.note,
        })),
        strictOtpForAll: settings.strictOtpForAll,
        enableContactForm: settings.enableContactForm,
        enableCvDownloads: settings.enableCvDownloads,
      };
      const digest = JSON.stringify(payload);
      if (digest === lastPolicyDigestRef.current) return;

      try {
        const idToken = await targetUser.getIdToken();
        const res = await fetch('/api/owner/policy-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: digest,
        });
        if (res.ok) {
          lastPolicyDigestRef.current = digest;
        }
      } catch {
        /* non-fatal background policy sync */
      }
    },
    []
  );

  // Automatically sync access rules & runtime enforcement toggles to Express backend
  useEffect(() => {
    if (!authReady || !isOwner || !user || loadingSettings || loadingAccessRules) return;
    void syncOwnerPolicyToServer(user, accessRules, portfolioSettings);
  }, [
    authReady,
    isOwner,
    user,
    accessRules,
    portfolioSettings,
    loadingSettings,
    loadingAccessRules,
    syncOwnerPolicyToServer,
  ]);

  const recordAdminAudit = useCallback(
    async (eventType: AdminAuditEventType, summary: string, actorOverride?: User | null) => {
      const actor = actorOverride ?? auth.currentUser;
      if (!actor || !isPortfolioOwner(actor)) return;

      let tz = '';
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      } catch {
        tz = '';
      }
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

      const payload = sanitizeAdminAuditPayload({
        eventType,
        actorEmail: actor.email || '',
        actorUid: actor.uid,
        summary,
        userAgent: ua,
        timezone: tz,
        hostname,
      });
      if (!payload) return;

      const docPath = `admin_audit_logs/${payload.auditId}`;
      try {
        await setDoc(doc(db, 'admin_audit_logs', payload.auditId), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    },
    []
  );

  const signInAsOwner = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    if (isPortfolioOwner(cred.user)) {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
      await recordAdminAudit('owner_login', `Owner console sign-in from ${host}`, cred.user).catch(
        () => {}
      );
    }
  }, [recordAdminAudit]);

  const signOutOwner = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (currentUser && isPortfolioOwner(currentUser)) {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
      await recordAdminAudit('owner_logout', `Owner console sign-out from ${host}`, currentUser).catch(
        () => {}
      );
    }
    lastPolicyDigestRef.current = '';
    await signOut(auth);
  }, [recordAdminAudit]);

  const importStarterAnnouncements = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !isPortfolioOwner(currentUser)) {
      throw new Error('Only the verified portfolio owner can import starter announcements.');
    }

    const batch = writeBatch(db);
    for (const starter of STARTER_ANNOUNCEMENTS) {
      const check = validateAnnouncementDraft(starter);
      if (!check.valid) continue;
      batch.set(doc(db, 'announcements', starter.id), {
        ...check.normalized,
        authorUid: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
      void recordAdminAudit('announcement_mutated', 'Imported starter milestones into Cloud database').catch(
        () => {}
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'announcements');
    }
  }, [recordAdminAudit]);

  const createAnnouncement = useCallback(
    async (draft: AnnouncementDraft, importStarterIfEmpty = true) => {
      const currentUser = auth.currentUser;
      if (!currentUser || !isPortfolioOwner(currentUser)) {
        throw new Error('Only the verified portfolio owner can publish announcements.');
      }

      const validation = validateAnnouncementDraft(draft);
      if (!validation.valid) {
        throw new Error(validation.errors[0] || 'Invalid announcement fields.');
      }

      if ((cloudAnnouncements?.length ?? 0) === 0 && importStarterIfEmpty) {
        await importStarterAnnouncements();
      }

      const id = generateAnnouncementId();
      const docPath = `announcements/${id}`;
      try {
        await setDoc(doc(db, 'announcements', id), {
          ...validation.normalized,
          authorUid: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        void recordAdminAudit(
          'announcement_mutated',
          `Published announcement: ${validation.normalized.title.slice(0, 120)}`
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    },
    [cloudAnnouncements?.length, importStarterAnnouncements, recordAdminAudit]
  );

  const updateAnnouncement = useCallback(
    async (id: string, draft: AnnouncementDraft) => {
      const currentUser = auth.currentUser;
      if (!currentUser || !isPortfolioOwner(currentUser)) {
        throw new Error('Only the verified portfolio owner can edit announcements.');
      }

      const validation = validateAnnouncementDraft(draft);
      if (!validation.valid) {
        throw new Error(validation.errors[0] || 'Invalid announcement fields.');
      }

      const docPath = `announcements/${id}`;
      try {
        await updateDoc(doc(db, 'announcements', id), {
          ...validation.normalized,
          updatedAt: serverTimestamp(),
        });
        void recordAdminAudit(
          'announcement_mutated',
          `Updated announcement ${id}: ${validation.normalized.title.slice(0, 100)}`
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    },
    [recordAdminAudit]
  );

  const deleteAnnouncement = useCallback(
    async (id: string) => {
      const currentUser = auth.currentUser;
      if (!currentUser || !isPortfolioOwner(currentUser)) {
        throw new Error('Only the verified portfolio owner can delete announcements.');
      }

      const docPath = `announcements/${id}`;
      try {
        await deleteDoc(doc(db, 'announcements', id));
        void recordAdminAudit('announcement_mutated', `Deleted announcement ${id}`).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [recordAdminAudit]
  );

  const recordCvDownloadLog = useCallback(async (summary: CvTrackingSummary) => {
    const sanitized = sanitizeCvDownloadLogPayload(summary);
    if (!sanitized) return;

    const docPath = `cv_downloads/${sanitized.downloadId}`;
    try {
      await setDoc(doc(db, 'cv_downloads', sanitized.downloadId), {
        ...sanitized,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  }, []);

  const deleteCvDownloadLog = useCallback(async (downloadId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !isPortfolioOwner(currentUser)) {
      throw new Error('Only the verified portfolio owner can remove download logs.');
    }

    const docPath = `cv_downloads/${downloadId}`;
    try {
      await deleteDoc(doc(db, 'cv_downloads', downloadId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }, []);

  const recordContactMessageLog = useCallback(async (summary: ContactMessageSummary) => {
    const sanitized = sanitizeContactMessageLogPayload(summary);
    if (!sanitized) return;

    const docPath = `contact_messages/${sanitized.messageId}`;
    try {
      await setDoc(doc(db, 'contact_messages', sanitized.messageId), {
        ...sanitized,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, docPath);
    }
  }, []);

  const deleteContactMessageLog = useCallback(async (messageId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !isPortfolioOwner(currentUser)) {
      throw new Error('Only the verified portfolio owner can remove message logs.');
    }

    const docPath = `contact_messages/${messageId}`;
    try {
      await deleteDoc(doc(db, 'contact_messages', messageId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }, []);

  const updateContactMessageTriage = useCallback(
    async (
      messageId: string,
      triage: { triageStatus: ContactTriageStatus; ownerNote: string }
    ) => {
      const currentUser = auth.currentUser;
      if (!currentUser || !isPortfolioOwner(currentUser)) {
        throw new Error('Only the verified portfolio owner can triage inquiries.');
      }

      const sanitized = sanitizeContactTriageUpdate(triage);
      const docPath = `contact_messages/${messageId}`;
      try {
        await updateDoc(doc(db, 'contact_messages', messageId), {
          triageStatus: sanitized.triageStatus,
          ownerNote: sanitized.ownerNote,
          triagedAt: serverTimestamp(),
        });
        void recordAdminAudit(
          'triage_updated',
          `Triaged ${messageId} as ${sanitized.triageStatus.toUpperCase()}${
            sanitized.ownerNote ? ' with private note' : ''
          }`
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    },
    [recordAdminAudit]
  );

  const savePortfolioSettings = useCallback(
    async (next: PortfolioSettings) => {
      const currentUser = auth.currentUser;
      if (!currentUser || !isPortfolioOwner(currentUser)) {
        throw new Error('Only the verified portfolio owner can update site controls.');
      }

      const clean = sanitizePortfolioSettings(next);
      const docPath = 'portfolio_settings/global';
      try {
        await setDoc(doc(db, 'portfolio_settings', 'global'), {
          ...clean,
          updatedByUid: currentUser.uid,
          updatedAt: serverTimestamp(),
        });
        await syncOwnerPolicyToServer(currentUser, accessRules, clean);
        void recordAdminAudit(
          'settings_updated',
          `Site settings saved (maintenance=${clean.maintenanceMode}, contact=${clean.enableContactForm}, cv=${clean.enableCvDownloads}, strictOtp=${clean.strictOtpForAll})`
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      }
    },
    [accessRules, recordAdminAudit, syncOwnerPolicyToServer]
  );

  const createAccessRule = useCallback(
    async (draft: AccessRuleDraft) => {
      const currentUser = auth.currentUser;
      if (!currentUser || !isPortfolioOwner(currentUser)) {
        throw new Error('Only the verified portfolio owner can manage access rules.');
      }

      const check = validateAccessRuleDraft(draft);
      if (!check.valid || !check.normalized) {
        throw new Error(check.error || 'Invalid access rule values.');
      }

      const ruleId = generateRuleId();
      const docPath = `access_rules/${ruleId}`;
      try {
        await setDoc(doc(db, 'access_rules', ruleId), {
          ruleId,
          ...check.normalized,
          createdByUid: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        void recordAdminAudit(
          'rule_created',
          `${check.normalized.ruleType.toUpperCase()} ${check.normalized.matchType}: ${check.normalized.value}`
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    },
    [recordAdminAudit]
  );

  const deleteAccessRule = useCallback(
    async (ruleId: string) => {
      const currentUser = auth.currentUser;
      if (!currentUser || !isPortfolioOwner(currentUser)) {
        throw new Error('Only the verified portfolio owner can delete access rules.');
      }

      const target = accessRules.find((r) => r.ruleId === ruleId);
      const docPath = `access_rules/${ruleId}`;
      try {
        await deleteDoc(doc(db, 'access_rules', ruleId));
        void recordAdminAudit(
          'rule_deleted',
          `Removed ${target ? `${target.ruleType} ${target.matchType} (${target.value})` : ruleId}`
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [accessRules, recordAdminAudit]
  );

  const usingStarterFallback = (cloudAnnouncements?.length ?? 0) === 0;
  const announcements = usingStarterFallback ? STARTER_ANNOUNCEMENTS : cloudAnnouncements!;

  const value = useMemo<FirebaseContextValue>(
    () => ({
      user,
      authReady,
      isOwner,
      announcements,
      usingStarterFallback,
      loadingAnnouncements,
      cvDownloadLogs,
      loadingDownloadLogs,
      contactMessageLogs,
      loadingContactLogs,
      portfolioSettings,
      loadingSettings,
      adminAuditLogs,
      loadingAuditLogs,
      accessRules,
      loadingAccessRules,
      signInAsOwner,
      signOutOwner,
      createAnnouncement,
      updateAnnouncement,
      deleteAnnouncement,
      importStarterAnnouncements,
      recordCvDownloadLog,
      deleteCvDownloadLog,
      recordContactMessageLog,
      deleteContactMessageLog,
      updateContactMessageTriage,
      savePortfolioSettings,
      createAccessRule,
      deleteAccessRule,
    }),
    [
      user,
      authReady,
      isOwner,
      announcements,
      usingStarterFallback,
      loadingAnnouncements,
      cvDownloadLogs,
      loadingDownloadLogs,
      contactMessageLogs,
      loadingContactLogs,
      portfolioSettings,
      loadingSettings,
      adminAuditLogs,
      loadingAuditLogs,
      accessRules,
      loadingAccessRules,
      signInAsOwner,
      signOutOwner,
      createAnnouncement,
      updateAnnouncement,
      deleteAnnouncement,
      importStarterAnnouncements,
      recordCvDownloadLog,
      deleteCvDownloadLog,
      recordContactMessageLog,
      deleteContactMessageLog,
      updateContactMessageTriage,
      savePortfolioSettings,
      createAccessRule,
      deleteAccessRule,
    ]
  );

  return <FirebaseContext.Provider value={value}>{children}</FirebaseContext.Provider>;
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used within FirebaseProvider');
  }
  return ctx;
}
