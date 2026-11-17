import { Certification, ExperienceRole } from '../data/portfolioData';

const SKILL_TOKEN_ALIASES: Record<string, string[]> = {
  'agentic workflows': ['agentic', 'ai agent', 'genai', 'generative ai', 'rag'],
  'rag architecture': ['rag', 'retrieval', 'vector'],
  'vector databases': ['vector', 'rag'],
  'prompt engineering': ['prompt', 'generative ai'],
  'python (programming language)': ['python', 'django', 'flask', 'fastapi', 'asyncio', 'duckdb', 'pandas', 'sqlalchemy'],
  'async python': ['async', 'asyncio', 'python'],
  'django 5': ['django'],
  'django rest framework': ['django'],
  'shell scripting': ['shell', 'unix'],
  'aws (s3, redshift, dynamodb)': ['aws', 'amazon web services', 's3', 'redshift', 'dynamodb'],
  'microsoft azure': ['azure', 'microsoft'],
  'google cloud platform (gcp / bigquery)': ['gcp', 'google cloud', 'bigquery', 'google'],
  'multi-cloud governance': ['multi-cloud', 'aws', 'azure', 'gcp'],
  'kubernetes (eks/aks/gke)': ['kubernetes', 'k8s', 'gke', 'eks', 'aks', 'openshift'],
  'ci/cd pipelines': ['ci/cd', 'gitlab ci/cd', 'github actions', 'devops'],
  'gitlab ci/cd': ['gitlab', 'ci/cd'],
  'uv devcontainers': ['uv', 'devcontainer'],
  'project atlas security platform': ['project atlas', 'sto data platform'],
  'zero trust architecture': ['zero trust', 'cloud security', 'vault', 'security'],
  'tenable vulnerability scanners': ['tenable', 'vulnerability'],
  'wiz integration': ['wiz'],
  'jupiterone graph': ['jupiterone', 'j1ql', 'security graph'],
  'splunk / splunk cloud': ['splunk'],
  'openshift cronjob observability': ['openshift', 'cronjob', 'observability'],
  'statistical anomaly detection': ['anomaly detection', 'statistical anomaly'],
  'grafana / prometheus': ['grafana', 'prometheus'],
};

export function normalizeSelectedSkills(skills: string[] | string | null | undefined): string[] {
  if (!skills) return [];
  const list = typeof skills === 'string' ? [skills] : skills;
  const cleaned = list.map((s) => s.trim()).filter((s) => s.length > 0);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const skill of cleaned) {
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(skill);
  }
  return unique;
}

/** Toggle a skill in/out of the multi-select set. Pass null to clear all. */
export function toggleSelectedSkill(
  current: string[] | string | null | undefined,
  skill: string | null
): string[] {
  if (skill === null) return [];
  const skills = normalizeSelectedSkills(current);
  const exactIdx = skills.findIndex((s) => s.toLowerCase() === skill.toLowerCase());
  if (exactIdx >= 0) {
    return skills.filter((_, i) => i !== exactIdx);
  }
  const fuzzyIdx = skills.findIndex((s) => doesTechTagMatchSingle(skill, s));
  if (fuzzyIdx >= 0) {
    return skills.filter((_, i) => i !== fuzzyIdx);
  }
  return [...skills, skill.trim()].filter(Boolean);
}

export function formatSkillFilterSummary(skills: string[] | string | null | undefined): {
  count: number;
  label: string;
  names: string;
} {
  const list = normalizeSelectedSkills(skills);
  if (list.length === 0) {
    return { count: 0, label: '', names: '' };
  }
  if (list.length === 1) {
    return { count: 1, label: 'Cross-filtering by', names: list[0] };
  }
  return {
    count: list.length,
    label: `Multiple filters selected (${list.length})`,
    names: list.join(' · '),
  };
}

export function getSkillSearchTokens(skill: string): string[] {
  const normalized = skill.trim().toLowerCase();
  if (!normalized) return [];

  const tokens = new Set<string>([normalized]);
  const withoutParens = normalized.replace(/\s*\([^)]*\)/g, '').trim();
  if (withoutParens.length >= 2) {
    tokens.add(withoutParens);
  }

  const aliases = SKILL_TOKEN_ALIASES[normalized];
  if (aliases) {
    for (const alias of aliases) {
      tokens.add(alias);
    }
  }

  return Array.from(tokens);
}

function matchesAnyToken(haystack: string, tokens: string[]): boolean {
  const lower = haystack.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

function doesTechTagMatchSingle(tech: string, selectedSkill: string): boolean {
  const tokens = getSkillSearchTokens(selectedSkill);
  const reverseTokens = getSkillSearchTokens(tech);
  const lowerTech = tech.toLowerCase();
  const lowerSelected = selectedSkill.toLowerCase();
  return (
    tokens.some((t) => lowerTech.includes(t)) ||
    reverseTokens.some((t) => lowerSelected.includes(t))
  );
}

function doesRoleMatchSingle(role: ExperienceRole, selectedSkill: string): boolean {
  const tokens = getSkillSearchTokens(selectedSkill);
  const combined = [
    role.role,
    role.domain || '',
    role.recognitionBadge || '',
    ...role.technologies,
    ...role.highlights,
  ].join(' ');
  return matchesAnyToken(combined, tokens);
}

function doesCertMatchSingle(cert: Certification, selectedSkill: string): boolean {
  const tokens = getSkillSearchTokens(selectedSkill);
  const combined = [cert.title, cert.issuer, ...cert.skills].join(' ');
  return matchesAnyToken(combined, tokens);
}

/** Highlight / active chip: matches any selected skill (OR). */
export function doesTechTagMatchSkill(
  tech: string,
  selectedSkills: string[] | string | null | undefined
): boolean {
  const skills = normalizeSelectedSkills(selectedSkills);
  if (skills.length === 0) return false;
  return skills.some((skill) => doesTechTagMatchSingle(tech, skill));
}

/** Role visibility: matches any selected skill (OR). Empty selection = show all. */
export function doesRoleMatchSkill(
  role: ExperienceRole,
  selectedSkills: string[] | string | null | undefined
): boolean {
  const skills = normalizeSelectedSkills(selectedSkills);
  if (skills.length === 0) return true;
  return skills.some((skill) => doesRoleMatchSingle(role, skill));
}

/** Cert visibility: matches any selected skill (OR). Empty selection = show all. */
export function doesCertMatchSkill(
  cert: Certification,
  selectedSkills: string[] | string | null | undefined
): boolean {
  const skills = normalizeSelectedSkills(selectedSkills);
  if (skills.length === 0) return true;
  return skills.some((skill) => doesCertMatchSingle(cert, skill));
}
