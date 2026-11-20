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
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
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
  signInAsOwner: () => Promise<void>;
  signOutOwner: () => Promise<void>;
  createAnnouncement: (draft: AnnouncementDraft, importStarterIfEmpty?: boolean) => Promise<void>;
  updateAnnouncement: (id: string, draft: AnnouncementDraft) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  importStarterAnnouncements: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudAnnouncements, setCloudAnnouncements] = useState<AnnouncementRecord[] | null>(null);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

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
      signInAsOwner,
      signOutOwner,
      createAnnouncement,
      updateAnnouncement,
      deleteAnnouncement,
      importStarterAnnouncements,
    }),
    [
      user,
      authReady,
      isOwner,
      announcements,
      usingStarterFallback,
      loadingAnnouncements,
      signInAsOwner,
      signOutOwner,
      createAnnouncement,
      updateAnnouncement,
      deleteAnnouncement,
      importStarterAnnouncements,
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
