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

export function doesTechTagMatchSkill(tech: string, selectedSkill: string | null): boolean {
  if (!selectedSkill) return false;
  const tokens = getSkillSearchTokens(selectedSkill);
  const reverseTokens = getSkillSearchTokens(tech);
  const lowerTech = tech.toLowerCase();
  const lowerSelected = selectedSkill.toLowerCase();
  return (
    tokens.some((t) => lowerTech.includes(t)) ||
    reverseTokens.some((t) => lowerSelected.includes(t))
  );
}

export function doesRoleMatchSkill(role: ExperienceRole, selectedSkill: string | null): boolean {
  if (!selectedSkill) return true;
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

export function doesCertMatchSkill(cert: Certification, selectedSkill: string | null): boolean {
  if (!selectedSkill) return true;
  const tokens = getSkillSearchTokens(selectedSkill);
  const combined = [cert.title, cert.issuer, ...cert.skills].join(' ');
  return matchesAnyToken(combined, tokens);
}
