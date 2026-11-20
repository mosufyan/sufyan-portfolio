/**
 * Optional Cursor Cloud Agents API enrichment for portfolio chat.
 * Cursor does not expose a chat-completions endpoint; this uses a no-repo
 * Cloud Agent run with grounded portfolio context, then falls back on timeout.
 */
import { answerPortfolioQuestion, type ChatAnswer } from './chatKnowledge.ts';

export interface CursorLlmOptions {
  apiKey: string;
  modelId?: string;
  timeoutMs?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface CursorLlmResult {
  answer: ChatAnswer;
  provider: 'cursor' | 'grounded';
  agentId?: string;
  runId?: string;
  latencyMs: number;
  error?: string;
}

const DEFAULT_BASE = 'https://api.cursor.com';
const DEFAULT_TIMEOUT_MS = 12_000;

function authHeader(apiKey: string): string {
  return `Bearer ${apiKey}`;
}

function buildPrompt(question: string, grounded: ChatAnswer): string {
  const context =
    grounded.sources.length > 0
      ? grounded.answer
      : 'No high-confidence portfolio facts matched. Say you are unsure and suggest live chat or the contact form.';
  return [
    'You are the portfolio assistant for Mohammed Sufyan (mohammedsufyan.com).',
    'Reply with a concise answer only: 1–3 short sentences of plain text (max ~80 words).',
    'Use ONLY the provided portfolio context. Do not invent employers, titles, dates, or certifications.',
    'Do not use tools, edit files, browse the web, or mention being a coding agent.',
    'Do not list follow-up questions in the answer body — the UI adds those separately.',
    'If the context is insufficient, say so briefly and invite the visitor to ask Mohammed in chat.',
    '',
    'PORTFOLIO CONTEXT:',
    context,
    '',
    `VISITOR QUESTION: ${question.slice(0, 500)}`,
    '',
    'FINAL ANSWER:',
  ].join('\n');
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readRunText(
  baseUrl: string,
  apiKey: string,
  agentId: string,
  runId: string,
  fetchImpl: typeof fetch
): Promise<string | null> {
  const res = await fetchImpl(`${baseUrl}/v1/agents/${agentId}/runs/${runId}`, {
    method: 'GET',
    headers: { Authorization: authHeader(apiKey) },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    status?: string;
    text?: string;
    result?: { text?: string };
  };
  const text = (body.text || body.result?.text || '').trim();
  if (text) return text;
  const status = (body.status || '').toUpperCase();
  if (['FINISHED', 'COMPLETED', 'CANCELLED', 'FAILED', 'ERROR'].includes(status) && !text) {
    return null;
  }
  return null;
}

async function cancelRun(
  baseUrl: string,
  apiKey: string,
  agentId: string,
  runId: string,
  fetchImpl: typeof fetch
): Promise<void> {
  try {
    await fetchImpl(`${baseUrl}/v1/agents/${agentId}/runs/${runId}/cancel`, {
      method: 'POST',
      headers: { Authorization: authHeader(apiKey) },
    });
  } catch {
    /* ignore */
  }
}

export function isCursorLlmConfigured(apiKey = process.env.CURSOR_API_KEY || ''): boolean {
  return Boolean(apiKey && apiKey.trim().length >= 8);
}

export async function enrichAnswerWithCursorLlm(
  question: string,
  options: CursorLlmOptions
): Promise<CursorLlmResult> {
  const started = Date.now();
  const grounded = answerPortfolioQuestion(question);
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    return { answer: grounded, provider: 'grounded', latencyMs: Date.now() - started };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = (options.baseUrl || process.env.CURSOR_API_BASE_URL || DEFAULT_BASE).replace(
    /\/$/,
    ''
  );
  const timeoutMs = Math.min(
    60_000,
    Math.max(3_000, options.timeoutMs || Number(process.env.CHAT_LLM_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS)
  );

  let agentId: string | undefined;
  let runId: string | undefined;

  try {
    const payload: Record<string, unknown> = {
      name: 'portfolio-chat',
      prompt: { text: buildPrompt(question, grounded) },
    };
    const modelId = (options.modelId || '').trim();
    if (modelId) {
      payload.model = { id: modelId };
    }

    const createRes = await fetchImpl(`${baseUrl}/v1/agents`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => '');
      return {
        answer: grounded,
        provider: 'grounded',
        latencyMs: Date.now() - started,
        error: `Cursor API ${createRes.status}: ${errText.slice(0, 180)}`,
      };
    }

    const created = (await createRes.json()) as {
      id?: string;
      agent?: { id?: string };
      run?: { id?: string };
      runId?: string;
    };
    agentId = created.agent?.id || created.id;
    runId = created.run?.id || created.runId;
    if (!agentId || !runId) {
      return {
        answer: grounded,
        provider: 'grounded',
        latencyMs: Date.now() - started,
        error: 'Cursor API response missing agent/run id',
      };
    }

    const deadline = started + timeoutMs;
    while (Date.now() < deadline) {
      const text = await readRunText(baseUrl, apiKey, agentId, runId, fetchImpl);
      if (text) {
        return {
          answer: {
            ...grounded,
            answer: text.slice(0, 1800),
            confidence: Math.max(grounded.confidence, 0.55),
          },
          provider: 'cursor',
          agentId,
          runId,
          latencyMs: Date.now() - started,
        };
      }
      await sleep(700);
    }

    void cancelRun(baseUrl, apiKey, agentId, runId, fetchImpl);
    return {
      answer: grounded,
      provider: 'grounded',
      agentId,
      runId,
      latencyMs: Date.now() - started,
      error: 'Cursor LLM timed out; served grounded answer',
    };
  } catch (err) {
    return {
      answer: grounded,
      provider: 'grounded',
      agentId,
      runId,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : 'Cursor LLM failed',
    };
  }
}
