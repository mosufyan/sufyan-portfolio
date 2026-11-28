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
  where,
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
  applyExperienceOverrides,
  experienceDraftToCiscoRole,
  getAllStaticCompanyExperienceDrafts,
  getStaticCiscoRoleDraft,
  getStaticCompanyExperienceDraft,
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
  EXPERIENCE_COMPANY_KEYS,
  generatePortfolioEntityId,
  isValidPortfolioEntityId,
  recommendationDraftToRecord,
  sanitizeExperienceRoleDraft,
  validateAwardDraft,
  validateCertificationDraft,
  validateCiscoRoleDraft,
  validateCompanyExperienceDraft,
  validateDisciplineDraft,
  validateRecommendationDraft,
  type AwardDraft,
  type CertificationDraft,
  type CiscoRoleDraft,
  type CompanyExperienceDraft,
  type DisciplineDraft,
  type ExperienceCompanyKey,
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
  /** Effective drafts per company (cloud override or static seed). */
  companyExperience: Record<ExperienceCompanyKey, CompanyExperienceDraft>;
  /** Convenience: Cisco first-role view (legacy + announcements). */
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
  saveCompanyExperience: (draft: CompanyExperienceDraft) => Promise<void>;
  /** Updates Cisco company role 0 via portfolio_experience/cisco (and legacy doc). */
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
  authorUid: string
): Promise<void> {
  const path = `${collectionName}/${docId}`;
  try {
    // Prefer seed-hide markers over content tombstones so soft-deleted bodies
    // are not world-readable via public list/get.
    if (isStaticSeed) {
      const hideId = `${collectionName}__${docId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      await setDoc(doc(db, 'portfolio_seed_hides', hideId), {
        collection: collectionName,
        entityId: docId,
        authorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await deleteDoc(doc(db, collectionName, docId)).catch(() => {
      /* cloud override may not exist for pure seed hides */
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function publicCmsQuery(collectionName: string) {
  return query(
    collection(db, collectionName),
    where('deleted', '==', false),
    orderBy('updatedAt', 'desc')
  );
}

export function PortfolioContentProvider({ children }: { children: ReactNode }) {
  const { user, isOwner, authReady, recordAdminAudit } = useFirebase();
  const [cloudCerts, setCloudCerts] = useState<CloudCertification[]>([]);
  const [cloudAwards, setCloudAwards] = useState<CloudAward[]>([]);
  const [cloudRecs, setCloudRecs] = useState<CloudRecommendation[]>([]);
  const [cloudDisciplines, setCloudDisciplines] = useState<CloudDiscipline[]>([]);
  const [hiddenSeeds, setHiddenSeeds] = useState<Record<string, string[]>>({
    portfolio_certifications: [],
    portfolio_awards: [],
    portfolio_recommendations: [],
    portfolio_disciplines: [],
  });
  const [cloudExperience, setCloudExperience] = useState<
    Partial<Record<ExperienceCompanyKey, CompanyExperienceDraft>>
  >({});
  const [ciscoRoleCloud, setCiscoRoleCloud] = useState<CiscoRoleDraft | null>(null);
  const [loadingPortfolioContent, setLoadingPortfolioContent] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    const unsubs: Array<() => void> = [];
    let pending = 7;
    const markReady = () => {
      pending -= 1;
      if (pending <= 0) setLoadingPortfolioContent(false);
    };

    unsubs.push(
      onSnapshot(collection(db, 'portfolio_seed_hides'), (snap) => {
        const next: Record<string, string[]> = {
          portfolio_certifications: [],
          portfolio_awards: [],
          portfolio_recommendations: [],
          portfolio_disciplines: [],
        };
        snap.docs.forEach((d) => {
          const data = d.data();
          const col = String(data.collection || '');
          const entityId = String(data.entityId || '');
          if (entityId && col in next) next[col].push(entityId);
        });
        setHiddenSeeds(next);
        markReady();
      }, () => markReady())
    );

    unsubs.push(
      onSnapshot(
        publicCmsQuery('portfolio_certifications'),
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
        publicCmsQuery('portfolio_awards'),
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
        publicCmsQuery('portfolio_recommendations'),
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
        publicCmsQuery('portfolio_disciplines'),
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
      onSnapshot(
        collection(db, 'portfolio_experience'),
        (snap) => {
          const next: Partial<Record<ExperienceCompanyKey, CompanyExperienceDraft>> = {};
          for (const d of snap.docs) {
            if (!(EXPERIENCE_COMPANY_KEYS as readonly string[]).includes(d.id)) continue;
            const data = d.data();
            const companyKey = d.id as ExperienceCompanyKey;
            const roles = Array.isArray(data.roles)
              ? data.roles.map((role) =>
                  sanitizeExperienceRoleDraft(
                    role && typeof role === 'object'
                      ? (role as Record<string, unknown>)
                      : {}
                  )
                )
              : [];
            next[companyKey] = {
              companyKey,
              companyTag: String(data.companyTag || ''),
              tenure: String(data.tenure || ''),
              location: String(data.location || ''),
              roles,
              sourceAnnouncementId: data.sourceAnnouncementId
                ? String(data.sourceAnnouncementId)
                : undefined,
            };
          }
          setCloudExperience(next);
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

  const certifications = useMemo(
    () => mergeCertifications(cloudCerts, hiddenSeeds.portfolio_certifications),
    [cloudCerts, hiddenSeeds.portfolio_certifications]
  );
  const certificationCategories = useMemo(
    () => mergeCertificationCategories(certifications),
    [certifications]
  );
  const awards = useMemo(
    () => mergeAwards(cloudAwards, hiddenSeeds.portfolio_awards),
    [cloudAwards, hiddenSeeds.portfolio_awards]
  );
  const awardsByOrganization = useMemo(() => mergeAwardsByOrganization(awards), [awards]);
  const recommendations = useMemo(
    () => mergeRecommendations(cloudRecs, hiddenSeeds.portfolio_recommendations),
    [cloudRecs, hiddenSeeds.portfolio_recommendations]
  );
  const disciplines = useMemo(
    () => mergeDisciplines(cloudDisciplines, hiddenSeeds.portfolio_disciplines),
    [cloudDisciplines, hiddenSeeds.portfolio_disciplines]
  );
  const companyExperience = useMemo(() => {
    const seeds = getAllStaticCompanyExperienceDrafts();
    return {
      cisco: cloudExperience.cisco || seeds.cisco,
      hcl: cloudExperience.hcl || seeds.hcl,
      tcs: cloudExperience.tcs || seeds.tcs,
    };
  }, [cloudExperience]);
  const ciscoRole = useMemo(() => {
    const fromExperience = experienceDraftToCiscoRole(cloudExperience.cisco);
    return fromExperience || ciscoRoleCloud || getStaticCiscoRoleDraft();
  }, [cloudExperience.cisco, ciscoRoleCloud]);
  const workExperience = useMemo(
    () =>
      applyExperienceOverrides(
        WORK_EXPERIENCE,
        cloudExperience,
        cloudExperience.cisco ? null : ciscoRoleCloud
      ),
    [cloudExperience, ciscoRoleCloud]
  );

  const clearSeedHide = useCallback(async (collectionName: string, entityId: string) => {
    const hideId = `${collectionName}__${entityId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    try {
      await deleteDoc(doc(db, 'portfolio_seed_hides', hideId));
    } catch {
      /* no hide marker */
    }
  }, []);

  const upsertCertification = useCallback(
    async (draft: CertificationDraft, id?: string) => {
      assertOwner(isOwner);
      const validation = validateCertificationDraft(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      const docId = id && isValidPortfolioEntityId(id) ? id : generatePortfolioEntityId('cert');
      const record = certificationDraftToRecord(docId, validation.normalized);
      try {
        await clearSeedHide('portfolio_certifications', docId);
        await upsertCloudDoc(
          'portfolio_certifications',
          docId,
          { ...record, sourceAnnouncementId: validation.normalized.sourceAnnouncementId || '' },
          user?.uid || ''
        );
        void recordAdminAudit('cms_mutated', `Upserted certification ${docId}`).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `portfolio_certifications/${docId}`);
      }
      return docId;
    },
    [clearSeedHide, isOwner, recordAdminAudit, user?.uid]
  );

  const deleteCertification = useCallback(
    async (id: string) => {
      assertOwner(isOwner);
      const seed = CERTIFICATIONS.find((c) => c.id === id) || null;
      await softOrHardDelete('portfolio_certifications', id, Boolean(seed), user?.uid || '');
      void recordAdminAudit('cms_mutated', `Deleted certification ${id}`).catch(() => {});
    },
    [isOwner, recordAdminAudit, user?.uid]
  );

  const upsertAward = useCallback(
    async (draft: AwardDraft, id?: string) => {
      assertOwner(isOwner);
      const validation = validateAwardDraft(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      const docId = id && isValidPortfolioEntityId(id) ? id : generatePortfolioEntityId('award');
      const record = awardDraftToRecord(docId, validation.normalized);
      try {
        await clearSeedHide('portfolio_awards', docId);
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
        void recordAdminAudit('cms_mutated', `Upserted award ${docId}`).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `portfolio_awards/${docId}`);
      }
      return docId;
    },
    [clearSeedHide, isOwner, recordAdminAudit, user?.uid]
  );

  const deleteAward = useCallback(
    async (id: string) => {
      assertOwner(isOwner);
      const seed = AWARDS.find((a) => a.id === id) || null;
      await softOrHardDelete('portfolio_awards', id, Boolean(seed), user?.uid || '');
      void recordAdminAudit('cms_mutated', `Deleted award ${id}`).catch(() => {});
    },
    [isOwner, recordAdminAudit, user?.uid]
  );

  const upsertRecommendation = useCallback(
    async (draft: RecommendationDraft, id?: string) => {
      assertOwner(isOwner);
      const validation = validateRecommendationDraft(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      const docId = id && isValidPortfolioEntityId(id) ? id : generatePortfolioEntityId('rec');
      const record = recommendationDraftToRecord(docId, validation.normalized);
      try {
        await clearSeedHide('portfolio_recommendations', docId);
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
        void recordAdminAudit('cms_mutated', `Upserted recommendation ${docId}`).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `portfolio_recommendations/${docId}`);
      }
      return docId;
    },
    [clearSeedHide, isOwner, recordAdminAudit, user?.uid]
  );

  const deleteRecommendation = useCallback(
    async (id: string) => {
      assertOwner(isOwner);
      const seed = LINKEDIN_RECOMMENDATIONS.find((r) => r.id === id) || null;
      await softOrHardDelete('portfolio_recommendations', id, Boolean(seed), user?.uid || '');
      void recordAdminAudit('cms_mutated', `Deleted recommendation ${id}`).catch(() => {});
    },
    [isOwner, recordAdminAudit, user?.uid]
  );

  const upsertDiscipline = useCallback(
    async (draft: DisciplineDraft, id?: string) => {
      assertOwner(isOwner);
      const validation = validateDisciplineDraft(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      const docId = id && isValidPortfolioEntityId(id) ? id : generatePortfolioEntityId('disc');
      try {
        await clearSeedHide('portfolio_disciplines', docId);
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
        void recordAdminAudit('cms_mutated', `Upserted discipline ${docId}`).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `portfolio_disciplines/${docId}`);
      }
      return docId;
    },
    [clearSeedHide, isOwner, recordAdminAudit, user?.uid]
  );

  const deleteDiscipline = useCallback(
    async (id: string) => {
      assertOwner(isOwner);
      const seed = TECHNICAL_DISCIPLINES.find((d) => d.id === id) || null;
      await softOrHardDelete('portfolio_disciplines', id, Boolean(seed), user?.uid || '');
      void recordAdminAudit('cms_mutated', `Deleted discipline ${id}`).catch(() => {});
    },
    [isOwner, recordAdminAudit, user?.uid]
  );

  const saveCompanyExperience = useCallback(
    async (draft: CompanyExperienceDraft) => {
      assertOwner(isOwner);
      const validation = validateCompanyExperienceDraft(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      try {
        await upsertCloudDoc(
          'portfolio_experience',
          validation.normalized.companyKey,
          {
            companyKey: validation.normalized.companyKey,
            companyTag: validation.normalized.companyTag || '',
            tenure: validation.normalized.tenure || '',
            location: validation.normalized.location || '',
            roles: validation.normalized.roles,
            sourceAnnouncementId: validation.normalized.sourceAnnouncementId || '',
          },
          user?.uid || ''
        );
        void recordAdminAudit(
          'cms_mutated',
          `Saved experience ${validation.normalized.companyKey}`
        ).catch(() => {});
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `portfolio_experience/${validation.normalized.companyKey}`
        );
      }
    },
    [isOwner, recordAdminAudit, user?.uid]
  );

  const saveCiscoRole = useCallback(
    async (draft: CiscoRoleDraft) => {
      assertOwner(isOwner);
      const validation = validateCiscoRoleDraft(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      const base = cloudExperience.cisco || getStaticCompanyExperienceDraft('cisco');
      const roles = [...base.roles];
      const first = roles[0] || sanitizeExperienceRoleDraft({});
      roles[0] = {
        ...first,
        domain: validation.normalized.domain || first.domain,
        proofMetric: validation.normalized.proofMetric || first.proofMetric,
        recognitionBadge: validation.normalized.recognitionBadge || first.recognitionBadge,
        highlights:
          validation.normalized.highlights.length > 0
            ? validation.normalized.highlights
            : first.highlights,
        technologies:
          validation.normalized.technologies.length > 0
            ? validation.normalized.technologies
            : first.technologies,
      };
      await saveCompanyExperience({
        ...base,
        companyKey: 'cisco',
        roles,
        sourceAnnouncementId: validation.normalized.sourceAnnouncementId,
      });
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
      } catch {
        /* optional legacy mirror */
      }
    },
    [cloudExperience.cisco, isOwner, saveCompanyExperience, user?.uid]
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
      companyExperience,
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
      saveCompanyExperience,
      saveCiscoRole,
    }),
    [
      awards,
      awardsByOrganization,
      certificationCategories,
      certifications,
      ciscoRole,
      companyExperience,
      deleteAward,
      deleteCertification,
      deleteDiscipline,
      deleteRecommendation,
      disciplines,
      loadingPortfolioContent,
      recommendations,
      saveCiscoRole,
      saveCompanyExperience,
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
