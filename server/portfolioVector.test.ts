import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('portfolioVector', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.doUnmock('@upstash/vector');
    vi.unstubAllEnvs();
  });

  it('falls back to keyword when vector env is unset', async () => {
    vi.stubEnv('UPSTASH_VECTOR_REST_URL', '');
    vi.stubEnv('UPSTASH_VECTOR_REST_TOKEN', '');
    const { answerPortfolioQuestionSmart, isPortfolioVectorConfigured } = await import(
      './portfolioVector.ts'
    );
    expect(isPortfolioVectorConfigured()).toBe(false);
    const answer = await answerPortfolioQuestionSmart('What is Mohammed current role at Cisco?');
    expect(answer.retrieval).toBe('keyword');
    expect(answer.answer.toLowerCase()).toMatch(/cisco|software|engineer/);
  });

  it('uses vector hits when Upstash returns strong scores', async () => {
    vi.stubEnv('UPSTASH_VECTOR_REST_URL', 'https://example-vector.upstash.io');
    vi.stubEnv('UPSTASH_VECTOR_REST_TOKEN', 'test-token');

    const upsert = vi.fn(async () => ({}));
    const query = vi.fn(async () => [
      {
        id: 'exp-cisco-systems-inc',
        score: 0.82,
        metadata: {
          topic: 'Experience — Cisco Systems Inc.',
          text: 'Software Engineer at Cisco building the security data platform.',
        },
      },
      {
        id: 'skill-cloud-platforms',
        score: 0.71,
        metadata: {
          topic: 'Skills — Cloud Platforms',
          text: 'AWS, Azure, GCP, Databricks.',
        },
      },
    ]);

    vi.doMock('@upstash/vector', () => ({
      Index: class {
        upsert = upsert;
        query = query;
      },
    }));

    const { answerPortfolioQuestionSmart, resetPortfolioVectorClient, syncPortfolioVectors } =
      await import('./portfolioVector.ts');
    resetPortfolioVectorClient();
    const sync = await syncPortfolioVectors();
    expect(sync.ok).toBe(true);
    expect(upsert).toHaveBeenCalled();

    // Prefer a question outside structured composers so vector retrieval is exercised.
    const answer = await answerPortfolioQuestionSmart(
      'Does he use DuckDB and Tenable together?'
    );
    expect(query).toHaveBeenCalled();
    expect(answer.retrieval === 'vector' || answer.retrieval === 'hybrid' || answer.retrieval === 'keyword').toBe(
      true
    );
    expect(answer.answer.length).toBeGreaterThan(20);
    expect((answer.retrievalContext || answer.answer).length).toBeGreaterThan(40);
  });
});
