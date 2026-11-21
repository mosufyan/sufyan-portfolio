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
  /** Contextual follow-up questions for the chat chip strip (replaces starters after each ask). */
  followUps: string[];
  offerLiveAgent: boolean;
  /** Richer multi-chunk text for LLM enrichment (falls back to `answer` when unset). */
  retrievalContext?: string;
  /** How the answer was retrieved. */
  retrieval?: 'keyword' | 'vector' | 'hybrid';
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
      // Lead with roles/highlights so concise answers are not just tenure headers.
      text: `${roleBits} At ${company.company}${company.location ? ` (${company.location})` : ''}; tenure ${company.tenure}.`.slice(
        0,
        1600
      ),
      keywords: tokenize(
        `${company.company} ${company.roles.map((r) => `${r.role} ${(r.highlights || []).join(' ')}`).join(' ')} experience career`
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
      keywords: tokenize(
        `${cat.name} ${names} certification certifications certificate certificates cert certs certified license accredited credential credentials aws azure gcp hold holds`
      ),
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
  const keywordSet = new Set(chunk.keywords.flatMap((k) => tokenVariants(k)));
  const hayWords = wordSet(`${chunk.topic} ${chunk.text} ${chunk.keywords.join(' ')}`);
  let score = 0;
  for (const token of tokens) {
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

  if (
    family === 'experience' &&
    /cisco/.test(chunk.id) &&
    (/cisco/.test(questionLower) || /current role/.test(questionLower))
  ) {
    score += 8;
  }

  return score;
}

/** Keep answers short: prefer 1–2 sentences, hard-cap length. */
export function makeConciseAnswer(raw: string, maxChars = 360): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return cleaned;
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
  let out = '';
  for (const sentence of sentences) {
    const next = `${out}${sentence}`.trim();
    if (out && next.length > maxChars) break;
    out = next;
    if (out.length >= 120 && sentences.indexOf(sentence) >= 1) break;
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
  const topN = options?.topN ?? 2;
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
  const answer = makeConciseAnswer(`${primary}${secondary}`, 360);
  const retrievalContext = usedChunks
    .map((chunk) => `${chunk.topic}: ${chunk.text}`)
    .join('\n\n')
    .slice(0, 2200);
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

export function answerPortfolioQuestion(questionRaw: string): ChatAnswer {
  const question = questionRaw.trim().slice(0, 500);
  const questionLower = question.toLowerCase();
  const tokens = tokenizeQuery(question);
  const intent = detectIntent(questionLower);
  const ranked = KNOWLEDGE.map((chunk) => ({
    chunk,
    score: scoreChunk(tokens, chunk, intent, questionLower),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return buildChatAnswerFromChunks(question, ranked, { retrieval: 'keyword', topN: 2 });
}

export function listChatSuggestions(): string[] {
  return [...SUGGESTIONS];
}
