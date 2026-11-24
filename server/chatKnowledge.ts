/**
 * Grounded portfolio Q&A — retrieves answers from curated portfolio facts.
 * No external LLM required; optional later via CHAT_LLM_URL.
 */
import {
  ANNOUNCEMENTS,
  AWARDS_BY_ORGANIZATION,
  CERTIFICATION_CATEGORIES,
  EDUCATION,
  LINKEDIN_RECOMMENDATIONS,
  PERSONAL_INFO,
  STATS,
  TECHNICAL_DISCIPLINES,
  WORK_EXPERIENCE,
} from '../src/data/portfolioData.ts';
import { answerConversationalUtterance } from './chatConversational.ts';
import { composePortfolioAnswer } from './portfolioAnswers.ts';

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
  /** Contextual follow-up questions for the chat chip strip (replaces starters after each ask). */
  followUps: string[];
  offerLiveAgent: boolean;
  /** Richer multi-chunk text for LLM enrichment (falls back to `answer` when unset). */
  retrievalContext?: string;
  /** How the answer was retrieved. */
  retrieval?: 'keyword' | 'vector' | 'hybrid';
  /** True when answer was synthesized from portfolio data (skip raw chunk dumps / needless Grok). */
  composed?: boolean;
}

/** Common question words that match inside longer copy (e.g. "he" inside "the") and poison ranking. */
const QUERY_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'for',
  'from',
  'had',
  'has',
  'have',
  'he',
  'her',
  'him',
  'his',
  'how',
  'i',
  'in',
  'is',
  'it',
  'its',
  'me',
  'my',
  'of',
  'on',
  'or',
  'our',
  'she',
  'should',
  'than',
  'that',
  'the',
  'their',
  'them',
  'they',
  'this',
  'to',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'why',
  'with',
  'would',
  'you',
  'your',
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function tokenizeQuery(input: string): string[] {
  return tokenize(input).filter((t) => !QUERY_STOP_WORDS.has(t));
}

/** Light plural folding so "clouds"/"platforms" match "cloud"/"platform". */
function foldToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('ses') || token.endsWith('xes') || token.endsWith('zes')) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function tokenVariants(token: string): string[] {
  const folded = foldToken(token);
  return folded === token ? [token] : [token, folded];
}

function wordSet(text: string): Set<string> {
  const words = new Set<string>();
  for (const token of tokenize(text)) {
    for (const variant of tokenVariants(token)) words.add(variant);
  }
  return words;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

/** Common employer abbreviations visitors use in chat. */
function employerAliasKeywords(company: string): string[] {
  const c = company.toLowerCase();
  if (/tata|consultancy/.test(c)) return ['tcs', 'tata'];
  if (/hcl/.test(c)) return ['hcl', 'hcltech'];
  if (/cisco/.test(c)) return ['cisco'];
  return [];
}

function expandQueryAliases(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const t of tokens) {
    if (t === 'tcs') {
      out.add('tata');
      out.add('consultancy');
    }
    if (t === 'hcltech') out.add('hcl');
  }
  return [...out];
}

function buildKnowledgeBase(): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [
    {
      id: 'about',
      topic: 'About Mohammed Sufyan',
      text: [
        `${PERSONAL_INFO.name} is a ${PERSONAL_INFO.title}.`,
        PERSONAL_INFO.tagline,
        `Location: ${PERSONAL_INFO.location}.`,
        `Experience: ${PERSONAL_INFO.experienceYears} years; certifications: ${PERSONAL_INFO.certificationsCount}; academic CGPA: ${PERSONAL_INFO.academicCgpa}.`,
        PERSONAL_INFO.openTo,
      ].join(' '),
      keywords: [
        'about',
        'who',
        'sufyan',
        'mohammed',
        'bio',
        'profile',
        'introduction',
        'background',
        'years',
        'experience',
      ],
    },
    {
      id: 'contact',
      topic: 'Contact',
      text: [
        `Email ${PERSONAL_INFO.email}.`,
        `LinkedIn ${PERSONAL_INFO.linkedin}.`,
        'Prefer the contact form on this portfolio for inquiries.',
        'Portfolio live chat is available for verified visitors.',
        'CV / resume can be requested through the CV studio on the site.',
      ].join(' '),
      keywords: [
        'contact',
        'email',
        'reach',
        'linkedin',
        'message',
        'hire',
        'recruit',
        'cv',
        'resume',
      ],
    },
    {
      id: 'philosophy',
      topic: 'Engineering philosophy',
      text: [
        PERSONAL_INFO.philosophy.quote1,
        PERSONAL_INFO.philosophy.body,
        `Poem: ${PERSONAL_INFO.philosophy.poem} — ${PERSONAL_INFO.philosophy.poemAuthor}`,
      ].join(' '),
      keywords: [
        'philosophy',
        'approach',
        'principles',
        'zero trust',
        'telemetry',
        'trustworthy',
        'poem',
      ],
    },
    {
      id: 'open-to',
      topic: 'Open to roles',
      text: PERSONAL_INFO.openTo,
      keywords: [
        'open',
        'roles',
        'hiring',
        'job',
        'opportunity',
        'san jose',
        'hybrid',
        'available',
        'advisory',
      ],
    },
    {
      id: 'stats',
      topic: 'Career highlights / stats',
      text: STATS.map((s) => `${s.value}${s.fraction || ''} ${s.label}${s.sublabel ? ` (${s.sublabel})` : ''}`).join(
        ' · '
      ),
      keywords: tokenize(
        `stats highlights years certifications awards cgpa ${STATS.map((s) => `${s.label} ${s.sublabel || ''}`).join(' ')}`
      ),
    },
  ];

  for (const company of WORK_EXPERIENCE) {
    // One overview chunk per company (all roles). Lead with role work so
    // concise answers are not just the company/tenure header.
    const overviewRoles = company.roles
      .map((r) => {
        const bits = [
          `${r.role} (${r.period})`,
          r.domain ? `Domain: ${r.domain}` : '',
          r.proofMetric ? `Proof: ${r.proofMetric}` : '',
          r.recognitionBadge ? `Recognition: ${r.recognitionBadge}` : '',
          (r.highlights || []).join(' '),
          r.technologies?.length ? `Technologies: ${r.technologies.join(', ')}` : '',
        ].filter(Boolean);
        return bits.join(' ');
      })
      .join('\n\n');
    const employerAliases = employerAliasKeywords(company.company);
    chunks.push({
      id: `exp-${slug(company.company)}`,
      topic: `Experience — ${company.company}`,
      text: [
        overviewRoles,
        `Employer: ${company.company}${company.companyTag ? ` · ${company.companyTag}` : ''}.`,
        `Tenure ${company.tenure}${company.location ? `; location ${company.location}` : ''}.`,
      ]
        .join(' ')
        .slice(0, 12000),
      keywords: tokenize(
        `${company.company} ${employerAliases.join(' ')} ${company.roles
          .map((r) => `${r.role} ${r.domain || ''} ${(r.highlights || []).join(' ')} ${(r.technologies || []).join(' ')}`)
          .join(' ')} experience career`
      ),
    });

    // Per-role chunks (including single-role employers like Cisco).
    company.roles.forEach((role, index) => {
      chunks.push({
        id: `exp-${slug(company.company)}-role-${index + 1}`,
        topic: `Experience — ${company.company} · ${role.role}`,
        text: [
          `${role.role} at ${company.company} (${role.period}).`,
          role.location ? `Location: ${role.location}.` : '',
          role.employmentType ? `Employment: ${role.employmentType}.` : '',
          role.domain ? `Domain: ${role.domain}.` : '',
          role.proofMetric ? `Proof metric: ${role.proofMetric}.` : '',
          role.recognitionBadge ? `Recognition: ${role.recognitionBadge}.` : '',
          (role.highlights || []).join(' '),
          role.technologies?.length ? `Technologies: ${role.technologies.join(', ')}.` : '',
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 8000),
        keywords: tokenize(
          `${company.company} ${employerAliases.join(' ')} ${role.role} ${role.domain || ''} ${(role.highlights || []).join(' ')} ${(role.technologies || []).join(' ')}`
        ),
      });
    });
  }

  for (const discipline of TECHNICAL_DISCIPLINES) {
    chunks.push({
      id: `skill-${discipline.id}`,
      topic: `Skills — ${discipline.title}`,
      text: [
        `${discipline.title} (maturity ${discipline.level}%).`,
        discipline.description || '',
        (discipline.technologies || []).length
          ? `Technologies: ${(discipline.technologies || []).join(', ')}.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
      keywords: tokenize(
        `${discipline.title} ${(discipline.technologies || []).join(' ')} skills tech stack`
      ),
    });
  }

  for (const cat of CERTIFICATION_CATEGORIES) {
    const titles = cat.certs
      .map((c) =>
        [c.title, c.issuer ? `(${c.issuer}` : '', c.issueDate ? `, ${c.issueDate}` : '', c.issuer ? ')' : '']
          .join('')
      )
      .join('; ');
    chunks.push({
      id: `cert-${cat.id}`,
      topic: `Certifications — ${cat.name}`,
      text: `${cat.name} — ${cat.certs.length} credentials: ${titles}.`.slice(0, 10000),
      keywords: tokenize(
        `${cat.name} ${cat.certs.map((c) => `${c.title} ${c.issuer} ${(c.skills || []).join(' ')}`).join(' ')} certification certifications certificate certificates cert certs certified license accredited credential credentials aws azure gcp hold holds how many count total`
      ),
    });
  }

  for (const org of AWARDS_BY_ORGANIZATION) {
    const detail = org.awards
      .map((a) =>
        [
          `${a.title} (${a.date})`,
          a.category ? `· ${a.category}` : '',
          a.description ? `— ${a.description}` : '',
          a.associatedWith ? `Associated with ${a.associatedWith}.` : '',
        ]
          .filter(Boolean)
          .join(' ')
      )
      .join(' ');
    chunks.push({
      id: `award-${slug(org.organization)}`,
      topic: `Awards — ${org.organization}`,
      text: `${org.organization}${org.tagline ? ` · ${org.tagline}` : ''}: ${detail}`.slice(0, 10000),
      keywords: tokenize(
        `${org.organization} ${org.awards.map((a) => `${a.title} ${a.category} ${a.description}`).join(' ')} award honor recognition`
      ),
    });
  }

  for (const edu of EDUCATION) {
    chunks.push({
      id: `edu-${slug(edu.institution)}`,
      topic: `Education — ${edu.institution}`,
      text: [
        `${edu.degree} in ${edu.field} at ${edu.institution} (${edu.period}).`,
        `Grade: ${edu.grade}.`,
        edu.location ? `Location: ${edu.location}.` : '',
        edu.details || '',
      ]
        .filter(Boolean)
        .join(' '),
      keywords: tokenize(
        `${edu.institution} ${edu.degree} ${edu.field} education university college cgpa ${edu.grade}`
      ),
    });
  }

  for (const ann of ANNOUNCEMENTS) {
    chunks.push({
      id: `ann-${ann.id}`,
      topic: `Announcement — ${ann.title}`,
      text: `${ann.date}: ${ann.title}. ${ann.summary}`,
      keywords: tokenize(`${ann.title} ${ann.summary} announcement news update`),
    });
  }

  for (const rec of LINKEDIN_RECOMMENDATIONS) {
    chunks.push({
      id: `rec-${rec.id}`,
      topic: `Recommendation — ${rec.author}`,
      text: [
        `${rec.author}, ${rec.role} (${rec.date}).`,
        `Relationship: ${rec.relationship} (${rec.relationshipType}).`,
        rec.featured ? 'Featured recommendation.' : '',
        rec.quote,
      ]
        .filter(Boolean)
        .join(' ')
        .slice(0, 6000),
      keywords: tokenize(
        `${rec.author} ${rec.role} ${rec.relationship} recommendation testimonial linkedin ${rec.quote}`
      ),
    });
  }

  return chunks;
}

const KNOWLEDGE = buildKnowledgeBase();

export function listKnowledgeChunks(): KnowledgeChunk[] {
  return KNOWLEDGE;
}

const SUGGESTIONS = [
  'What is Mohammed’s current role at Cisco?',
  'Which clouds and platforms has he worked with?',
  'Summarize his security / Zero Trust experience',
  'How can I contact him or request a CV?',
  'Is he open to new opportunities?',
];

/** Topic-deepening chips — ordered by how closely they continue the prior ask. */
const FOLLOW_UPS_BY_TOPIC: Record<string, string[]> = {
  about: [
    'What is his engineering philosophy?',
    'What is Mohammed’s current role at Cisco?',
    'Is he open to new opportunities?',
  ],
  contact: ['How do I request a CV?', 'Is he open to advisory work?', 'Is he open to new opportunities?'],
  philosophy: [
    'Where has he applied Zero Trust in practice?',
    'Summarize his security / Zero Trust experience',
    'Which clouds has he worked with?',
  ],
  'open-to': [
    'What kinds of roles is he targeting?',
    'How can I contact him?',
    'What is his current role at Cisco?',
  ],
  experience: [
    'What did he do before Cisco?',
    'Summarize his security / Zero Trust experience',
    'Which clouds and platforms has he worked with?',
  ],
  skills: [
    'What certifications back those skills?',
    'Where has he applied Zero Trust in practice?',
    'What is his current role at Cisco?',
  ],
  certifications: [
    'Does he hold Databricks or AI certifications?',
    'What awards has he received?',
    'Which clouds and platforms has he worked with?',
  ],
  awards: [
    'What certifications does he hold?',
    'What is Mohammed’s current role at Cisco?',
    'Where has he applied Zero Trust in practice?',
  ],
  education: [
    'What is Mohammed’s current role at Cisco?',
    'What certifications does he hold?',
    'How can I contact him?',
  ],
};

/** Employer / skill-specific chips when a concrete chunk led the answer. */
const FOLLOW_UPS_BY_CHUNK_PREFIX: Array<{ match: RegExp; prompts: string[] }> = [
  {
    match: /^exp-cisco/,
    prompts: [
      'What security or Zero Trust work has he done at Cisco?',
      'What did he do before Cisco?',
      'Which clouds does he use in his current role?',
    ],
  },
  {
    match: /^exp-hcl/,
    prompts: [
      'What was his role at HCL?',
      'How does HCL experience compare to Cisco?',
      'Summarize his security / Zero Trust experience',
    ],
  },
  {
    match: /^exp-(tcs|tata)/,
    prompts: [
      'What did he focus on at TCS?',
      'What came after TCS in his career?',
      'Which clouds and platforms has he worked with?',
    ],
  },
  {
    match: /^skill-.*cloud/,
    prompts: [
      'Which AWS or Azure certifications does he hold?',
      'How does he use Databricks?',
      'What is his current role at Cisco?',
    ],
  },
  {
    match: /^skill-.*secur/,
    prompts: [
      'Where has he applied Zero Trust in practice?',
      'What security certifications does he hold?',
      'What is his current role at Cisco?',
    ],
  },
  {
    match: /^cert-/,
    prompts: [
      'Does he hold Databricks or AI certifications?',
      'Do his certs align with his Cisco work?',
      'What awards has he received?',
    ],
  },
];

type ChatIntent =
  | 'certifications'
  | 'skills'
  | 'contact'
  | 'open-to'
  | 'awards'
  | 'education'
  | 'philosophy'
  | 'about'
  | 'experience'
  | 'general';

/** Route the question to a topic family before bag-of-words scoring. */
function detectIntent(questionLower: string): ChatIntent {
  if (/certif|credential|\blicen[cs]e|\baccredited\b/.test(questionLower)) return 'certifications';
  if (/\b(contact|email|linkedin|reach|hire|message|\bcv\b|resume)\b/.test(questionLower)) {
    return 'contact';
  }
  if (/\bopen to\b|\bopportunit|\bhiring|\bavailable for\b/.test(questionLower)) return 'open-to';
  if (/\bawards?\b|\bhonor|\brecognition\b/.test(questionLower)) return 'awards';
  if (/\beducat|\buniversity\b|\bcollege\b|\bdegree\b|\bcgpa\b/.test(questionLower)) {
    return 'education';
  }
  if (/philosoph|principles|approach to engineering/.test(questionLower)) return 'philosophy';
  if (
    /\bskills?\b|\btech stack\b|\btechnologies\b|\bclouds?\b|\bplatforms?\b|\baws\b|\bazure\b|\bgcp\b|\bdatabricks\b/.test(
      questionLower
    )
  ) {
    return 'skills';
  }
  if (
    /\bexperience\b|\bcareer\b|\btenure\b|\bemployer\b|\broles?\b|\bcisco\b|\bhcl\b|\btcs\b|\btata\b|worked at|zero.?trust|\bsecurity\b/.test(
      questionLower
    )
  ) {
    return 'experience';
  }
  if (/\b(who is|about|bio|profile|background)\b/.test(questionLower)) return 'about';
  return 'general';
}

function chunkFamily(chunk: KnowledgeChunk): ChatIntent | 'general' {
  if (chunk.id.startsWith('cert-')) return 'certifications';
  if (chunk.id.startsWith('skill-')) return 'skills';
  if (chunk.id.startsWith('award-')) return 'awards';
  if (chunk.id.startsWith('edu-')) return 'education';
  if (chunk.id.startsWith('exp-')) return 'experience';
  if (chunk.id.startsWith('rec-')) return 'general';
  if (chunk.id === 'contact') return 'contact';
  if (chunk.id === 'open-to') return 'open-to';
  if (chunk.id === 'philosophy') return 'philosophy';
  if (chunk.id === 'about') return 'about';
  return 'general';
}

function scoreChunk(
  tokens: string[],
  chunk: KnowledgeChunk,
  intent: ChatIntent,
  questionLower: string
): number {
  if (tokens.length === 0 && intent === 'general') return 0;
  const expanded = expandQueryAliases(tokens);
  const keywordSet = new Set(chunk.keywords.flatMap((k) => tokenVariants(k)));
  const hayWords = wordSet(`${chunk.topic} ${chunk.text} ${chunk.keywords.join(' ')}`);
  let score = 0;
  for (const token of expanded) {
    const variants = tokenVariants(token);
    if (variants.some((v) => keywordSet.has(v))) score += 3;
    else if (variants.some((v) => hayWords.has(v))) score += 1.2;
  }

  const family = chunkFamily(chunk);
  if (intent !== 'general') {
    if (family === intent) score += 14;
    // Soft-penalize off-topic long blurbs that share vocabulary (e.g. "cloud" in experience).
    else if (family === 'experience' && intent === 'skills') score -= 8;
    else if (family === 'about' && intent === 'contact') score -= 6;
    else if (family !== intent && score > 0) score -= 4;
  }

  // Recommendations often name employers in quotes — never let them beat experience/skills.
  if (chunk.id.startsWith('rec-')) {
    if (intent === 'experience' || intent === 'skills' || intent === 'certifications') {
      score -= 18;
    } else {
      score -= 6;
    }
  }

  // Within skills, prefer the discipline that actually names cloud/security/etc.
  if (intent === 'skills' && family === 'skills') {
    if (
      chunk.id.includes('cloud') &&
      tokens.some((t) => /cloud|platform|aws|azure|gcp/.test(foldToken(t)))
    ) {
      score += 6;
    }
    if (chunk.id.includes('security') && tokens.some((t) => /secur|trust|zero/.test(foldToken(t)))) {
      score += 6;
    }
  }

  if (family === 'experience') {
    const wantsWorkDetail =
      /focus|secur|zero.?trust|project atlas|highlight|accomplish|built|build|work(ed)? on|did he do|what did/i.test(
        questionLower
      );
    if (wantsWorkDetail && /-role-/.test(chunk.id)) score += 6;
    if (/tcs|tata/.test(questionLower) && /tata|tcs/.test(chunk.id)) score += 10;
    if (/hcl/.test(questionLower) && /hcl/.test(chunk.id)) score += 10;
    if (
      /cisco/.test(chunk.id) &&
      (/cisco/.test(questionLower) || /current role/.test(questionLower))
    ) {
      score += 8;
    }
    // "before Cisco" / prior employers → prefer HCL + TCS company overviews over Cisco roles.
    if (isPriorEmployerQuestion(questionLower)) {
      if (/cisco-systems/.test(chunk.id)) score -= 20;
      if (/hcl|tata/.test(chunk.id)) {
        score += /-role-/.test(chunk.id) ? 8 : 16;
      }
    }
  }

  return score;
}

/** Keep answers short: prefer a few content sentences, hard-cap length. */
export function makeConciseAnswer(raw: string, maxChars = 360): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return cleaned;
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
  // Skip pure employer/tenure banners when richer sentences follow.
  const contentSentences = sentences.filter((s, i) => {
    if (sentences.length <= 1) return true;
    const t = s.trim();
    if (/^Employer:/i.test(t)) return false;
    if (/^Tenure\b/i.test(t)) return false;
    if (i === 0 && /\bCURRENT ROLE\b|\bFULL-TIME\b.*\bMOS\b/i.test(t) && t.length < 90) {
      return false;
    }
    return true;
  });
  const use = contentSentences.length > 0 ? contentSentences : sentences;
  let out = '';
  for (let i = 0; i < use.length; i++) {
    const sentence = use[i];
    const next = `${out}${sentence}`.trim();
    if (out && next.length > maxChars) break;
    out = next;
    // Allow more substance for experience/skills (was stopping ~120 chars / 2 sentences).
    if (out.length >= 280 && i >= 1) break;
    if (out.length >= 420 && i >= 0) break;
    if (out.length >= maxChars) break;
  }
  if (out.length > maxChars) {
    out = `${out.slice(0, maxChars - 1).trimEnd()}…`;
  }
  return out;
}

/** Fold punctuation/apostrophes so near-duplicate chips are filtered out. */
function normalizePrompt(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function promptsOverlap(a: string, b: string): boolean {
  const na = normalizePrompt(a);
  const nb = normalizePrompt(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const aWords = new Set(na.split(' ').filter((w) => w.length > 2 && !QUERY_STOP_WORDS.has(w)));
  const bWords = nb.split(' ').filter((w) => w.length > 2 && !QUERY_STOP_WORDS.has(w));
  if (bWords.length === 0) return false;
  const shared = bWords.filter((w) => aWords.has(w)).length;
  return shared / bWords.length >= 0.7;
}

function topicKeyForChunk(chunk: KnowledgeChunk): string {
  if (chunk.id.startsWith('exp-')) return 'experience';
  if (chunk.id.startsWith('skill-')) return 'skills';
  if (chunk.id.startsWith('cert-')) return 'certifications';
  if (chunk.id.startsWith('award-')) return 'awards';
  if (chunk.id.startsWith('edu-')) return 'education';
  return chunk.id;
}

function pushUniqueFollowUp(picked: string[], candidate: string, question: string): void {
  if (picked.length >= 3) return;
  if (promptsOverlap(question, candidate)) return;
  if (picked.some((item) => promptsOverlap(item, candidate))) return;
  picked.push(candidate);
}

/**
 * Build chips inclined to the prior question: chunk-specific first, then topic,
 * then unused starters — never echo the question just asked.
 */
function followUpsForChunks(
  chunks: KnowledgeChunk[],
  question: string,
  intent: ChatIntent = 'general'
): string[] {
  const picked: string[] = [];

  for (const chunk of chunks) {
    for (const row of FOLLOW_UPS_BY_CHUNK_PREFIX) {
      if (row.match.test(chunk.id)) {
        for (const item of row.prompts) pushUniqueFollowUp(picked, item, question);
      }
    }
  }

  const topicKeys = [
    intent !== 'general' ? intent : null,
    ...chunks.map((chunk) => topicKeyForChunk(chunk)),
  ].filter(Boolean) as string[];

  for (const key of topicKeys) {
    for (const item of FOLLOW_UPS_BY_TOPIC[key] || []) {
      pushUniqueFollowUp(picked, item, question);
    }
  }

  for (const s of SUGGESTIONS) {
    pushUniqueFollowUp(picked, s, question);
  }

  return picked.slice(0, 3);
}

export function buildChatAnswerFromChunks(
  questionRaw: string,
  ranked: Array<{ chunk: KnowledgeChunk; score: number }>,
  options?: { retrieval?: ChatAnswer['retrieval']; confidence?: number; topN?: number }
): ChatAnswer {
  const question = questionRaw.trim().slice(0, 500);
  const questionLower = question.toLowerCase();
  const intent = detectIntent(questionLower);
  const tokens = tokenizeQuery(question);
  const topN = options?.topN ?? 4;
  const top = ranked.filter((row) => row.score > 0).slice(0, Math.max(1, topN));
  const bestScore = top[0]?.score ?? 0;
  const confidence =
    typeof options?.confidence === 'number'
      ? Math.max(0, Math.min(1, options.confidence))
      : Math.max(0, Math.min(1, bestScore / Math.max(8, Math.max(tokens.length, 1) * 2.5)));
  const starterSuggestions = SUGGESTIONS.filter(
    (s) => !questionLower.includes(s.toLowerCase().slice(0, 18))
  ).slice(0, 4);
  const retrieval = options?.retrieval || 'keyword';

  if (top.length === 0 || confidence < 0.18) {
    return {
      answer:
        "I don’t have a confident match in the published portfolio. Try experience, skills, certifications, or contact — or ask Mohammed directly in this chat.",
      confidence,
      sources: [],
      suggestions: starterSuggestions,
      followUps: followUpsForChunks([], question, intent),
      offerLiveAgent: true,
      retrieval,
    };
  }

  const usedChunks = top.map((row) => row.chunk);
  const primary = usedChunks[0].text;
  const sameFamily =
    usedChunks[1] && chunkFamily(usedChunks[0]) === chunkFamily(usedChunks[1]);
  const secondary =
    usedChunks[1] && confidence > 0.45 && (retrieval !== 'keyword' || sameFamily)
      ? ` ${makeConciseAnswer(usedChunks[1].text, 140)}`
      : '';
  const answer = makeConciseAnswer(`${primary}${secondary}`, 720);
  const retrievalContext = usedChunks
    .map((chunk) => `${chunk.topic}: ${chunk.text}`)
    .join('\n\n')
    .slice(0, 8000);
  const followUps = followUpsForChunks(usedChunks, question, intent);

  return {
    answer,
    confidence,
    sources: usedChunks.map((chunk) => chunk.topic),
    suggestions: starterSuggestions,
    followUps,
    offerLiveAgent: confidence < 0.55 || /talk|human|agent|live|call|chat with/i.test(question),
    retrievalContext,
    retrieval,
  };
}

/** Prior-employer asks (before Cisco as employer — not “Cisco account” work at HCL). */
export function isPriorEmployerQuestion(questionLower: string): boolean {
  return /before cisco|prior to cisco|previous (to cisco|employer)|what did (he|mohammed|sufyan) do before\b/i.test(
    questionLower
  );
}

/**
 * Chronological career answer for “before Cisco”: HCL + TCS company overviews.
 * Avoids ranking only the latest HCL-on-Cisco-account role (which confuses LLM enrichment).
 */
export function composeBeforeCiscoAnswer(questionRaw: string): ChatAnswer | null {
  const question = questionRaw.trim().slice(0, 500);
  if (!isPriorEmployerQuestion(question.toLowerCase())) return null;

  const hclCompany = KNOWLEDGE.find((c) => c.id === 'exp-hcl-america-inc-hcltech');
  const tcsCompany = KNOWLEDGE.find((c) => c.id === 'exp-tata-consultancy-services');
  const hclRole = KNOWLEDGE.find((c) => c.id === 'exp-hcl-america-inc-hcltech-role-1');
  const tcsRole = KNOWLEDGE.find((c) => c.id === 'exp-tata-consultancy-services-role-1');
  if (!hclCompany || !tcsCompany) return null;

  const usedChunks = [hclCompany, tcsCompany, hclRole, tcsRole].filter(
    Boolean
  ) as KnowledgeChunk[];

  const answer = [
    'Before joining Cisco Systems Inc. as a Software Engineer (Aug 2026–Present), Mohammed spent about 7 years at HCL America Inc./HCLTech (Sep 2019–Aug 2026) and about 5 years 9 months at Tata Consultancy Services (Dec 2013–Aug 2019).',
    'At HCL he progressed from Technical Lead to Technical Manager/Architect, building cloud security, compliance, and vulnerability-orchestration platforms (often delivered on Cisco accounts).',
    'At TCS he grew from Assistant System Engineer Trainee to IT Analyst, including a London onshore client engagement and enterprise solution delivery.',
  ].join(' ');

  return {
    answer,
    confidence: 0.95,
    sources: usedChunks.map((c) => c.topic),
    suggestions: SUGGESTIONS.filter(
      (s) => !promptsOverlap(question, s)
    ).slice(0, 4),
    followUps: followUpsForChunks(usedChunks, question, 'experience'),
    offerLiveAgent: false,
    retrievalContext: usedChunks
      .map((chunk) => `${chunk.topic}: ${chunk.text}`)
      .join('\n\n')
      .slice(0, 8000),
    retrieval: 'keyword',
    composed: true,
  };
}

export function answerPortfolioQuestion(questionRaw: string): ChatAnswer {
  const question = questionRaw.trim().slice(0, 500);
  const social = answerConversationalUtterance(question);
  if (social) return social;
  const prior = composeBeforeCiscoAnswer(question);
  if (prior) return prior;

  // Structured answers for certs, awards, skills, education, contact, experience, etc.
  const structured = composePortfolioAnswer(question, KNOWLEDGE);
  if (structured) {
    return {
      ...structured,
      suggestions: structured.suggestions.length
        ? structured.suggestions
        : SUGGESTIONS.filter((s) => !promptsOverlap(question, s)).slice(0, 4),
    };
  }

  const questionLower = question.toLowerCase();
  const tokens = tokenizeQuery(question);
  const intent = detectIntent(questionLower);
  const ranked = KNOWLEDGE.map((chunk) => ({
    chunk,
    score: scoreChunk(tokens, chunk, intent, questionLower),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return buildChatAnswerFromChunks(question, ranked, { retrieval: 'keyword', topN: 4 });
}

export function listChatSuggestions(): string[] {
  return [...SUGGESTIONS];
}
