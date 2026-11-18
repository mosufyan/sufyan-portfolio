import { describe, expect, it } from 'vitest';
import {
  doesCertMatchSkill,
  doesRoleMatchSkill,
  doesTechTagMatchSkill,
  formatSkillFilterSummary,
  normalizeSelectedSkills,
  toggleSelectedSkill,
} from './skillMatcher';
import type { Certification, ExperienceRole } from '../data/portfolioData';

const sampleRole: ExperienceRole = {
  role: 'Software Engineer',
  period: '2026',
  location: 'San Jose',
  highlights: ['Built Project Atlas security data platform on Databricks'],
  technologies: ['Python (Programming Language)', 'Databricks', 'AWS / Azure / GCP'],
};

const sampleCert: Certification = {
  id: 'c1',
  title: 'AWS Certified Solutions Architect – Associate',
  issuer: 'Amazon Web Services (AWS)',
  issueDate: '2024',
  category: 'cloud',
  badgeColor: 'border-cyan-500/40 text-cyan-300',
  skills: ['Amazon Web Services (AWS)', 'Cloud Security'],
};

describe('normalizeSelectedSkills', () => {
  it('dedupes case-insensitively and trims', () => {
    expect(normalizeSelectedSkills([' Python ', 'python', 'Databricks'])).toEqual([
      'Python',
      'Databricks',
    ]);
  });

  it('handles string and empty inputs', () => {
    expect(normalizeSelectedSkills('AWS')).toEqual(['AWS']);
    expect(normalizeSelectedSkills(null)).toEqual([]);
  });
});

describe('toggleSelectedSkill', () => {
  it('adds, removes, and clears', () => {
    expect(toggleSelectedSkill([], 'Python')).toEqual(['Python']);
    expect(toggleSelectedSkill(['Python', 'AWS'], 'Python')).toEqual(['AWS']);
    expect(toggleSelectedSkill(['Python'], null)).toEqual([]);
  });
});

describe('formatSkillFilterSummary', () => {
  it('labels single vs multi filters', () => {
    expect(formatSkillFilterSummary(['Python']).label).toBe('Cross-filtering by');
    expect(formatSkillFilterSummary(['Python', 'AWS']).label).toContain('Multiple filters');
  });
});

describe('matching OR semantics', () => {
  it('matches roles and certs when any selected skill hits', () => {
    expect(doesRoleMatchSkill(sampleRole, ['Databricks'])).toBe(true);
    expect(doesRoleMatchSkill(sampleRole, ['Cobol'])).toBe(false);
    expect(doesRoleMatchSkill(sampleRole, [])).toBe(true);

    expect(doesCertMatchSkill(sampleCert, ['AWS'])).toBe(true);
    expect(doesCertMatchSkill(sampleCert, ['Kubernetes'])).toBe(false);

    expect(doesTechTagMatchSkill('Python (Programming Language)', ['Python'])).toBe(true);
    expect(doesTechTagMatchSkill('Go', ['Python'])).toBe(false);
  });
});
