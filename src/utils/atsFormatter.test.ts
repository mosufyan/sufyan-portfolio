import { describe, expect, it } from 'vitest';
import { WORK_EXPERIENCE } from '../data/portfolioData';
import { buildAtsPlainTextResume } from './atsFormatter';

describe('buildAtsPlainTextResume', () => {
  it('includes identity and optional sections', () => {
    const text = buildAtsPlainTextResume({
      sections: {
        overview: true,
        philosophy: true,
        experience: true,
        skills: false,
        certifications: false,
        awards: false,
        education: false,
      },
      skillsDepth: 'compact',
      experienceDepth: 'concise',
      visibleExperience: WORK_EXPERIENCE.slice(0, 1),
      visibleCertCategories: [],
      visibleAwardsGroups: [],
      visibleRecommendations: [],
    });

    expect(text).toContain('MOHAMMED SUFYAN');
    expect(text).toContain('EXECUTIVE SUMMARY');
    expect(text).toContain('PROFESSIONAL EXPERIENCE');
    expect(text).toContain(WORK_EXPERIENCE[0].company.toUpperCase());
    expect(text).not.toContain('TECHNICAL SKILLS & ARCHITECTURE DISCIPLINES');
  });

  it('omits experience when section disabled', () => {
    const text = buildAtsPlainTextResume({
      sections: {
        overview: true,
        philosophy: false,
        experience: false,
        skills: false,
        certifications: false,
        awards: false,
        education: false,
      },
      skillsDepth: 'compact',
      experienceDepth: 'compact',
      visibleExperience: WORK_EXPERIENCE,
      visibleCertCategories: [],
      visibleAwardsGroups: [],
      visibleRecommendations: [],
    });

    expect(text).toContain('EXECUTIVE SUMMARY');
    expect(text).not.toContain('PROFESSIONAL EXPERIENCE');
  });
});
