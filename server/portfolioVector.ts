/**
 * Upstash Vector RAG for portfolio chat.
 * Uses Upstash-hosted embeddings (upsert-data / query-data) when
 * UPSTASH_VECTOR_REST_URL + UPSTASH_VECTOR_REST_TOKEN are set.
 */
import { Index } from '@upstash/vector';
import {
  answerPortfolioQuestion,
  buildChatAnswerFromChunks,
  listKnowledgeChunks,
  type ChatAnswer,
  type KnowledgeChunk,
} from './chatKnowledge.ts';

type VectorMeta = {
  topic?: string;
  text?: string;
  keywords?: string[];
};

let cachedIndex: Index | null | undefined;
let syncPromise: Promise<{ ok: boolean; count: number; error?: string }> | null = null;
let lastSyncedChunkCount = -1;

export function isPortfolioVectorConfigured(
  url = process.env.UPSTASH_VECTOR_REST_URL || '',
  token = process.env.UPSTASH_VECTOR_REST_TOKEN || ''
): boolean {
  return Boolean(url.trim() && token.trim());
}

function getIndex(): Index | null {
  if (cachedIndex !== undefined) return cachedIndex;
  const url = (process.env.UPSTASH_VECTOR_REST_URL || '').trim();
  const token = (process.env.UPSTASH_VECTOR_REST_TOKEN || '').trim();
  if (!url || !token) {
    cachedIndex = null;
    return null;
  }
  cachedIndex = new Index({ url, token });
  return cachedIndex;
}

/** Reset cached client (tests). */
export function resetPortfolioVectorClient(): void {
  cachedIndex = undefined;
  syncPromise = null;
  lastSyncedChunkCount = -1;
}

function chunkToUpsert(chunk: KnowledgeChunk) {
  // Include keywords so semantic search can match role/employer/tech synonyms.
  const keywordLine = chunk.keywords.slice(0, 24).join(' ');
  return {
    id: chunk.id,
    data: `${chunk.topic}\n${chunk.text}\nKeywords: ${keywordLine}`,
    metadata: {
      topic: chunk.topic,
      text: chunk.text,
      keywords: chunk.keywords.slice(0, 40),
    } satisfies VectorMeta,
  };
}

/** Light lexical boost so "Cisco clouds" does not lose to unrelated high-similarity blurbs. */
function rerankVectorHits(
  question: string,
  ranked: Array<{ chunk: KnowledgeChunk; score: number }>
): Array<{ chunk: KnowledgeChunk; score: number }> {
  const q = question.toLowerCase();
  return ranked
    .map((row) => {
      let score = row.score;
      const id = row.chunk.id.toLowerCase();
      const topic = row.chunk.topic.toLowerCase();
      if (/cisco/.test(q) && (/cisco/.test(id) || /cisco/.test(topic))) score += 0.12;
      if (/cloud|aws|azure|gcp|databricks/.test(q) && /cloud|platform/.test(id)) score += 0.08;
      if (/certif/.test(q) && id.startsWith('cert-')) score += 0.1;
      if (/contact|email|hire/.test(q) && id === 'contact') score += 0.12;
      if (/open to|opportunit|hiring/.test(q) && id === 'open-to') score += 0.1;
      // Soft-penalize generic about/open-to when the question is specific.
      if ((id === 'about' || id === 'open-to') && /cisco|cloud|certif|award|hcl|tcs/.test(q)) {
        score -= 0.08;
      }
      return { chunk: row.chunk, score };
    })
    .sort((a, b) => b.score - a.score);
}

export async function syncPortfolioVectors(): Promise<{
  ok: boolean;
  count: number;
  error?: string;
}> {
  const index = getIndex();
  if (!index) return { ok: false, count: 0, error: 'Upstash Vector not configured' };

  const chunkCount = listKnowledgeChunks().length;
  // Re-upsert when the local corpus grows/shrinks (e.g. after RAG expansion).
  if (syncPromise && lastSyncedChunkCount !== -1 && lastSyncedChunkCount !== chunkCount) {
    syncPromise = null;
  }

  if (!syncPromise) {
    syncPromise = (async () => {
      try {
        const chunks = listKnowledgeChunks();
        const payload = chunks.map(chunkToUpsert);
        // Batch in groups of 50 (well under free-plan write limits).
        for (let i = 0; i < payload.length; i += 50) {
          await index.upsert(payload.slice(i, i + 50));
        }
        lastSyncedChunkCount = payload.length;
        return { ok: true, count: payload.length };
      } catch (err) {
        syncPromise = null;
        return {
          ok: false,
          count: 0,
          error: err instanceof Error ? err.message : 'Vector sync failed',
        };
      }
    })();
  }
  return syncPromise;
}

function chunkFromHit(
  id: string,
  metadata: VectorMeta | undefined,
  byId: Map<string, KnowledgeChunk>
): KnowledgeChunk | null {
  const local = byId.get(id);
  if (local) return local;
  if (metadata?.text && metadata?.topic) {
    return {
      id,
      topic: metadata.topic,
      text: metadata.text,
      keywords: metadata.keywords || [],
    };
  }
  return null;
}

/**
 * Retrieve with Upstash Vector; fall back to keyword ranking when unset/weak.
 */
export async function answerPortfolioQuestionSmart(questionRaw: string): Promise<ChatAnswer> {
  const question = questionRaw.trim().slice(0, 500);
  const keyword = answerPortfolioQuestion(question);
  // Keep structured portfolio answers (certs/awards/skills/…) — vector dump would regress quality.
  if (keyword.composed && keyword.confidence >= 0.9) {
    return keyword;
  }
  const index = getIndex();
  if (!index) return keyword;

  try {
    // Ensure corpus is present (no-op after first successful sync).
    const sync = await syncPortfolioVectors();
    if (!sync.ok) return keyword;

    const results = await index.query({
      data: question,
      topK: 8,
      includeMetadata: true,
    });

    const byId = new Map(listKnowledgeChunks().map((c) => [c.id, c]));
    const ranked: Array<{ chunk: KnowledgeChunk; score: number }> = [];
    for (const hit of results) {
      const id = String(hit.id);
      const chunk = chunkFromHit(id, hit.metadata as VectorMeta | undefined, byId);
      if (!chunk) continue;
      const score = typeof hit.score === 'number' ? hit.score : 0;
      ranked.push({ chunk, score });
    }

    if (ranked.length === 0) return { ...keyword, retrieval: 'keyword' };

    const reranked = rerankVectorHits(question, ranked);
    const best = reranked[0].score;
    // Cosine scores are typically ~0.3–0.9 for related text with BGE-small.
    if (best < 0.35) {
      return { ...keyword, retrieval: 'keyword' };
    }

    // Hybrid: merge strong keyword hits that vector missed (e.g. exact skill discipline).
    const hybridRanked = [...reranked]
      // Recommendations naming an employer in a quote must not outrank experience.
      .map((row) =>
        row.chunk.id.startsWith('rec-') &&
        /cisco|hcl|tcs|tata|experience|role|focus|secur/i.test(question)
          ? { ...row, score: row.score * 0.35 }
          : row
      );
    const qLower = question.toLowerCase();
    if (
      /before cisco|prior to cisco|previous (to cisco|employer)|what did (he|mohammed|sufyan) do before\b/i.test(
        qLower
      )
    ) {
      // Prefer the composed keyword career answer (HCL + TCS) over vector-only HCL/Cisco-account hits.
      if (
        keyword.confidence >= 0.85 &&
        /hcl/i.test(keyword.answer) &&
        /tcs|tata/i.test(keyword.answer)
      ) {
        return { ...keyword, retrieval: 'hybrid' };
      }
      for (const row of hybridRanked) {
        if (/cisco-systems/.test(row.chunk.id)) row.score *= 0.2;
        if (/hcl|tata/.test(row.chunk.id) && row.chunk.id.startsWith('exp-')) {
          const companyBoost = /-role-/.test(row.chunk.id) ? 0.15 : 0.35;
          row.score = Math.max(row.score, best) + companyBoost;
        }
      }
      for (const id of [
        'exp-hcl-america-inc-hcltech',
        'exp-tata-consultancy-services',
        'exp-hcl-america-inc-hcltech-role-1',
        'exp-tata-consultancy-services-role-1',
      ]) {
        const prior = listKnowledgeChunks().find((c) => c.id === id);
        if (prior && !hybridRanked.some((r) => r.chunk.id === prior.id)) {
          hybridRanked.push({
            chunk: prior,
            score: Math.max(best, 0.7) + (id.includes('-role-') ? 0.2 : 0.35),
          });
        }
      }
    } else if (/cisco/.test(qLower)) {
      const cisco = listKnowledgeChunks().find(
        (c) => c.id === 'exp-cisco-systems-inc-role-1' || c.id === 'exp-cisco-systems-inc'
      );
      if (cisco && !hybridRanked.some((r) => r.chunk.id === cisco.id)) {
        hybridRanked.push({ chunk: cisco, score: Math.max(best, 0.7) + 0.05 });
      }
    }
    if (/tcs|tata/.test(qLower)) {
      let sawTcs = false;
      for (const row of hybridRanked) {
        if (row.chunk.id.startsWith('exp-tata')) {
          row.score = Math.max(row.score, best) + 0.15;
          sawTcs = true;
        }
      }
      if (!sawTcs) {
        const tcs =
          listKnowledgeChunks().find((c) => c.id.startsWith('exp-tata') && c.id.includes('-role-')) ||
          listKnowledgeChunks().find((c) => c.id.startsWith('exp-tata'));
        if (tcs) hybridRanked.push({ chunk: tcs, score: Math.max(best, 0.7) + 0.15 });
      }
    }
    if (keyword.sources.length > 0 && keyword.confidence >= 0.45) {
      for (const source of keyword.sources.slice(0, 3)) {
        const match = listKnowledgeChunks().find((c) => c.topic === source);
        if (!match) continue;
        const boost = match.id.startsWith('exp-') ? 0.18 : 0.05;
        const existing = hybridRanked.find((r) => r.chunk.id === match.id);
        if (existing) {
          existing.score = Math.max(existing.score, best) + boost;
        } else {
          hybridRanked.push({ chunk: match, score: Math.max(0.55, best) + boost });
        }
      }
    }
    hybridRanked.sort((a, b) => b.score - a.score);

    // If vector still tops with a recommendation/testimonial but keyword has a
    // strong experience/skills hit, trust keyword (prevents TCS→LinkedIn rec misses).
    const topId = hybridRanked[0]?.chunk.id || '';
    if (
      topId.startsWith('rec-') &&
      keyword.confidence >= 0.45 &&
      keyword.sources.some((s) => /experience|skills|certification|award/i.test(s))
    ) {
      return { ...keyword, retrieval: 'keyword' };
    }

    const confidence = Math.max(0.2, Math.min(0.98, best));
    return buildChatAnswerFromChunks(question, hybridRanked, {
      retrieval: hybridRanked.length > reranked.length ? 'hybrid' : 'vector',
      confidence,
      topN: 5,
    });
  } catch {
    return keyword;
  }
}
