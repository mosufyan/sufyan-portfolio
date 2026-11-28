import { describe, expect, it } from 'vitest';
import {
  validateAwardDraft,
  validateCertificationDraft,
  validateCiscoRoleDraft,
  validateDisciplineDraft,
  validateRecommendationDraft,
} from './portfolioContentValidation';

describe('portfolioContentValidation', () => {
  it('validates certifications', () => {
    const ok = validateCertificationDraft({
      title: 'AWS Solutions Architect',
      issuer: 'Amazon Web Services',
      issueDate: 'NOV 2026',
      category: 'cloud',
      skills: ['AWS'],
    });
    expect(ok.valid).toBe(true);

    const bad = validateCertificationDraft({ title: 'x', issuer: '', issueDate: '' });
    expect(bad.valid).toBe(false);
  });

  it('validates awards and recommendations', () => {
    expect(
      validateAwardDraft({
        title: 'Play to Win',
        organization: 'Cisco Systems Inc.',
        date: 'NOV 2026',
        description: 'Recognized for Project Atlas delivery excellence.',
      }).valid
    ).toBe(true);

    expect(
      validateRecommendationDraft({
        author: 'Jane Doe',
        role: 'Engineering Manager',
        date: 'JAN 2026',
        relationshipType: 'manager',
        quote: 'Mohammed consistently delivered high-quality platform work across the team.',
      }).valid
    ).toBe(true);
  });

  it('validates disciplines and cisco role', () => {
    expect(
      validateDisciplineDraft({
        title: 'Platform Engineering',
        description: 'Resilient multi-cloud platform foundations and automation.',
        technologies: ['Kubernetes'],
        level: 95,
      }).valid
    ).toBe(true);

    expect(
      validateCiscoRoleDraft({
        highlights: ['Built governed security data pipelines for Project Atlas MVA.'],
        technologies: ['Python'],
      }).valid
    ).toBe(true);
  });
});
