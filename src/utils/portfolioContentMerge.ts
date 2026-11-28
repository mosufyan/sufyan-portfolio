import type {
  Award,
  Certification,
  CertificationCategory,
  CompanyExperience,
  Recommendation,
} from '../data/portfolioData';
import {
  AWARDS,
  AWARDS_BY_ORGANIZATION,
  CERTIFICATION_CATEGORIES,
  CERTIFICATIONS,
  LINKEDIN_RECOMMENDATIONS,
  TECHNICAL_DISCIPLINES,
  WORK_EXPERIENCE,
} from '../data/portfolioData';
import type {
  CiscoRoleDraft,
  CompanyExperienceDraft,
  DisciplineDraft,
  ExperienceCompanyKey,
  ExperienceRoleDraft,
} from './portfolioContentValidation';
import {
  companyKeyFromName,
  EXPERIENCE_COMPANY_KEYS,
} from './portfolioContentValidation';

export type CloudCertification = Certification & {
  source: 'cloud';
  sourceAnnouncementId?: string;
  /** When true, this cloud doc hides the matching static id. */
  deleted?: boolean;
};

export type CloudAward = Award & {
  source: 'cloud';
  sourceAnnouncementId?: string;
  deleted?: boolean;
};

export type CloudRecommendation = Recommendation & {
  source: 'cloud';
  sourceAnnouncementId?: string;
  deleted?: boolean;
};

export type CloudDiscipline = DisciplineDraft & {
  id: string;
  source: 'cloud';
  deleted?: boolean;
};

export type TechnicalDiscipline = (typeof TECHNICAL_DISCIPLINES)[number];

/** Cloud overrides/additions win by id; deleted cloud docs hide static seeds. */
export function mergeById<T extends { id: string }>(
  staticItems: T[],
  cloudItems: Array<T & { deleted?: boolean }>
): T[] {
  const cloudMap = new Map(cloudItems.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const item of staticItems) {
    const cloud = cloudMap.get(item.id);
    if (cloud?.deleted) {
      seen.add(item.id);
      continue;
    }
    if (cloud) {
      const { deleted: _d, ...rest } = cloud;
      merged.push(rest as T);
      seen.add(item.id);
      continue;
    }
    merged.push(item);
    seen.add(item.id);
  }

  for (const cloud of cloudItems) {
    if (seen.has(cloud.id) || cloud.deleted) continue;
    const { deleted: _d, ...rest } = cloud;
    merged.push(rest as T);
  }

  return merged;
}

export function mergeCertifications(cloud: CloudCertification[]): Certification[] {
  return mergeById(CERTIFICATIONS, cloud);
}

export function mergeCertificationCategories(
  certs: Certification[]
): CertificationCategory[] {
  return CERTIFICATION_CATEGORIES.map((cat) => {
    const nextCerts = certs.filter((c) => c.category === cat.id);
    return {
      ...cat,
      certs: nextCerts,
      count: nextCerts.length,
    };
  }).concat(
    // Cloud-only categories should not appear; orphan certs join their category bucket.
    []
  );
}

export function mergeAwards(cloud: CloudAward[]): Award[] {
  return mergeById(AWARDS, cloud);
}

export function mergeAwardsByOrganization(awards: Award[]) {
  const byOrg = new Map<string, { organization: string; tagline: string; awards: Award[] }>();

  for (const group of AWARDS_BY_ORGANIZATION) {
    byOrg.set(group.organization, {
      organization: group.organization,
      tagline: group.tagline,
      awards: [],
    });
  }

  for (const award of awards) {
    const key =
      [...byOrg.keys()].find(
        (org) =>
          org === award.organization ||
          award.organization.includes(org.split(' ')[0] || '') ||
          (award.associatedWith && org.toLowerCase().includes(award.associatedWith.toLowerCase()))
      ) || award.organization;

    if (!byOrg.has(key)) {
      byOrg.set(key, {
        organization: key,
        tagline: `ASSOCIATED WITH ${key.toUpperCase()}`,
        awards: [],
      });
    }
    byOrg.get(key)!.awards.push(award);
  }

  return [...byOrg.values()].filter((g) => g.awards.length > 0);
}

export function mergeRecommendations(cloud: CloudRecommendation[]): Recommendation[] {
  return mergeById(LINKEDIN_RECOMMENDATIONS, cloud);
}

export function mergeDisciplines(
  cloud: CloudDiscipline[]
): TechnicalDiscipline[] {
  const staticAsCloud: CloudDiscipline[] = TECHNICAL_DISCIPLINES.map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    description: d.description,
    technologies: [...d.technologies],
    level: d.level,
    source: 'cloud' as const,
  }));
  // Prefer real cloud docs over synthetic static copies
  const effectiveCloud = [...cloud];
  const cloudIds = new Set(cloud.map((c) => c.id));
  for (const seed of staticAsCloud) {
    if (!cloudIds.has(seed.id)) effectiveCloud.push(seed);
  }
  return mergeById(
    TECHNICAL_DISCIPLINES.map((d) => ({ ...d })),
    effectiveCloud.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      description: c.description,
      technologies: c.technologies,
      level: c.level,
      deleted: c.deleted,
    }))
  ) as TechnicalDiscipline[];
}

export type CloudCompanyExperience = CompanyExperienceDraft & {
  source: 'cloud';
};

function roleToDraft(role: CompanyExperience['roles'][number]): ExperienceRoleDraft {
  return {
    role: role.role,
    period: role.period,
    location: role.location,
    employmentType: role.employmentType || 'Full-time',
    domain: role.domain || '',
    proofMetric: role.proofMetric || '',
    recognitionBadge: role.recognitionBadge || '',
    highlights: [...role.highlights],
    technologies: [...role.technologies],
  };
}

export function getStaticCompanyExperienceDraft(
  companyKey: ExperienceCompanyKey
): CompanyExperienceDraft {
  const seed = WORK_EXPERIENCE.find((c) => companyKeyFromName(c.company) === companyKey);
  return {
    companyKey,
    companyTag: seed?.companyTag || '',
    tenure: seed?.tenure || '',
    location: seed?.location || '',
    roles: seed?.roles.map(roleToDraft) || [],
  };
}

export function getAllStaticCompanyExperienceDrafts(): Record<
  ExperienceCompanyKey,
  CompanyExperienceDraft
> {
  return {
    cisco: getStaticCompanyExperienceDraft('cisco'),
    hcl: getStaticCompanyExperienceDraft('hcl'),
    tcs: getStaticCompanyExperienceDraft('tcs'),
  };
}

/** Apply per-company cloud overrides (full role lists) onto seed WORK_EXPERIENCE. */
export function applyExperienceOverrides(
  experience: CompanyExperience[],
  cloudByCompany: Partial<Record<ExperienceCompanyKey, CompanyExperienceDraft | null>>,
  /** Legacy single-doc override for Cisco role 0 when portfolio_experience/cisco is absent. */
  legacyCiscoRole: CiscoRoleDraft | null = null
): CompanyExperience[] {
  return experience.map((comp) => {
    const key = companyKeyFromName(comp.company);
    if (!key) return comp;
    const cloud = cloudByCompany[key];
    if (cloud && cloud.roles.length > 0) {
      return {
        ...comp,
        companyTag: cloud.companyTag || comp.companyTag,
        tenure: cloud.tenure || comp.tenure,
        location: cloud.location || comp.location,
        roles: cloud.roles.map((role) => ({
          role: role.role,
          period: role.period,
          location: role.location,
          employmentType: role.employmentType || 'Full-time',
          domain: role.domain || undefined,
          proofMetric: role.proofMetric || undefined,
          recognitionBadge: role.recognitionBadge || undefined,
          highlights: role.highlights,
          technologies: role.technologies,
        })),
      };
    }
    if (key === 'cisco' && legacyCiscoRole) {
      return applyCiscoRoleOverride([comp], legacyCiscoRole)[0]!;
    }
    return comp;
  });
}

export function applyCiscoRoleOverride(
  experience: CompanyExperience[],
  cisco: CiscoRoleDraft | null
): CompanyExperience[] {
  if (!cisco) return experience;
  return experience.map((comp) => {
    if (!comp.company.includes('Cisco')) return comp;
    const roles = comp.roles.map((role, idx) => {
      if (idx !== 0) return role;
      return {
        ...role,
        domain: cisco.domain || role.domain,
        proofMetric: cisco.proofMetric || role.proofMetric,
        recognitionBadge: cisco.recognitionBadge || role.recognitionBadge,
        highlights: cisco.highlights.length > 0 ? cisco.highlights : role.highlights,
        technologies: cisco.technologies.length > 0 ? cisco.technologies : role.technologies,
      };
    });
    return { ...comp, roles };
  });
}

export function getStaticCiscoRoleDraft(): CiscoRoleDraft {
  const draft = getStaticCompanyExperienceDraft('cisco');
  const role = draft.roles[0];
  return {
    domain: role?.domain || '',
    proofMetric: role?.proofMetric || '',
    recognitionBadge: role?.recognitionBadge || '',
    highlights: role?.highlights ? [...role.highlights] : [],
    technologies: role?.technologies ? [...role.technologies] : [],
  };
}

export function experienceDraftToCiscoRole(
  draft: CompanyExperienceDraft | null | undefined
): CiscoRoleDraft | null {
  const role = draft?.roles[0];
  if (!role) return null;
  return {
    domain: role.domain,
    proofMetric: role.proofMetric,
    recognitionBadge: role.recognitionBadge,
    highlights: [...role.highlights],
    technologies: [...role.technologies],
  };
}

export { EXPERIENCE_COMPANY_KEYS };
