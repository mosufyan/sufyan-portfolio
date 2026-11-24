/**
 * Intent-aware portfolio answers built from curated data — not truncated chunk dumps.
 * Used by text chat and voice so visitors get clear counts, summaries, and topic replies.
 */
import {
  AWARDS,
  AWARDS_BY_ORGANIZATION,
  CERTIFICATION_CATEGORIES,
  CERTIFICATIONS,
  EDUCATION,
  LINKEDIN_RECOMMENDATIONS,
  PERSONAL_INFO,
  STATS,
  TECHNICAL_DISCIPLINES,
  WORK_EXPERIENCE,
} from '../src/data/portfolioData.ts';
import type { ChatAnswer, KnowledgeChunk } from './chatKnowledge.ts';

// Runtime-safe: type-only import from chatKnowledge (no circular init).

export type ComposedAnswer = ChatAnswer & { composed: true };

function certCount(): number {
  return CERTIFICATIONS.length;
}

function awardCount(): number {
  return AWARDS.length;
}

function certTitlesByCategory(): string {
  return CERTIFICATION_CATEGORIES.map(
    (cat) => `${cat.name} (${cat.certs.length}): ${cat.certs.map((c) => c.title).join('; ')}`
  ).join('\n');
}

function notableCloudCerts(): string[] {
  return CERTIFICATIONS.filter((c) =>
    /aws|azure|google|microsoft|databricks/i.test(`${c.title} ${c.issuer}`)
  )
    .slice(0, 8)
    .map((c) => c.title);
}

function skillSummary(): string {
  return TECHNICAL_DISCIPLINES.map(
    (d) => `${d.title} (${d.level}%): ${(d.technologies || []).slice(0, 6).join(', ')}`
  ).join(' · ');
}

function experienceTimeline(): string {
  return WORK_EXPERIENCE.map((c) => {
    const roles = c.roles.map((r) => r.role).join(' → ');
    return `${c.company} (${c.tenure}): ${roles}`;
  }).join(' | ');
}

function awardSummary(): string {
  return AWARDS_BY_ORGANIZATION.map(
    (org) =>
      `${org.organization} (${org.awards.length}): ${org.awards
        .slice(0, 4)
        .map((a) => a.title)
        .join('; ')}${org.awards.length > 4 ? '…' : ''}`
  ).join(' · ');
}

function educationSummary(): string {
  return EDUCATION.map(
    (e) => `${e.degree} in ${e.field} — ${e.institution} (${e.period}; ${e.grade})`
  ).join(' · ');
}

function pack(
  answer: string,
  sources: string[],
  followUps: string[],
  retrievalContext: string,
  question: string
): ComposedAnswer {
  return {
    answer: answer.replace(/\s+/g, ' ').trim().slice(0, 900),
    confidence: 0.94,
    sources,
    suggestions: [],
    followUps: followUps.slice(0, 3),
    offerLiveAgent: false,
    retrievalContext: retrievalContext.slice(0, 8000),
    retrieval: 'keyword',
    composed: true,
  };
}

function wantsCount(q: string): boolean {
  return /\b(how many|number of|count of|total (number of )?|how much)\b/i.test(q);
}

function wantsBrief(q: string): boolean {
  return /\b(brief|briefly|summar(y|ize|ise)|overview|explain|tell me about|list|what are|which)\b/i.test(
    q
  );
}

/** Prefer composed answers for high-traffic visitor intents. */
export function composePortfolioAnswer(
  questionRaw: string,
  knowledge: KnowledgeChunk[]
): ComposedAnswer | null {
  const question = questionRaw.trim().slice(0, 500);
  const q = question.toLowerCase();
  if (!q) return null;

  const find = (...ids: string[]) =>
    ids.map((id) => knowledge.find((c) => c.id === id)).filter(Boolean) as KnowledgeChunk[];

  // —— Certifications ——
  if (/certif|credential|\blicen[cs]e|\baccredited\b/.test(q)) {
    const chunks = find('cert-ai', 'cert-cloud', 'cert-data', 'stats', 'about');
    const ctx =
      chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n') ||
      certTitlesByCategory();
    const sources = chunks.length
      ? chunks.map((c) => c.topic)
      : CERTIFICATION_CATEGORIES.map((c) => `Certifications — ${c.name}`);
    const followUps = [
      'Which AWS or Azure certifications does he hold?',
      'Does he hold Databricks or AI certifications?',
      'What awards has he received?',
    ];

    if (wantsCount(q) || /\bhow many cert/i.test(q)) {
      return pack(
        `Mohammed holds ${certCount()} professional certifications and accreditations across three areas: AI/GenAI & Applied Science (${CERTIFICATION_CATEGORIES[0]?.certs.length || 0}), Cloud & DevOps Architecture (${CERTIFICATION_CATEGORIES[1]?.certs.length || 0}), and Data/Systems programs (${CERTIFICATION_CATEGORIES[2]?.certs.length || 0}). Highlights include AWS DevOps Pro, AWS Solutions Architect, Azure DevOps Expert, Google Associate Cloud Engineer, and Databricks AI Agent Fundamentals.`,
        sources,
        followUps,
        ctx,
        question
      );
    }

    if (/aws/.test(q)) {
      const aws = CERTIFICATIONS.filter((c) => /aws|amazon/i.test(`${c.title} ${c.issuer}`));
      return pack(
        `AWS certifications (${aws.length}): ${aws.map((c) => c.title).join('; ')}.`,
        sources,
        followUps,
        ctx,
        question
      );
    }
    if (/azure|microsoft/.test(q) && /cert/.test(q)) {
      const azure = CERTIFICATIONS.filter((c) => /azure|microsoft/i.test(`${c.title} ${c.issuer}`));
      return pack(
        `Microsoft/Azure certifications (${azure.length}): ${azure.map((c) => c.title).join('; ')}.`,
        sources,
        followUps,
        ctx,
        question
      );
    }
    if (/databricks|genai|gen ai|\bai\b/.test(q) && /cert/.test(q)) {
      const ai = CERTIFICATION_CATEGORIES.find((c) => c.id === 'ai');
      return pack(
        `AI / Databricks certifications (${ai?.certs.length || 0}): ${(ai?.certs || [])
          .map((c) => c.title)
          .join('; ')}.`,
        sources,
        followUps,
        ctx,
        question
      );
    }

    // Default: brief structured overview (also covers “explain briefly”).
    return pack(
      `Mohammed holds ${certCount()} certifications across AI/GenAI (${CERTIFICATION_CATEGORIES[0]?.certs.length || 0}), Cloud & DevOps (${CERTIFICATION_CATEGORIES[1]?.certs.length || 0}), and Data/Systems (${CERTIFICATION_CATEGORIES[2]?.certs.length || 0}). Notable cloud credentials include ${notableCloudCerts().slice(0, 5).join('; ')}. Full category lists cover AWS, Azure, GCP, Databricks, and applied AI programs.`,
      sources,
      followUps,
      `${certTitlesByCategory()}\n\n${ctx}`,
      question
    );
  }

  // —— Awards ——
  if (/\bawards?\b|\bhonor|\brecognition\b|\bachiever/.test(q)) {
    const chunks = find(...knowledge.filter((c) => c.id.startsWith('award-')).map((c) => c.id), 'stats');
    const ctx = chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n') || awardSummary();
    const sources = chunks.length ? chunks.map((c) => c.topic) : ['Career highlights / stats'];
    const followUps = [
      'What certifications does he hold?',
      'What is Mohammed’s current role at Cisco?',
      'Summarize his security / Zero Trust experience',
    ];
    if (wantsCount(q)) {
      return pack(
        `Mohammed has ${awardCount()}+ corporate honors and awards across Cisco Systems Inc., HCL America Inc./HCLTech, and Tata Consultancy Services — including Play to Win Connected Recognition, HCL Achievers League, ERS Star Champion, and Service Commitment awards.`,
        sources,
        followUps,
        ctx,
        question
      );
    }
    return pack(
      `He has ${awardCount()}+ awards. ${awardSummary()}`,
      sources,
      followUps,
      ctx,
      question
    );
  }

  // —— Skills / clouds / platforms ——
  if (
    /\bskills?\b|\btech stack\b|\btechnologies\b|\bclouds?\b|\bplatforms?\b|\baws\b|\bazure\b|\bgcp\b|\bdatabricks\b/.test(
      q
    ) &&
    !/certif/.test(q)
  ) {
    const chunks = find(
      ...knowledge.filter((c) => c.id.startsWith('skill-')).map((c) => c.id)
    );
    const ctx = chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n') || skillSummary();
    const sources = chunks.length ? chunks.map((c) => c.topic) : ['Skills'];
    const followUps = [
      'What certifications back those skills?',
      'Summarize his security / Zero Trust experience',
      'What is Mohammed’s current role at Cisco?',
    ];
    if (/cloud|platform|aws|azure|gcp/.test(q)) {
      const cloud = TECHNICAL_DISCIPLINES.find((d) => /cloud platform/i.test(d.title));
      return pack(
        `Cloud & platform experience centers on ${cloud?.technologies?.slice(0, 8).join(', ') || 'AWS, Azure, GCP, Databricks'}. Related strengths include DevOps/containers and security governance across multi-cloud estates.`,
        sources,
        followUps,
        ctx,
        question
      );
    }
    if (/secur|zero.?trust|govern/.test(q)) {
      const sec = TECHNICAL_DISCIPLINES.find((d) => /security/i.test(d.title));
      return pack(
        `Security & governance focus: ${sec?.description || 'Zero Trust boundaries, governed data platforms, and audit-ready security tooling'}. Technologies include ${(sec?.technologies || []).slice(0, 8).join(', ')}.`,
        sources,
        followUps,
        ctx,
        question
      );
    }
    return pack(
      `Core technical disciplines: ${TECHNICAL_DISCIPLINES.map((d) => d.title).join(', ')}. ${skillSummary()}`,
      sources,
      followUps,
      ctx,
      question
    );
  }

  // —— Education ——
  if (/\beducat|\buniversity\b|\bcollege\b|\bdegree\b|\bcgpa\b|\bvt u\b|\bvisvesvaraya\b/.test(q)) {
    const chunks = find(...knowledge.filter((c) => c.id.startsWith('edu-')).map((c) => c.id), 'about', 'stats');
    const ctx = chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n') || educationSummary();
    return pack(
      `Education: ${educationSummary()}.`,
      chunks.length ? chunks.map((c) => c.topic) : ['Education'],
      [
        'What is Mohammed’s current role at Cisco?',
        'What certifications does he hold?',
        'How can I contact him?',
      ],
      ctx,
      question
    );
  }

  // —— Contact / open-to ——
  if (
    /\b(contact|email|reach|hire|message|\bcv\b|resume)\b/.test(q) ||
    (/\blinkedin\b/.test(q) && !/\brecommend|testimonial|colleague|said about\b/.test(q))
  ) {
    const chunks = find('contact', 'open-to', 'about');
    return pack(
      `You can reach Mohammed at ${PERSONAL_INFO.email} or LinkedIn (${PERSONAL_INFO.linkedin}). Prefer the portfolio contact form for inquiries; verified visitors can also use live chat. CV/resume is available via the CV studio on the site.`,
      chunks.map((c) => c.topic),
      ['Is he open to new opportunities?', 'What is Mohammed’s current role at Cisco?', 'What certifications does he hold?'],
      chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n'),
      question
    );
  }
  if (/\bopen to\b|\bopportunit|\bhiring|\bavailable for\b/.test(q)) {
    const chunks = find('open-to', 'contact', 'about');
    return pack(
      PERSONAL_INFO.openTo,
      chunks.map((c) => c.topic),
      ['How can I contact him?', 'What is Mohammed’s current role at Cisco?', 'Which clouds and platforms has he worked with?'],
      chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n'),
      question
    );
  }

  // —— Experience overview / current role / security at Cisco ——
  if (
    /\bexperience\b|\bcareer\b|\btenure\b|\bemployer\b|\broles?\b|\bcisco\b|\bhcl\b|\btcs\b|\btata\b|worked at|zero.?trust|\bsecurity\b|current role|what does he do/.test(
      q
    )
  ) {
    // before-Cisco handled in chatKnowledge.composeBeforeCiscoAnswer
    if (/before cisco|prior to cisco|previous (to cisco|employer)|what did (he|mohammed|sufyan) do before\b/.test(q)) {
      return null;
    }

    const cisco = WORK_EXPERIENCE.find((c) => /cisco/i.test(c.company));
    const ciscoRole = cisco?.roles[0];
    const chunks = find(
      'exp-cisco-systems-inc',
      'exp-cisco-systems-inc-role-1',
      'exp-hcl-america-inc-hcltech',
      'exp-tata-consultancy-services',
      'about',
      'stats'
    );

    if (/current role|what does he do|at cisco|cisco role|project atlas|sto\b/.test(q) && !/before/.test(q)) {
      return pack(
        `${PERSONAL_INFO.name} is currently a ${ciscoRole?.role || 'Software Engineer'} at ${cisco?.company || 'Cisco Systems Inc.'} (${ciscoRole?.period || cisco?.tenure || 'Aug 2026 — Present'}). ${ciscoRole?.domain || 'Security & Trust Organization (STO) CTO Operations · Project Atlas'}. Focus: ${(ciscoRole?.highlights || []).slice(0, 2).join(' ')}`,
        chunks.filter((c) => /cisco|about/i.test(c.id)).map((c) => c.topic),
        [
          'What security or Zero Trust work has he done at Cisco?',
          'What did he do before Cisco?',
          'Which clouds does he use in his current role?',
        ],
        chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n'),
        question
      );
    }

    if (/secur|zero.?trust|atlas|sto\b/.test(q)) {
      const highlights = (ciscoRole?.highlights || []).slice(0, 3).join(' ');
      return pack(
        `At Cisco he works in STO CTO Operations on Project Atlas — a governed security data platform. ${highlights} Earlier HCL roles also delivered multi-cloud vulnerability orchestration, JupiterOne security-graph pipelines, and cloud compliance platforms for Cisco accounts.`,
        chunks.map((c) => c.topic),
        [
          'What is Mohammed’s current role at Cisco?',
          'What did he do before Cisco?',
          'Which clouds and platforms has he worked with?',
        ],
        chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n'),
        question
      );
    }

    if (/tcs|tata/.test(q)) {
      const tcs = WORK_EXPERIENCE.find((c) => /tata/i.test(c.company));
      return pack(
        `At Tata Consultancy Services (${tcs?.tenure}): ${(tcs?.roles || [])
          .map((r) => `${r.role} (${r.period})`)
          .join('; ')}. Includes a London onshore client engagement and progression to IT Analyst with enterprise delivery ownership.`,
        find('exp-tata-consultancy-services', 'exp-tata-consultancy-services-role-1').map((c) => c.topic),
        ['What came after TCS in his career?', 'What did he do before Cisco?', 'How can I contact him?'],
        find('exp-tata-consultancy-services', 'exp-tata-consultancy-services-role-1')
          .map((c) => `${c.topic}: ${c.text}`)
          .join('\n\n'),
        question
      );
    }

    if (/hcl/.test(q)) {
      const hcl = WORK_EXPERIENCE.find((c) => /hcl/i.test(c.company));
      return pack(
        `At HCL America Inc./HCLTech (${hcl?.tenure}) he progressed ${(hcl?.roles || [])
          .map((r) => r.role)
          .reverse()
          .join(' → ')}. Work spanned cloud security audit platforms, JupiterOne pipelines, and multi-cloud vulnerability orchestration — largely on Cisco accounts.`,
        find('exp-hcl-america-inc-hcltech', 'exp-hcl-america-inc-hcltech-role-1').map((c) => c.topic),
        [
          'How does HCL experience compare to Cisco?',
          'Summarize his security / Zero Trust experience',
          'What did he do before Cisco?',
        ],
        find('exp-hcl-america-inc-hcltech', 'exp-hcl-america-inc-hcltech-role-1')
          .map((c) => `${c.topic}: ${c.text}`)
          .join('\n\n'),
        question
      );
    }

    if (wantsBrief(q) || /\boverview\b|\bcareer\b|\bexperience\b/.test(q)) {
      return pack(
        `${PERSONAL_INFO.name} has ${PERSONAL_INFO.experienceYears} years of enterprise experience. Career path: ${experienceTimeline()}. Currently ${ciscoRole?.role} at Cisco Systems Inc. on Project Atlas (STO security data platform).`,
        chunks.map((c) => c.topic),
        [
          'What did he do before Cisco?',
          'Summarize his security / Zero Trust experience',
          'What certifications does he hold?',
        ],
        chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n'),
        question
      );
    }
  }

  // —— Recommendations / testimonials ——
  if (/\brecommend|testimonial|colleague|what did .+ say|endorsement\b/.test(q)) {
    const chunks = knowledge.filter((c) => c.id.startsWith('rec-'));
    const top = LINKEDIN_RECOMMENDATIONS.slice(0, 3);
    const summary = top
      .map((r) => `${r.author}${r.relationship ? ` (${r.relationship})` : ''}: ${(r.quote || '').slice(0, 180)}`)
      .join(' · ');
    const ctx =
      chunks
        .slice(0, 4)
        .map((c) => `${c.topic}: ${c.text}`)
        .join('\n\n') || summary;
    return pack(
      `LinkedIn recommendations highlight Mohammed’s delivery and leadership. ${summary}`,
      chunks.slice(0, 4).map((c) => c.topic),
      [
        'What is Mohammed’s current role at Cisco?',
        'Summarize his security / Zero Trust experience',
        'How can I contact him?',
      ],
      ctx,
      question
    );
  }

  // —— About / stats / who is ——
  if (
    /\b(who is|bio|profile|background|highlights|stats)\b/.test(q) ||
    /\babout (him|mohammed|sufyan|you)\b/.test(q) ||
    (wantsCount(q) && /year|experience|award|cert/.test(q))
  ) {
    const chunks = find('about', 'stats', 'open-to');
    if (wantsCount(q) && /year|experience/.test(q)) {
      return pack(
        `Mohammed has ${PERSONAL_INFO.experienceYears} years of enterprise experience across Cisco, HCLTech, and TCS.`,
        chunks.map((c) => c.topic),
        ['What is Mohammed’s current role at Cisco?', 'What did he do before Cisco?', 'What certifications does he hold?'],
        chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n'),
        question
      );
    }
    return pack(
      `${PERSONAL_INFO.name} is a ${PERSONAL_INFO.title}. ${PERSONAL_INFO.tagline} Stats: ${STATS.map((s) => `${s.value}${s.fraction || ''} ${s.label}`).join(' · ')}.`,
      chunks.map((c) => c.topic),
      [
        'What is Mohammed’s current role at Cisco?',
        'What certifications does he hold?',
        'How can I contact him?',
      ],
      chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n'),
      question
    );
  }

  // —— Philosophy ——
  if (/philosoph|principles|approach to engineering/.test(q)) {
    const chunks = find('philosophy', 'about');
    return pack(
      `${PERSONAL_INFO.philosophy.quote1} ${PERSONAL_INFO.philosophy.body}`,
      chunks.map((c) => c.topic),
      [
        'Summarize his security / Zero Trust experience',
        'What is Mohammed’s current role at Cisco?',
        'Is he open to new opportunities?',
      ],
      chunks.map((c) => `${c.topic}: ${c.text}`).join('\n\n'),
      question
    );
  }

  return null;
}
