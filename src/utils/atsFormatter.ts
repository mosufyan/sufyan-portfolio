import {
  AWARDS,
  CERTIFICATIONS,
  CompanyExperience,
  EDUCATION,
  LINKEDIN_RECOMMENDATIONS,
  PERSONAL_INFO,
  Recommendation,
  STATS,
  TECHNICAL_DISCIPLINES,
} from '../data/portfolioData';

export interface AtsExportInput {
  sections: {
    overview: boolean;
    philosophy: boolean;
    experience: boolean;
    skills: boolean;
    certifications: boolean;
    awards: boolean;
    education: boolean;
  };
  skillsDepth: 'compact' | 'full';
  experienceDepth: 'compact' | 'concise' | 'full';
  visibleExperience: CompanyExperience[];
  visibleCertCategories: Array<{
    id: string;
    name: string;
    certs: typeof CERTIFICATIONS;
  }>;
  visibleAwardsGroups: Array<{
    organization: string;
    tagline: string;
    awards: typeof AWARDS;
  }>;
  visibleRecommendations: Recommendation[];
}

export function buildAtsPlainTextResume(input: AtsExportInput): string {
  const lines: string[] = [];

  lines.push('================================================================================');
  lines.push(PERSONAL_INFO.name.toUpperCase());
  lines.push('Software Engineer — Cisco Security & Trust Organization (STO) CTO Operations | Cloud Solutions Architect');
  lines.push(`Location: ${PERSONAL_INFO.location}`);
  lines.push(`Email: ${PERSONAL_INFO.email} | LinkedIn: ${PERSONAL_INFO.linkedin}`);
  lines.push('Portfolio: https://www.mohammedsufyan.com/');
  lines.push('================================================================================');
  lines.push('');

  if (input.sections.overview) {
    lines.push('EXECUTIVE SUMMARY');
    lines.push('-----------------');
    lines.push(
      'Architecting high-velocity security data platforms, multi-cloud vulnerability engines, and enterprise compliance systems across 13+ years of engineering experience with Cisco, HCL America Inc., and Tata Consultancy Services in the United States, United Kingdom, and India.'
    );
    lines.push('');
    lines.push('Key Metrics:');
    for (const stat of STATS) {
      lines.push(`- ${stat.value}${stat.fraction || ''} ${stat.label} (${stat.sublabel})`);
    }
    lines.push('');
  }

  if (input.sections.philosophy) {
    lines.push('ARCHITECTURAL PROFILE & ENGINEERING PHILOSOPHY');
    lines.push('----------------------------------------------');
    lines.push(PERSONAL_INFO.philosophy.body);
    lines.push(`Core Motto: "${PERSONAL_INFO.philosophy.quote1}"`);
    lines.push('');
  }

  if (input.sections.experience) {
    lines.push('PROFESSIONAL EXPERIENCE');
    lines.push('-----------------------');
    for (const comp of input.visibleExperience) {
      lines.push(`${comp.company.toUpperCase()} (${comp.companyTag}) | ${comp.tenure} | ${comp.location}`);
      for (const role of comp.roles) {
        lines.push(`  * ${role.role} (${role.period}) — ${role.location}`);
        if (role.domain) {
          lines.push(`    Domain: ${role.domain}`);
        }
        for (const bullet of role.highlights) {
          lines.push(`    - ${bullet}`);
        }
        if (role.recognitionBadge) {
          lines.push(`    Honor: ${role.recognitionBadge}`);
        }
        if (role.technologies.length > 0 && input.experienceDepth !== 'compact') {
          lines.push(`    Stack: ${role.technologies.join(', ')}`);
        }
      }
      lines.push('');
    }
  }

  if (input.sections.skills) {
    lines.push('TECHNICAL SKILLS & ARCHITECTURE DISCIPLINES');
    lines.push('-------------------------------------------');
    for (const discipline of TECHNICAL_DISCIPLINES) {
      const techs =
        input.skillsDepth === 'compact'
          ? discipline.technologies.slice(0, 5)
          : discipline.technologies;
      lines.push(`- ${discipline.title} (${discipline.level}%): ${techs.join(', ')}`);
      if (input.skillsDepth === 'full') {
        lines.push(`  ${discipline.description}`);
      }
    }
    lines.push('');
  }

  if (input.sections.certifications) {
    lines.push(`LICENSES & OFFICIAL CERTIFICATIONS (${CERTIFICATIONS.length} Verified Total)`);
    lines.push('--------------------------------------------------');
    for (const cat of input.visibleCertCategories) {
      lines.push(`[${cat.name}]`);
      for (const cert of cat.certs) {
        const exp = cert.expiryDate ? ` | Expires: ${cert.expiryDate}` : '';
        const cred = cert.credentialId ? ` | Credential ID: ${cert.credentialId}` : '';
        lines.push(`- ${cert.title} — ${cert.issuer} (Issued: ${cert.issueDate}${exp}${cred})`);
      }
    }
    lines.push('Verification: https://www.linkedin.com/in/mohammed-sufyan/details/certifications/');
    lines.push('');
  }

  if (input.sections.awards) {
    lines.push('OFFICIAL RECOGNITIONS & HONORS');
    lines.push('------------------------------');
    for (const group of input.visibleAwardsGroups) {
      lines.push(`[${group.organization}]`);
      for (const award of group.awards) {
        lines.push(`- ${award.title} (${award.date}) — ${award.category}: ${award.description}`);
      }
    }
    lines.push('');
    lines.push(
      `VERIFIED LINKEDIN RECOMMENDATIONS (${input.visibleRecommendations.length} of ${LINKEDIN_RECOMMENDATIONS.length})`
    );
    lines.push('----------------------------------------------');
    for (const rec of input.visibleRecommendations) {
      lines.push(`- ${rec.author} (${rec.role}) [${rec.date} · ${rec.relationship}]`);
      lines.push(`  "${rec.quote}"`);
    }
    lines.push('Verification: https://www.linkedin.com/in/mohammed-sufyan/details/recommendations/');
    lines.push('');
  }

  if (input.sections.education) {
    lines.push('EDUCATION');
    lines.push('---------');
    for (const edu of EDUCATION) {
      lines.push(`- ${edu.degree} in ${edu.field} (${edu.period}) — ${edu.institution}, ${edu.location} [${edu.grade}]`);
      lines.push(`  ${edu.details}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
