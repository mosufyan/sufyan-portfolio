/**
 * Grounded portfolio Q&A — retrieves answers from curated portfolio facts.
 * No external LLM required; optional later via CHAT_LLM_URL.
 */
import {
  AWARDS_BY_ORGANIZATION,
  CERTIFICATION_CATEGORIES,
  EDUCATION,
  PERSONAL_INFO,
  TECHNICAL_DISCIPLINES,
  WORK_EXPERIENCE,
} from '../src/data/portfolioData.ts';

export interface KnowledgeChunk {
  id: string;
  topic: string;
  text: string;
  keywords: string[];
}

export interface ChatAnswer {
  answer: string;
  confidence: number;
  sources: string[];
  suggestions: string[];
  offerLiveAgent: boolean;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

function buildKnowledgeBase(): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [
    {
      id: 'about',
      topic: 'About Mohammed Sufyan',
      text: `${PERSONAL_INFO.name} is a ${PERSONAL_INFO.title}. ${PERSONAL_INFO.tagline} Location: ${PERSONAL_INFO.location}. ${PERSONAL_INFO.openTo}`,
      keywords: ['about', 'who', 'sufyan', 'mohammed', 'bio', 'profile', 'introduction', 'background'],
    },
    {
      id: 'contact',
      topic: 'Contact',
      text: `Email ${PERSONAL_INFO.email}. LinkedIn ${PERSONAL_INFO.linkedin}. Prefer the contact form on this portfolio for inquiries; live chat is available when requested after email OTP verification.`,
      keywords: ['contact', 'email', 'reach', 'linkedin', 'message', 'hire', 'recruit'],
    },
    {
      id: 'philosophy',
      topic: 'Engineering philosophy',
      text: `${PERSONAL_INFO.philosophy.quote1} ${PERSONAL_INFO.philosophy.body}`,
      keywords: ['philosophy', 'approach', 'principles', 'zero trust', 'telemetry', 'trustworthy'],
    },
    {
      id: 'open-to',
      topic: 'Open to roles',
      text: PERSONAL_INFO.openTo,
      keywords: ['open', 'roles', 'hiring', 'job', 'opportunity', 'san jose', 'hybrid', 'available'],
    },
  ];

  for (const company of WORK_EXPERIENCE) {
    const roleBits = company.roles
      .map((r) => {
        const highlight = (r.highlights || []).slice(0, 2).join(' ');
        return `${r.role} (${r.period})${highlight ? `: ${highlight}` : ''}`;
      })
      .join(' ');
    chunks.push({
      id: `exp-${slug(company.company)}`,
      topic: `Experience — ${company.company}`,
      text: `${company.company}${company.location ? ` · ${company.location}` : ''}. Tenure: ${company.tenure}. ${roleBits}`.slice(
        0,
        1600
      ),
      keywords: tokenize(
        `${company.company} ${company.roles.map((r) => r.role).join(' ')} experience career work cisco hcl tcs`
      ),
    });
  }

  for (const discipline of TECHNICAL_DISCIPLINES) {
    chunks.push({
      id: `skill-${discipline.id}`,
      topic: `Skills — ${discipline.title}`,
      text: `${discipline.title} (maturity ${discipline.level}%): ${(discipline.technologies || []).join(', ')}. ${discipline.description || ''}`,
      keywords: tokenize(
        `${discipline.title} ${(discipline.technologies || []).join(' ')} skills tech stack`
      ),
    });
  }

  for (const cat of CERTIFICATION_CATEGORIES) {
    const names = cat.certs.map((c) => c.title).join('; ');
    chunks.push({
      id: `cert-${cat.id}`,
      topic: `Certifications — ${cat.name}`,
      text: `${cat.name}: ${names}`,
      keywords: tokenize(`${cat.name} ${names} certification license accredited aws azure gcp`),
    });
  }

  for (const org of AWARDS_BY_ORGANIZATION) {
    const awardNames = org.awards.map((a) => a.title).join('; ');
    chunks.push({
      id: `award-${slug(org.organization)}`,
      topic: `Awards — ${org.organization}`,
      text: `${org.organization}: ${awardNames}`,
      keywords: tokenize(`${org.organization} ${awardNames} award honor recognition`),
    });
  }

  for (const edu of EDUCATION) {
    chunks.push({
      id: `edu-${slug(edu.institution)}`,
      topic: `Education — ${edu.institution}`,
      text: `${edu.degree} in ${edu.field} at ${edu.institution} (${edu.period}). Grade: ${edu.grade}. ${edu.details || ''}`,
      keywords: tokenize(`${edu.institution} ${edu.degree} ${edu.field} education university college cgpa`),
    });
  }

  return chunks;
}

const KNOWLEDGE = buildKnowledgeBase();

const SUGGESTIONS = [
  'What is Mohammed’s current role at Cisco?',
  'Which clouds and platforms has he worked with?',
  'Summarize his security / Zero Trust experience',
  'How can I contact him or request a CV?',
  'Is he open to new opportunities?',
];

function scoreChunk(tokens: string[], chunk: KnowledgeChunk): number {
  if (tokens.length === 0) return 0;
  const hay = `${chunk.topic} ${chunk.text} ${chunk.keywords.join(' ')}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (chunk.keywords.includes(token)) score += 3;
    else if (hay.includes(token)) score += 1.2;
  }
  return score;
}

export function answerPortfolioQuestion(questionRaw: string): ChatAnswer {
  const question = questionRaw.trim().slice(0, 500);
  const tokens = tokenize(question);
  const ranked = KNOWLEDGE.map((chunk) => ({ chunk, score: scoreChunk(tokens, chunk) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = ranked.slice(0, 3);
  const bestScore = top[0]?.score ?? 0;
  const confidence = Math.max(0, Math.min(1, bestScore / Math.max(8, tokens.length * 2.5)));

  if (top.length === 0 || confidence < 0.18) {
    return {
      answer:
        "I don’t have a confident match for that in the published portfolio. Try asking about experience, skills, certifications, awards, education, or contact — or request a live chat with Mohammed (email OTP required).",
      confidence,
      sources: [],
      suggestions: SUGGESTIONS.slice(0, 4),
      offerLiveAgent: true,
    };
  }

  const answer = top
    .map((row, idx) =>
      idx === 0 ? row.chunk.text : `Also relevant — ${row.chunk.topic}: ${row.chunk.text}`
    )
    .join('\n\n')
    .slice(0, 1800);

  return {
    answer,
    confidence,
    sources: top.map((row) => row.chunk.topic),
    suggestions: SUGGESTIONS.filter(
      (s) => !question.toLowerCase().includes(s.toLowerCase().slice(0, 18))
    ).slice(0, 4),
    offerLiveAgent: confidence < 0.55 || /talk|human|agent|live|call|chat with/i.test(question),
  };
}

export function listChatSuggestions(): string[] {
  return [...SUGGESTIONS];
}
