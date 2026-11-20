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
  where,
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
  isAnnouncementPubliclyVisible,
  isPortfolioOwner,
  type AnnouncementBadge,
  type AnnouncementDraft,
  type AnnouncementRecord,
  type AnnouncementStatus,
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
  sanitizeLeadCrmFields,
  type ContactMessageLogRecord,
  type ContactMessageSummary,
  type ContactTriageStatus,
  type LeadCrmFields,
} from '../utils/contactMessageLogValidation';
import {
  DEFAULT_PORTFOLIO_SETTINGS,
  generateRuleId,
  getEffectivePortfolioSettings,
  sanitizeAdminAuditPayload,
  sanitizePortfolioSettings,
  toPublicPortfolioSettings,
  validateAccessRuleDraft,
  validateAdminDelegateDraft,
  type AccessRuleDraft,
  type AccessRuleMatchType,
  type AccessRuleRecord,
  type AccessRuleType,
  type AdminAuditEventType,
  type AdminAuditLogRecord,
  type AdminDelegateDraft,
  type AdminDelegateRecord,
  type PortfolioSettings,
} from '../utils/ownerGovernance';

const STARTER_ANNOUNCEMENTS: AnnouncementRecord[] = ANNOUNCEMENTS.map((item) => ({
  id: item.id,
  date: item.date,
  title: item.title,
  summary: item.summary,
  badge: 'VERIFIED',
  linkUrl: '',
  status: 'published' as const,
  scheduledAtMs: null,
  source: 'starter',
}));

function triageNoteWithReply(existingNote: string, replyBody: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const snippet = replyBody.trim().slice(0, 220);
  const line = `[Reply ${stamp}] ${snippet}`;
  const merged = existingNote.trim() ? `${existingNote.trim()}\n${line}` : line;
  return merged.slice(0, 1000);
}

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  isOwner: boolean;
  isPrimaryOwner: boolean;
  announcements: AnnouncementRecord[];
  usingStarterFallback: boolean;
  loadingAnnouncements: boolean;
  cvDownloadLogs: CvDownloadLogRecord[];
  loadingDownloadLogs: boolean;
  contactMessageLogs: ContactMessageLogRecord[];
  loadingContactLogs: boolean;
  portfolioSettings: PortfolioSettings;
  effectivePortfolioSettings: PortfolioSettings;
  loadingSettings: boolean;
  adminAuditLogs: AdminAuditLogRecord[];
  loadingAuditLogs: boolean;
  accessRules: AccessRuleRecord[];
  loadingAccessRules: boolean;
  adminDelegates: AdminDelegateRecord[];
  loadingDelegates: boolean;
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
    triage: { triageStatus: ContactTriageStatus; ownerNote: string } & Partial<LeadCrmFields>
  ) => Promise<void>;
  replyToContactMessage: (
    messageId: string,
    reply: { subject: string; body: string; markReplied?: boolean }
  ) => Promise<void>;
  savePortfolioSettings: (next: PortfolioSettings) => Promise<void>;
  createAccessRule: (draft: AccessRuleDraft) => Promise<void>;
  deleteAccessRule: (ruleId: string) => Promise<void>;
  addAdminDelegate: (draft: AdminDelegateDraft) => Promise<void>;
  removeAdminDelegate: (uid: string) => Promise<void>;
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
  const [adminDelegates, setAdminDelegates] = useState<AdminDelegateRecord[]>([]);
  const [loadingDelegates, setLoadingDelegates] = useState(false);
  const [isDelegateAdmin, setIsDelegateAdmin] = useState(false);
  const lastPolicyDigestRef = useRef<string>('');
  const ownerAccessRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const isPrimaryOwner = isPortfolioOwner(user);

  // Visitors subscribe to portfolio_settings/public (UX flags only).
  useEffect(() => {
    if (!authReady) return;

    const unsubscribe = onSnapshot(
      doc(db, 'portfolio_settings', 'public'),
      (docSnap) => {
        if (docSnap.exists()) {
          setPortfolioSettings((prev) =>
            sanitizePortfolioSettings({
              ...prev,
              ...(docSnap.data() as Partial<PortfolioSettings>),
            })
          );
        }
        setLoadingSettings(false);
      },
      (error) => {
        setLoadingSettings(false);
        console.warn('Public portfolio settings unavailable:', error);
      }
    );

    return () => unsubscribe();
  }, [authReady]);

  // Primary owner also loads portfolio_settings/global (full policy including caps/alerts).
  useEffect(() => {
    if (!authReady || !isPrimaryOwner) return;

    const path = 'portfolio_settings/global';
    const unsubscribe = onSnapshot(
      doc(db, 'portfolio_settings', 'global'),
      (docSnap) => {
        if (docSnap.exists()) {
          setPortfolioSettings(sanitizePortfolioSettings(docSnap.data() as Partial<PortfolioSettings>));
        }
        setLoadingSettings(false);
      },
      (error) => {
        setLoadingSettings(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [authReady, isPrimaryOwner]);

  // Secondary admin: listen to admins/{uid} for console access when not primary owner
  useEffect(() => {
    if (!authReady || !user || isPrimaryOwner) {
      setIsDelegateAdmin(false);
      return;
    }
    const path = `admins/${user.uid}`;
    const unsubscribe = onSnapshot(
      doc(db, 'admins', user.uid),
      (snap) => {
        setIsDelegateAdmin(snap.exists());
      },
      (error) => {
        setIsDelegateAdmin(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return () => unsubscribe();
  }, [authReady, user, isPrimaryOwner]);

  const isOwner = isPrimaryOwner || isDelegateAdmin;
  ownerAccessRef.current = isOwner;

  useEffect(() => {
    if (!authReady) return;

    const path = 'announcements';
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    const mapDoc = (docSnap: { id: string; data: () => Record<string, unknown> }): AnnouncementRecord => {
      const data = docSnap.data();
      const statusRaw = typeof data.status === 'string' ? data.status : 'published';
      const status: AnnouncementStatus =
        statusRaw === 'draft' || statusRaw === 'scheduled' || statusRaw === 'published'
          ? statusRaw
          : 'published';
      const scheduledAtMs =
        typeof data.scheduledAtMs === 'number' && Number.isFinite(data.scheduledAtMs) && data.scheduledAtMs > 0
          ? Math.floor(data.scheduledAtMs)
          : null;
      return {
        id: docSnap.id,
        date: typeof data.date === 'string' ? data.date : '',
        title: typeof data.title === 'string' ? data.title : '',
        summary: typeof data.summary === 'string' ? data.summary : '',
        badge: (typeof data.badge === 'string' ? data.badge : 'VERIFIED') as AnnouncementBadge,
        linkUrl: typeof data.linkUrl === 'string' ? data.linkUrl : '',
        status,
        scheduledAtMs,
        source: 'cloud',
      };
    };

    if (isOwner) {
      // Full collection for owners; migrate legacy missing status and auto-publish due scheduled.
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      unsubs.push(
        onSnapshot(
          q,
          (snapshot) => {
            if (cancelled) return;
            void (async () => {
              try {
                const now = Date.now();
                const batch = writeBatch(db);
                let ops = 0;
                for (const docSnap of snapshot.docs) {
                  const data = docSnap.data();
                  const ref = doc(db, path, docSnap.id);
                  if (data.status == null || data.status === '') {
                    batch.update(ref, {
                      status: 'published',
                      updatedAt: serverTimestamp(),
                    });
                    ops += 1;
                  } else if (
                    data.status === 'scheduled' &&
                    typeof data.scheduledAtMs === 'number' &&
                    data.scheduledAtMs <= now
                  ) {
                    batch.update(ref, {
                      status: 'published',
                      updatedAt: serverTimestamp(),
                    });
                    ops += 1;
                  }
                  if (ops >= 400) break;
                }
                if (ops > 0) await batch.commit();
              } catch (err) {
                console.warn('Announcement status migration skipped:', err);
              }
            })();

            setCloudAnnouncements(snapshot.docs.map(mapDoc));
            setLoadingAnnouncements(false);
          },
          (error) => {
            setLoadingAnnouncements(false);
            setCloudAnnouncements((prev) => prev ?? []);
            handleFirestoreError(error, OperationType.GET, path);
          }
        )
      );
    } else {
      // Public: published query + due-scheduled query (rules allow both via isPubliclyVisibleAnnouncement).
      const publishedById = new Map<string, AnnouncementRecord>();
      const scheduledById = new Map<string, AnnouncementRecord>();

      const publishMerged = () => {
        if (cancelled) return;
        const merged = new Map<string, AnnouncementRecord>();
        for (const item of publishedById.values()) merged.set(item.id, item);
        for (const item of scheduledById.values()) {
          if (!merged.has(item.id)) {
            merged.set(item.id, { ...item, status: 'published' });
          }
        }
        const list = Array.from(merged.values()).sort((a, b) => {
          const aMs = a.scheduledAtMs || 0;
          const bMs = b.scheduledAtMs || 0;
          return bMs - aMs;
        });
        setCloudAnnouncements(list);
        setLoadingAnnouncements(false);
      };

      const publishedQ = query(
        collection(db, path),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc')
      );
      const dueScheduledQ = query(
        collection(db, path),
        where('status', '==', 'scheduled'),
        where('scheduledAtMs', '<=', Date.now()),
        orderBy('scheduledAtMs', 'desc')
      );

      unsubs.push(
        onSnapshot(
          publishedQ,
          (snapshot) => {
            publishedById.clear();
            for (const item of snapshot.docs.map(mapDoc)) publishedById.set(item.id, item);
            publishMerged();
          },
          (error) => {
            setLoadingAnnouncements(false);
            setCloudAnnouncements((prev) => prev ?? []);
            handleFirestoreError(error, OperationType.GET, path);
          }
        )
      );
      unsubs.push(
        onSnapshot(
          dueScheduledQ,
          (snapshot) => {
            scheduledById.clear();
            for (const item of snapshot.docs.map(mapDoc)) scheduledById.set(item.id, item);
            publishMerged();
          },
          (error) => {
            // Index may still be building; published query alone covers most traffic.
            console.warn('Due-scheduled announcements query unavailable:', error);
            scheduledById.clear();
            publishMerged();
          }
        )
      );
    }

    return () => {
      cancelled = true;
      for (const unsub of unsubs) unsub();
    };
  }, [authReady, isOwner]);

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
            ...sanitizeLeadCrmFields({
              leadCompany: typeof d.leadCompany === 'string' ? d.leadCompany : '',
              leadRole: typeof d.leadRole === 'string' ? d.leadRole : '',
              leadSource: d.leadSource,
              leadPriority: d.leadPriority,
              leadNextAction: typeof d.leadNextAction === 'string' ? d.leadNextAction : '',
              leadNextActionDueAtMs:
                typeof d.leadNextActionDueAtMs === 'number' ? d.leadNextActionDueAtMs : null,
              leadOutcome: d.leadOutcome,
            }),
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
      const effective = getEffectivePortfolioSettings(settings);
      const payload = {
        rules: rules.map((r) => ({
          ruleType: r.ruleType,
          matchType: r.matchType,
          value: r.value,
          note: r.note,
        })),
        strictOtpForAll: effective.strictOtpForAll,
        enableContactForm: effective.enableContactForm,
        enableCvDownloads: effective.enableCvDownloads,
        enablePwaInstall: effective.enablePwaInstall,
        enableSiteTelemetry: effective.enableSiteTelemetry,
        incidentMode: settings.incidentMode,
        notifyOnNewInquiry: settings.notifyOnNewInquiry,
        enablePortfolioChat: effective.enablePortfolioChat,
        enableLiveChat: effective.enableLiveChat,
        enableChatLlm: effective.enableChatLlm,
        chatMaxQuestionsPerVisitor: settings.chatMaxQuestionsPerVisitor,
        chatMaxLlmPerVisitor: settings.chatMaxLlmPerVisitor,
        chatMaxLiveSessionsPerVisitor: settings.chatMaxLiveSessionsPerVisitor,
        chatRateWindowHours: settings.chatRateWindowHours,
        chatLlmModel: settings.chatLlmModel,
        chatShowSuggestions: settings.chatShowSuggestions,
        chatOfferLiveAgent: settings.chatOfferLiveAgent,
        alertEmailEnabled: settings.alertEmailEnabled,
        alertEmailUrgent: settings.alertEmailUrgent,
        alertEmailWarning: settings.alertEmailWarning,
        alertEmailDigest: settings.alertEmailDigest,
        alertClassNewInquiry: settings.alertClassNewInquiry,
        alertClassLiveChat: settings.alertClassLiveChat,
        alertClassRiskDownload: settings.alertClassRiskDownload,
        alertClassUnusualTraffic: settings.alertClassUnusualTraffic,
        alertClassChatLimit: settings.alertClassChatLimit,
        alertClassOverdueCrm: settings.alertClassOverdueCrm,
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

  const assertOwnerActor = useCallback((): User => {
    const actor = auth.currentUser;
    if (!actor || !ownerAccessRef.current) {
      throw new Error('Only a verified portfolio owner or delegate admin can perform this action.');
    }
    return actor;
  }, []);

  const recordAdminAudit = useCallback(
    async (eventType: AdminAuditEventType, summary: string, actorOverride?: User | null) => {
      const actor = actorOverride ?? auth.currentUser;
      if (!actor || !(isPortfolioOwner(actor) || ownerAccessRef.current)) return;

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
    const currentUser = assertOwnerActor();

    const batch = writeBatch(db);
    for (const starter of STARTER_ANNOUNCEMENTS) {
      const check = validateAnnouncementDraft(starter);
      if (!check.valid) continue;
      batch.set(doc(db, 'announcements', starter.id), {
        ...check.normalized,
        scheduledAtMs: check.normalized.scheduledAtMs ?? 0,
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
  }, [assertOwnerActor, recordAdminAudit]);

  const createAnnouncement = useCallback(
    async (draft: AnnouncementDraft, importStarterIfEmpty = true) => {
      const currentUser = assertOwnerActor();

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
          scheduledAtMs: validation.normalized.scheduledAtMs ?? 0,
          authorUid: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        void recordAdminAudit(
          'announcement_mutated',
          `${validation.normalized.status === 'published' ? 'Published' : 'Saved'} announcement: ${validation.normalized.title.slice(0, 120)}`
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    },
    [assertOwnerActor, cloudAnnouncements?.length, importStarterAnnouncements, recordAdminAudit]
  );

  const updateAnnouncement = useCallback(
    async (id: string, draft: AnnouncementDraft) => {
      assertOwnerActor();

      const validation = validateAnnouncementDraft(draft);
      if (!validation.valid) {
        throw new Error(validation.errors[0] || 'Invalid announcement fields.');
      }

      const docPath = `announcements/${id}`;
      try {
        await updateDoc(doc(db, 'announcements', id), {
          date: validation.normalized.date,
          title: validation.normalized.title,
          summary: validation.normalized.summary,
          badge: validation.normalized.badge,
          linkUrl: validation.normalized.linkUrl,
          status: validation.normalized.status,
          scheduledAtMs: validation.normalized.scheduledAtMs ?? 0,
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
    [assertOwnerActor, recordAdminAudit]
  );

  const deleteAnnouncement = useCallback(
    async (id: string) => {
      assertOwnerActor();

      const docPath = `announcements/${id}`;
      try {
        await deleteDoc(doc(db, 'announcements', id));
        void recordAdminAudit('announcement_mutated', `Deleted announcement ${id}`).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [assertOwnerActor, recordAdminAudit]
  );

  const recordCvDownloadLog = useCallback(async (summary: CvTrackingSummary) => {
    const sanitized = sanitizeCvDownloadLogPayload(summary);
    if (!sanitized) return;

    // Client creates are denied — Admin SDK / server persists after OTP.
    // Keep this as a soft no-op fallback for older clients.
    try {
      await setDoc(doc(db, 'cv_downloads', sanitized.downloadId), {
        ...sanitized,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code || '')
          : '';
      if (code.includes('permission-denied')) return;
      console.warn('CV download log client write skipped:', error);
    }
  }, []);

  const deleteCvDownloadLog = useCallback(async (downloadId: string) => {
    assertOwnerActor();

    const docPath = `cv_downloads/${downloadId}`;
    try {
      await deleteDoc(doc(db, 'cv_downloads', downloadId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }, [assertOwnerActor]);

  const recordContactMessageLog = useCallback(async (summary: ContactMessageSummary) => {
    const sanitized = sanitizeContactMessageLogPayload(summary);
    if (!sanitized) return;

    // Client creates are denied — Admin SDK / server persists after OTP.
    try {
      await setDoc(doc(db, 'contact_messages', sanitized.messageId), {
        ...sanitized,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code || '')
          : '';
      if (code.includes('permission-denied')) return;
      console.warn('Contact message log client write skipped:', error);
    }
  }, []);

  const deleteContactMessageLog = useCallback(async (messageId: string) => {
    assertOwnerActor();

    const docPath = `contact_messages/${messageId}`;
    try {
      await deleteDoc(doc(db, 'contact_messages', messageId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }, [assertOwnerActor]);

  const updateContactMessageTriage = useCallback(
    async (
      messageId: string,
      triage: { triageStatus: ContactTriageStatus; ownerNote: string } & Partial<LeadCrmFields>
    ) => {
      assertOwnerActor();
      const existing = contactMessageLogs.find((m) => m.messageId === messageId);
      const sanitized = sanitizeContactTriageUpdate({
        triageStatus: triage.triageStatus,
        ownerNote: triage.ownerNote,
        leadCompany: triage.leadCompany ?? existing?.leadCompany,
        leadRole: triage.leadRole ?? existing?.leadRole,
        leadSource: triage.leadSource ?? existing?.leadSource,
        leadPriority: triage.leadPriority ?? existing?.leadPriority,
        leadNextAction: triage.leadNextAction ?? existing?.leadNextAction,
        leadNextActionDueAtMs:
          triage.leadNextActionDueAtMs !== undefined
            ? triage.leadNextActionDueAtMs
            : existing?.leadNextActionDueAtMs,
        leadOutcome: triage.leadOutcome ?? existing?.leadOutcome,
      });
      const docPath = `contact_messages/${messageId}`;
      try {
        await updateDoc(doc(db, 'contact_messages', messageId), {
          triageStatus: sanitized.triageStatus,
          ownerNote: sanitized.ownerNote,
          leadCompany: sanitized.leadCompany,
          leadRole: sanitized.leadRole,
          leadSource: sanitized.leadSource,
          leadPriority: sanitized.leadPriority,
          leadNextAction: sanitized.leadNextAction,
          leadNextActionDueAtMs: sanitized.leadNextActionDueAtMs ?? 0,
          leadOutcome: sanitized.leadOutcome,
          triagedAt: serverTimestamp(),
        });
        void recordAdminAudit(
          'triage_updated',
          `Triaged ${messageId} as ${sanitized.triageStatus.toUpperCase()}${
            sanitized.leadPriority ? ` [${sanitized.leadPriority}]` : ''
          }${sanitized.ownerNote ? ' with private note' : ''}`
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    },
    [assertOwnerActor, contactMessageLogs, recordAdminAudit]
  );

  const replyToContactMessage = useCallback(
    async (
      messageId: string,
      reply: { subject: string; body: string; markReplied?: boolean }
    ) => {
      const currentUser = assertOwnerActor();
      const target = contactMessageLogs.find((m) => m.messageId === messageId);
      if (!target) {
        throw new Error('Inquiry not found in the current console session.');
      }

      const subject = reply.subject.trim().slice(0, 200);
      const body = reply.body.trim().slice(0, 5000);
      if (subject.length < 3 || body.length < 3) {
        throw new Error('Reply subject and body must be at least 3 characters.');
      }

      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/owner/reply-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          messageId,
          toEmail: target.senderEmail,
          toName: target.senderName,
          subject,
          body,
          originalSubject: target.subject,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error || 'Unable to send reply email.');
      }

      if (reply.markReplied !== false) {
        await updateContactMessageTriage(messageId, {
          triageStatus: 'replied',
          ownerNote: triageNoteWithReply(target.ownerNote, body),
        });
      }

      void recordAdminAudit(
        'owner_reply_sent',
        `Replied to ${target.senderEmail} (${messageId})`
      ).catch(() => {});
    },
    [assertOwnerActor, contactMessageLogs, recordAdminAudit, updateContactMessageTriage]
  );

  const savePortfolioSettings = useCallback(
    async (next: PortfolioSettings) => {
      const currentUser = assertOwnerActor();
      if (!isPortfolioOwner(currentUser)) {
        throw new Error('Only the primary portfolio owner can update site controls.');
      }

      const previousIncident = portfolioSettings.incidentMode;
      const clean = sanitizePortfolioSettings(next);
      const docPath = 'portfolio_settings/global';
      try {
        await setDoc(doc(db, 'portfolio_settings', 'global'), {
          ...clean,
          updatedByUid: currentUser.uid,
          updatedAt: serverTimestamp(),
        });
        // Visitor-readable UX slice (no alert routing / rate caps / LLM model).
        await setDoc(doc(db, 'portfolio_settings', 'public'), {
          ...toPublicPortfolioSettings(clean),
          updatedByUid: currentUser.uid,
          updatedAt: serverTimestamp(),
        });
        await syncOwnerPolicyToServer(currentUser, accessRules, clean);
        void recordAdminAudit(
          'settings_updated',
          `Site settings saved (incident=${clean.incidentMode}, maintenance=${clean.maintenanceMode}, contact=${clean.enableContactForm}, cv=${clean.enableCvDownloads}, strictOtp=${clean.strictOtpForAll}, alerts=${clean.notifyOnNewInquiry}, chat=${clean.enablePortfolioChat}, llm=${clean.enableChatLlm}, maxQ=${clean.chatMaxQuestionsPerVisitor})`
        ).catch(() => {});
        if (previousIncident !== clean.incidentMode) {
          void recordAdminAudit(
            'incident_mode_toggled',
            clean.incidentMode ? 'Incident mode ENABLED' : 'Incident mode DISABLED'
          ).catch(() => {});
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      }
    },
    [accessRules, assertOwnerActor, portfolioSettings.incidentMode, recordAdminAudit, syncOwnerPolicyToServer]
  );

  const createAccessRule = useCallback(
    async (draft: AccessRuleDraft) => {
      const currentUser = assertOwnerActor();
      if (!isPortfolioOwner(currentUser)) {
        throw new Error('Only the primary portfolio owner can create access rules.');
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
    [assertOwnerActor, recordAdminAudit]
  );

  const deleteAccessRule = useCallback(
    async (ruleId: string) => {
      const currentUser = assertOwnerActor();
      if (!isPortfolioOwner(currentUser)) {
        throw new Error('Only the primary portfolio owner can delete access rules.');
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
    [accessRules, assertOwnerActor, recordAdminAudit]
  );

  // Primary owner can list/manage delegate admins
  useEffect(() => {
    if (!authReady || !isPrimaryOwner) {
      setAdminDelegates([]);
      setLoadingDelegates(false);
      return;
    }

    setLoadingDelegates(true);
    const path = 'admins';
    const unsubscribe = onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items: AdminDelegateRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const ts = d.createdAt as Timestamp | undefined;
          const ms = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now();
          return {
            uid: typeof d.uid === 'string' ? d.uid : docSnap.id,
            email: typeof d.email === 'string' ? d.email : '',
            role: 'admin',
            createdByUid: typeof d.createdByUid === 'string' ? d.createdByUid : '',
            createdAtMs: ms,
            createdAtIso: new Date(ms).toISOString(),
          };
        });
        setAdminDelegates(items);
        setLoadingDelegates(false);
      },
      (error) => {
        setLoadingDelegates(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    return () => unsubscribe();
  }, [authReady, isPrimaryOwner]);

  const addAdminDelegate = useCallback(
    async (draft: AdminDelegateDraft) => {
      const currentUser = assertOwnerActor();
      if (!isPortfolioOwner(currentUser)) {
        throw new Error('Only the primary portfolio owner can manage delegate admins.');
      }
      const check = validateAdminDelegateDraft(draft);
      if (!check.valid || !check.normalized) {
        throw new Error(check.error || 'Invalid delegate values.');
      }
      if (check.normalized.email === currentUser.email?.toLowerCase()) {
        throw new Error('Primary owner is already an admin.');
      }

      const docPath = `admins/${check.normalized.uid}`;
      try {
        await setDoc(doc(db, 'admins', check.normalized.uid), {
          uid: check.normalized.uid,
          email: check.normalized.email,
          role: 'admin',
          createdByUid: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        void recordAdminAudit(
          'delegate_added',
          `Added delegate admin ${check.normalized.email}`
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    },
    [assertOwnerActor, recordAdminAudit]
  );

  const removeAdminDelegate = useCallback(
    async (uid: string) => {
      const currentUser = assertOwnerActor();
      if (!isPortfolioOwner(currentUser)) {
        throw new Error('Only the primary portfolio owner can manage delegate admins.');
      }
      const target = adminDelegates.find((d) => d.uid === uid);
      const docPath = `admins/${uid}`;
      try {
        await deleteDoc(doc(db, 'admins', uid));
        void recordAdminAudit(
          'delegate_removed',
          `Removed delegate admin ${target?.email || uid}`
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    },
    [adminDelegates, assertOwnerActor, recordAdminAudit]
  );

  const usingStarterFallback = (cloudAnnouncements?.length ?? 0) === 0;
  const allAnnouncements = usingStarterFallback ? STARTER_ANNOUNCEMENTS : cloudAnnouncements!;
  const announcements = useMemo(() => {
    if (isOwner) return allAnnouncements;
    return allAnnouncements.filter((item) => isAnnouncementPubliclyVisible(item));
  }, [allAnnouncements, isOwner]);

  const effectivePortfolioSettings = useMemo(
    () => getEffectivePortfolioSettings(portfolioSettings),
    [portfolioSettings]
  );

  const value = useMemo<FirebaseContextValue>(
    () => ({
      user,
      authReady,
      isOwner,
      isPrimaryOwner,
      announcements,
      usingStarterFallback,
      loadingAnnouncements,
      cvDownloadLogs,
      loadingDownloadLogs,
      contactMessageLogs,
      loadingContactLogs,
      portfolioSettings,
      effectivePortfolioSettings,
      loadingSettings,
      adminAuditLogs,
      loadingAuditLogs,
      accessRules,
      loadingAccessRules,
      adminDelegates,
      loadingDelegates,
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
      replyToContactMessage,
      savePortfolioSettings,
      createAccessRule,
      deleteAccessRule,
      addAdminDelegate,
      removeAdminDelegate,
    }),
    [
      user,
      authReady,
      isOwner,
      isPrimaryOwner,
      announcements,
      usingStarterFallback,
      loadingAnnouncements,
      cvDownloadLogs,
      loadingDownloadLogs,
      contactMessageLogs,
      loadingContactLogs,
      portfolioSettings,
      effectivePortfolioSettings,
      loadingSettings,
      adminAuditLogs,
      loadingAuditLogs,
      accessRules,
      loadingAccessRules,
      adminDelegates,
      loadingDelegates,
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
      replyToContactMessage,
      savePortfolioSettings,
      createAccessRule,
      deleteAccessRule,
      addAdminDelegate,
      removeAdminDelegate,
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
