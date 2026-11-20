import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  signInAsOwner: () => Promise<void>;
  signOutOwner: () => Promise<void>;
  createAnnouncement: (draft: AnnouncementDraft, importStarterIfEmpty?: boolean) => Promise<void>;
  updateAnnouncement: (id: string, draft: AnnouncementDraft) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  importStarterAnnouncements: () => Promise<void>;
  recordCvDownloadLog: (summary: CvTrackingSummary) => Promise<void>;
  deleteCvDownloadLog: (downloadId: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudAnnouncements, setCloudAnnouncements] = useState<AnnouncementRecord[] | null>(null);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [cvDownloadLogs, setCvDownloadLogs] = useState<CvDownloadLogRecord[]>([]);
  const [loadingDownloadLogs, setLoadingDownloadLogs] = useState(false);

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

  const signInAsOwner = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOutOwner = useCallback(async () => {
    await signOut(auth);
  }, []);

  const importStarterAnnouncements = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !isPortfolioOwner(currentUser)) {
      throw new Error('Only the verified portfolio owner can import starter announcements.');
    }

    const batch = writeBatch(db);
    // Commit starter announcements so they become editable/deletable in Cloud
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'announcements');
    }
  }, []);

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
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, docPath);
      }
    },
    [cloudAnnouncements?.length, importStarterAnnouncements]
  );

  const updateAnnouncement = useCallback(async (id: string, draft: AnnouncementDraft) => {
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
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  }, []);

  const deleteAnnouncement = useCallback(async (id: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !isPortfolioOwner(currentUser)) {
      throw new Error('Only the verified portfolio owner can delete announcements.');
    }

    const docPath = `announcements/${id}`;
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }, []);

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
      signInAsOwner,
      signOutOwner,
      createAnnouncement,
      updateAnnouncement,
      deleteAnnouncement,
      importStarterAnnouncements,
      recordCvDownloadLog,
      deleteCvDownloadLog,
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
      signInAsOwner,
      signOutOwner,
      createAnnouncement,
      updateAnnouncement,
      deleteAnnouncement,
      importStarterAnnouncements,
      recordCvDownloadLog,
      deleteCvDownloadLog,
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
