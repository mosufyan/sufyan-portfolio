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
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AWARDS,
  CERTIFICATIONS,
  LINKEDIN_RECOMMENDATIONS,
  TECHNICAL_DISCIPLINES,
  WORK_EXPERIENCE,
  type Award,
  type Certification,
  type CertificationCategory,
  type CompanyExperience,
  type Recommendation,
} from '../data/portfolioData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  applyCiscoRoleOverride,
  getStaticCiscoRoleDraft,
  mergeAwards,
  mergeAwardsByOrganization,
  mergeCertificationCategories,
  mergeCertifications,
  mergeDisciplines,
  mergeRecommendations,
  type CloudAward,
  type CloudCertification,
  type CloudDiscipline,
  type CloudRecommendation,
  type TechnicalDiscipline,
} from '../utils/portfolioContentMerge';
import {
  awardDraftToRecord,
  certificationDraftToRecord,
  generatePortfolioEntityId,
  isValidPortfolioEntityId,
  recommendationDraftToRecord,
  validateAwardDraft,
  validateCertificationDraft,
  validateCiscoRoleDraft,
  validateDisciplineDraft,
  validateRecommendationDraft,
  type AwardDraft,
  type CertificationDraft,
  type CiscoRoleDraft,
  type DisciplineDraft,
  type RecommendationDraft,
} from '../utils/portfolioContentValidation';
import { useFirebase } from './FirebaseContext';

interface PortfolioContentContextValue {
  certifications: Certification[];
  certificationCategories: CertificationCategory[];
  awards: Award[];
  awardsByOrganization: ReturnType<typeof mergeAwardsByOrganization>;
  recommendations: Recommendation[];
  disciplines: TechnicalDiscipline[];
  workExperience: CompanyExperience[];
  ciscoRole: CiscoRoleDraft;
  loadingPortfolioContent: boolean;
  upsertCertification: (draft: CertificationDraft, id?: string) => Promise<string>;
  deleteCertification: (id: string) => Promise<void>;
  upsertAward: (draft: AwardDraft, id?: string) => Promise<string>;
  deleteAward: (id: string) => Promise<void>;
  upsertRecommendation: (draft: RecommendationDraft, id?: string) => Promise<string>;
  deleteRecommendation: (id: string) => Promise<void>;
  upsertDiscipline: (draft: DisciplineDraft, id?: string) => Promise<string>;
  deleteDiscipline: (id: string) => Promise<void>;
  saveCiscoRole: (draft: CiscoRoleDraft) => Promise<void>;
}

const PortfolioContentContext = createContext<PortfolioContentContextValue | null>(null);

function assertOwner(isOwner: boolean): void {
  if (!isOwner) throw new Error('Owner access required to mutate portfolio content.');
}

function stripUndefined(payload: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) next[key] = value;
  }
  return next;
}

async function upsertCloudDoc(
  collectionName: string,
  docId: string,
  payload: Record<string, unknown>,
  authorUid: string
): Promise<void> {
  const clean = stripUndefined(payload);
  const ref = doc(db, collectionName, docId);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await updateDoc(ref, {
      ...clean,
      deleted: false,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      ...clean,
      deleted: false,
      authorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

async function softOrHardDelete(
  collectionName: string,
  docId: string,
  isStaticSeed: boolean,
  seedPayload: Record<string, unknown> | null,
  authorUid: string
): Promise<void> {
  const path = `${collectionName}/${docId}`;
  try {
    if (isStaticSeed && seedPayload) {
      await setDoc(doc(db, collectionName, docId), {
        ...seedPayload,
        deleted: true,
        source: 'cloud',
        authorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function PortfolioContentProvider({ children }: { children: ReactNode }) {
  const { user, isOwner, authReady } = useFirebase();
  const [cloudCerts, setCloudCerts] = useState<CloudCertification[]>([]);
  const [cloudAwards, setCloudAwards] = useState<CloudAward[]>([]);
  const [cloudRecs, setCloudRecs] = useState<CloudRecommendation[]>([]);
  const [cloudDisciplines, setCloudDisciplines] = useState<CloudDiscipline[]>([]);
  const [ciscoRoleCloud, setCiscoRoleCloud] = useState<CiscoRoleDraft | null>(null);
  const [loadingPortfolioContent, setLoadingPortfolioContent] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    const unsubs: Array<() => void> = [];
    let pending = 5;
    const markReady = () => {
      pending -= 1;
      if (pending <= 0) setLoadingPortfolioContent(false);
    };

    unsubs.push(
      onSnapshot(
        query(collection(db, 'portfolio_certifications'), orderBy('updatedAt', 'desc')),
        (snap) => {
          setCloudCerts(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                title: String(data.title || ''),
                issuer: String(data.issuer || ''),
                issueDate: String(data.issueDate || ''),
                expiryDate: data.expiryDate ? String(data.expiryDate) : undefined,
                credentialId: data.credentialId ? String(data.credentialId) : undefined,
                credentialUrl: data.credentialUrl ? String(data.credentialUrl) : undefined,
                category: (data.category === 'ai' || data.category === 'data' ? data.category : 'cloud') as
                  | 'ai'
                  | 'cloud'
                  | 'data',
                badgeColor: String(data.badgeColor || 'border-cyan-500/40 text-cyan-300'),
                skills: Array.isArray(data.skills) ? data.skills.map(String) : [],
                source: 'cloud' as const,
                sourceAnnouncementId: data.sourceAnnouncementId
                  ? String(data.sourceAnnouncementId)
                  : undefined,
                deleted: Boolean(data.deleted),
              };
            })
          );
          markReady();
        },
        () => markReady()
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'portfolio_awards'), orderBy('updatedAt', 'desc')),
        (snap) => {
          setCloudAwards(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                title: String(data.title || ''),
                organization: String(data.organization || ''),
                date: String(data.date || ''),
                category: String(data.category || 'Recognition'),
                description: String(data.description || ''),
                associatedWith: data.associatedWith ? String(data.associatedWith) : undefined,
                source: 'cloud' as const,
                sourceAnnouncementId: data.sourceAnnouncementId
                  ? String(data.sourceAnnouncementId)
                  : undefined,
                deleted: Boolean(data.deleted),
              };
            })
          );
          markReady();
        },
        () => markReady()
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'portfolio_recommendations'), orderBy('updatedAt', 'desc')),
        (snap) => {
          setCloudRecs(
            snap.docs.map((d) => {
              const data = d.data();
              const relationshipType =
                data.relationshipType === 'manager' || data.relationshipType === 'direct_report'
                  ? data.relationshipType
                  : 'peer';
              return {
                id: d.id,
                author: String(data.author || ''),
                role: String(data.role || ''),
                date: String(data.date || ''),
                relationship: String(data.relationship || ''),
                relationshipType,
                quote: String(data.quote || ''),
                featured: Boolean(data.featured),
                source: 'cloud' as const,
                sourceAnnouncementId: data.sourceAnnouncementId
                  ? String(data.sourceAnnouncementId)
                  : undefined,
                deleted: Boolean(data.deleted),
              };
            })
          );
          markReady();
        },
        () => markReady()
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'portfolio_disciplines'), orderBy('updatedAt', 'desc')),
        (snap) => {
          setCloudDisciplines(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                title: String(data.title || ''),
                status: String(data.status || 'CUSTOM'),
                description: String(data.description || ''),
                technologies: Array.isArray(data.technologies) ? data.technologies.map(String) : [],
                level: typeof data.level === 'number' ? data.level : 90,
                source: 'cloud' as const,
                sourceAnnouncementId: data.sourceAnnouncementId
                  ? String(data.sourceAnnouncementId)
                  : undefined,
                deleted: Boolean(data.deleted),
              };
            })
          );
          markReady();
        },
        () => markReady()
      )
    );

    unsubs.push(
      onSnapshot(doc(db, 'portfolio_cisco_role', 'current'), (snap) => {
        if (!snap.exists()) {
          setCiscoRoleCloud(null);
          markReady();
          return;
        }
        const data = snap.data();
        setCiscoRoleCloud({
          domain: String(data.domain || ''),
          proofMetric: String(data.proofMetric || ''),
          recognitionBadge: String(data.recognitionBadge || ''),
          highlights: Array.isArray(data.highlights) ? data.highlights.map(String) : [],
          technologies: Array.isArray(data.technologies) ? data.technologies.map(String) : [],
          sourceAnnouncementId: data.sourceAnnouncementId
            ? String(data.sourceAnnouncementId)
            : undefined,
        });
        markReady();
      }, () => markReady())
    );

    return () => unsubs.forEach((u) => u());
  }, [authReady]);

  const certifications = useMemo(() => mergeCertifications(cloudCerts), [cloudCerts]);
  const certificationCategories = useMemo(
    () => mergeCertificationCategories(certifications),
    [certifications]
  );
  const awards = useMemo(() => mergeAwards(cloudAwards), [cloudAwards]);
  const awardsByOrganization = useMemo(() => mergeAwardsByOrganization(awards), [awards]);
  const recommendations = useMemo(() => mergeRecommendations(cloudRecs), [cloudRecs]);
  const disciplines = useMemo(() => mergeDisciplines(cloudDisciplines), [cloudDisciplines]);
  const ciscoRole = useMemo(
    () => ciscoRoleCloud || getStaticCiscoRoleDraft(),
    [ciscoRoleCloud]
  );
  const workExperience = useMemo(
    () => applyCiscoRoleOverride(WORK_EXPERIENCE, ciscoRoleCloud),
    [ciscoRoleCloud]
  );

  const upsertCertification = useCallback(
    async (draft: CertificationDraft, id?: string) => {
      assertOwner(isOwner);
      const validation = validateCertificationDraft(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      const docId = id && isValidPortfolioEntityId(id) ? id : generatePortfolioEntityId('cert');
      const record = certificationDraftToRecord(docId, validation.normalized);
      try {
        await upsertCloudDoc(
          'portfolio_certifications',
          docId,
          { ...record, sourceAnnouncementId: validation.normalized.sourceAnnouncementId || '' },
          user?.uid || ''
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `portfolio_certifications/${docId}`);
      }
      return docId;
    },
    [isOwner, user?.uid]
  );

  const deleteCertification = useCallback(
    async (id: string) => {
      assertOwner(isOwner);
      const seed = CERTIFICATIONS.find((c) => c.id === id) || null;
      await softOrHardDelete(
        'portfolio_certifications',
        id,
        Boolean(seed),
        seed
          ? {
              id: seed.id,
              title: seed.title,
              issuer: seed.issuer,
              issueDate: seed.issueDate,
              expiryDate: seed.expiryDate || '',
              credentialId: seed.credentialId || '',
              credentialUrl: seed.credentialUrl || '',
              category: seed.category,
              badgeColor: seed.badgeColor,
              skills: seed.skills,
            }
          : null,
        user?.uid || ''
      );
    },
    [isOwner, user?.uid]
  );

  const upsertAward = useCallback(
    async (draft: AwardDraft, id?: string) => {
      assertOwner(isOwner);
      const validation = validateAwardDraft(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      const docId = id && isValidPortfolioEntityId(id) ? id : generatePortfolioEntityId('award');
      const record = awardDraftToRecord(docId, validation.normalized);
      try {
        await upsertCloudDoc(
          'portfolio_awards',
          docId,
          {
            ...record,
            associatedWith: record.associatedWith || '',
            sourceAnnouncementId: validation.normalized.sourceAnnouncementId || '',
          },
          user?.uid || ''
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `portfolio_awards/${docId}`);
      }
      return docId;
    },
    [isOwner, user?.uid]
  );

  const deleteAward = useCallback(
    async (id: string) => {
      assertOwner(isOwner);
      const seed = AWARDS.find((a) => a.id === id) || null;
      await softOrHardDelete(
        'portfolio_awards',
        id,
        Boolean(seed),
        seed
          ? {
              id: seed.id,
              title: seed.title,
              organization: seed.organization,
              date: seed.date,
              category: seed.category,
              description: seed.description,
              associatedWith: seed.associatedWith || '',
            }
          : null,
        user?.uid || ''
      );
    },
    [isOwner, user?.uid]
  );

  const upsertRecommendation = useCallback(
    async (draft: RecommendationDraft, id?: string) => {
      assertOwner(isOwner);
      const validation = validateRecommendationDraft(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      const docId = id && isValidPortfolioEntityId(id) ? id : generatePortfolioEntityId('rec');
      const record = recommendationDraftToRecord(docId, validation.normalized);
      try {
        await upsertCloudDoc(
          'portfolio_recommendations',
          docId,
          {
            ...record,
            featured: Boolean(record.featured),
            sourceAnnouncementId: validation.normalized.sourceAnnouncementId || '',
          },
          user?.uid || ''
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `portfolio_recommendations/${docId}`);
      }
      return docId;
    },
    [isOwner, user?.uid]
  );

  const deleteRecommendation = useCallback(
    async (id: string) => {
      assertOwner(isOwner);
      const seed = LINKEDIN_RECOMMENDATIONS.find((r) => r.id === id) || null;
      await softOrHardDelete(
        'portfolio_recommendations',
        id,
        Boolean(seed),
        seed
          ? {
              id: seed.id,
              author: seed.author,
              role: seed.role,
              date: seed.date,
              relationship: seed.relationship,
              relationshipType: seed.relationshipType,
              quote: seed.quote,
              featured: Boolean(seed.featured),
            }
          : null,
        user?.uid || ''
      );
    },
    [isOwner, user?.uid]
  );

  const upsertDiscipline = useCallback(
    async (draft: DisciplineDraft, id?: string) => {
      assertOwner(isOwner);
      const validation = validateDisciplineDraft(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      const docId = id && isValidPortfolioEntityId(id) ? id : generatePortfolioEntityId('disc');
      try {
        await upsertCloudDoc(
          'portfolio_disciplines',
          docId,
          {
            id: docId,
            ...validation.normalized,
            sourceAnnouncementId: validation.normalized.sourceAnnouncementId || '',
            source: 'cloud',
          },
          user?.uid || ''
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `portfolio_disciplines/${docId}`);
      }
      return docId;
    },
    [isOwner, user?.uid]
  );

  const deleteDiscipline = useCallback(
    async (id: string) => {
      assertOwner(isOwner);
      const seed = TECHNICAL_DISCIPLINES.find((d) => d.id === id) || null;
      await softOrHardDelete(
        'portfolio_disciplines',
        id,
        Boolean(seed),
        seed
          ? {
              id: seed.id,
              title: seed.title,
              status: seed.status,
              description: seed.description,
              technologies: seed.technologies,
              level: seed.level,
            }
          : null,
        user?.uid || ''
      );
    },
    [isOwner, user?.uid]
  );

  const saveCiscoRole = useCallback(
    async (draft: CiscoRoleDraft) => {
      assertOwner(isOwner);
      const validation = validateCiscoRoleDraft(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      try {
        await upsertCloudDoc(
          'portfolio_cisco_role',
          'current',
          {
            ...validation.normalized,
            sourceAnnouncementId: validation.normalized.sourceAnnouncementId || '',
          },
          user?.uid || ''
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'portfolio_cisco_role/current');
      }
    },
    [isOwner, user?.uid]
  );

  const value = useMemo<PortfolioContentContextValue>(
    () => ({
      certifications,
      certificationCategories,
      awards,
      awardsByOrganization,
      recommendations,
      disciplines,
      workExperience,
      ciscoRole,
      loadingPortfolioContent,
      upsertCertification,
      deleteCertification,
      upsertAward,
      deleteAward,
      upsertRecommendation,
      deleteRecommendation,
      upsertDiscipline,
      deleteDiscipline,
      saveCiscoRole,
    }),
    [
      awards,
      awardsByOrganization,
      certificationCategories,
      certifications,
      ciscoRole,
      deleteAward,
      deleteCertification,
      deleteDiscipline,
      deleteRecommendation,
      disciplines,
      loadingPortfolioContent,
      recommendations,
      saveCiscoRole,
      upsertAward,
      upsertCertification,
      upsertDiscipline,
      upsertRecommendation,
      workExperience,
    ]
  );

  return (
    <PortfolioContentContext.Provider value={value}>{children}</PortfolioContentContext.Provider>
  );
}

export function usePortfolioContent(): PortfolioContentContextValue {
  const ctx = useContext(PortfolioContentContext);
  if (!ctx) {
    throw new Error('usePortfolioContent must be used within PortfolioContentProvider');
  }
  return ctx;
}
