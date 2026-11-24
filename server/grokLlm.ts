/**
 * Optional Grok (xAI) enrichment for portfolio chat.
 * Uses chat completions with grounded portfolio context; falls back on error/timeout.
 */
import { answerPortfolioQuestion, type ChatAnswer } from './chatKnowledge.ts';

export interface GrokLlmOptions {
  apiKey: string;
  modelId?: string;
  timeoutMs?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Precomputed grounded answer (keyword/vector). */
  grounded?: ChatAnswer;
}

export interface GrokLlmResult {
  answer: ChatAnswer;
  provider: 'grok' | 'grounded';
  latencyMs: number;
  error?: string;
}

const DEFAULT_BASE = 'https://api.x.ai/v1';
const DEFAULT_MODEL = 'grok-4.3';
const DEFAULT_TIMEOUT_MS = 8_000;

/** Skip Grok when retrieval already has a strong factual match (faster chat + voice). */
export function shouldSkipGrokEnrichment(question: string, grounded: ChatAnswer): boolean {
  const q = question.toLowerCase();
  // Structured composers already produce visitor-ready answers — skip LLM latency/hedging.
  if (grounded.composed && grounded.confidence >= 0.9 && grounded.sources.length > 0) {
    // Still allow Grok for explicit compare / deep-dive asks that need synthesis across angles.
    if (!/\b(compare|versus|vs\.?|deep dive|in detail|walk me through)\b/i.test(q)) {
      return true;
    }
  }
  const wantsSynthesis =
    /summar|overview|compare|walk me through|tell me about|explain|deep dive|in detail|focus|secur|zero.?trust|what did/i.test(
      q
    );
  if (wantsSynthesis) return false;
  // Thin company/tenure banners need LLM phrasing even when confidence is high.
  if (/^.{0,40}\b(CURRENT ROLE|FULL-TIME|Tenure)\b/i.test(grounded.answer) && grounded.answer.length < 220) {
    return false;
  }
  const ctxLen = grounded.retrievalContext?.length || 0;
  return grounded.confidence >= 0.72 && ctxLen >= 180 && grounded.sources.length > 0;
}

function buildMessages(question: string, grounded: ChatAnswer): Array<{ role: string; content: string }> {
  const context =
    grounded.sources.length > 0
      ? (grounded.retrievalContext || grounded.answer).slice(0, 7000)
      : 'No high-confidence portfolio facts matched. Say you are unsure and suggest live chat or the contact form.';
  return [
    {
      role: 'system',
      content: [
        'You are the portfolio assistant for Mohammed Sufyan (mohammedsufyan.com).',
        'Answer in plain text: 2–5 sentences (or a short bullet list when listing roles/certs), max ~160 words.',
        'Use ONLY the provided portfolio context. Prefer concrete employers, titles, dates, tech, and outcomes from the context.',
        'Do not invent employers, titles, dates, or certifications.',
        'Do not mention retrieval sources, chunk IDs, or “according to the context”.',
        'Do not list follow-up questions in the answer body — the UI adds those separately.',
        'HCL America/HCLTech work delivered on Cisco accounts is still HCL employment — not the same as his current Cisco Systems Inc. job.',
        'When the visitor asks what he did before Cisco and context includes HCL and TCS/Tata, summarize both prior employers chronologically. Never claim earlier history is missing if those tenures are in context.',
        'For certification questions, state the total count when present and summarize by category (AI, Cloud/DevOps, Data). Do not dump credential URLs.',
        'If the context is insufficient, say so briefly and invite the visitor to ask Mohammed in chat.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        'PORTFOLIO CONTEXT:',
        context,
        '',
        `VISITOR QUESTION: ${question.slice(0, 500)}`,
      ].join('\n'),
    },
  ];
}

export function isGrokLlmConfigured(apiKey = process.env.GROK_API_KEY || ''): boolean {
  return Boolean(apiKey && apiKey.trim().length >= 8);
}

export async function enrichAnswerWithGrokLlm(
  question: string,
  options: GrokLlmOptions
): Promise<GrokLlmResult> {
  const started = Date.now();
  const grounded = options.grounded || answerPortfolioQuestion(question);
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    return { answer: grounded, provider: 'grounded', latencyMs: Date.now() - started };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = (options.baseUrl || process.env.GROK_API_BASE_URL || DEFAULT_BASE).replace(
    /\/$/,
    ''
  );
  const timeoutMs = Math.min(
    60_000,
    Math.max(3_000, options.timeoutMs || Number(process.env.CHAT_LLM_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS)
  );
  const modelId = (options.modelId || '').trim() || DEFAULT_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: buildMessages(question, grounded),
        temperature: 0.2,
        max_tokens: 420,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        answer: grounded,
        provider: 'grounded',
        latencyMs: Date.now() - started,
        error: `Grok API ${res.status}: ${errText.slice(0, 180)}`,
      };
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = (body.choices?.[0]?.message?.content || '').trim();
    if (!text) {
      return {
        answer: grounded,
        provider: 'grounded',
        latencyMs: Date.now() - started,
        error: 'Grok API returned empty content',
      };
    }

    return {
      answer: {
        ...grounded,
        answer: text.slice(0, 2800),
        confidence: Math.max(grounded.confidence, 0.55),
      },
      provider: 'grok',
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      answer: grounded,
      provider: 'grounded',
      latencyMs: Date.now() - started,
      error: aborted
        ? 'Grok LLM timed out; served grounded answer'
        : err instanceof Error
          ? err.message
          : 'Grok LLM failed',
    };
  } finally {
    clearTimeout(timer);
  }
}
