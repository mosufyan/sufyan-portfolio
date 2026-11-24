import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./portfolioVector.ts', () => ({
  answerPortfolioQuestionSmart: vi.fn(async () => ({
    answer: 'Mohammed is a Software Engineer at Cisco.',
    confidence: 0.8,
    sources: ['role'],
    followUps: ['What clouds has he used?'],
    offerLiveAgent: true,
  })),
}));

const shouldSkipGrokEnrichment = vi.fn(() => false);
const enrichAnswerWithGrokLlm = vi.fn(async () => ({
  answer: {
    answer: 'Enriched Cisco role answer.',
    confidence: 0.9,
    sources: ['role'],
    followUps: [],
    offerLiveAgent: true,
  },
  provider: 'grok' as const,
  latencyMs: 12,
}));

vi.mock('./grokLlm.ts', () => ({
  shouldSkipGrokEnrichment: ((...args: unknown[]) =>
    shouldSkipGrokEnrichment(...(args as []))) as typeof shouldSkipGrokEnrichment,
  enrichAnswerWithGrokLlm: ((...args: unknown[]) =>
    enrichAnswerWithGrokLlm(...(args as []))) as typeof enrichAnswerWithGrokLlm,
}));

vi.mock('./voiceStt.ts', () => ({
  isVoiceSttConfigured: vi.fn(() => true),
  resolveGrokApiKey: vi.fn(() => 'grok_api_key_ok'),
  transcribeAudioWithGrok: vi.fn(async () => ({
    ok: true,
    transcript: 'What is his role at Cisco?',
    latencyMs: 5,
  })),
}));

vi.mock('./voiceTts.ts', () => ({
  isVoiceTtsConfigured: vi.fn(() => true),
  synthesizeSpeechWithGrok: vi.fn(async () => ({
    ok: true,
    audioBase64: Buffer.from('audio').toString('base64'),
    mimeType: 'audio/mpeg',
    latencyMs: 8,
  })),
}));

import { answerVoiceQuestion, runVoiceTurn } from './voiceTurn.ts';

describe('voiceTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldSkipGrokEnrichment.mockReturnValue(false);
  });

  it('skips Grok enrichment when grounding is already strong (faster voice)', async () => {
    shouldSkipGrokEnrichment.mockReturnValue(true);
    const result = await answerVoiceQuestion({
      question: 'What did he do before Cisco?',
      enableLlm: true,
      grokApiKey: 'grok_api_key_value',
      offerLiveAgent: true,
    });
    expect(result.provider).toBe('grounded');
    expect(result.llmUsed).toBe(false);
    expect(enrichAnswerWithGrokLlm).not.toHaveBeenCalled();
  });

  it('orchestrates STT → answer → optional TTS', async () => {
    const result = await runVoiceTurn({
      audio: Buffer.from('fake'),
      mimeType: 'audio/webm',
      enableLlm: false,
      grokApiKey: '',
      offerLiveAgent: true,
      enableCloudTts: true,
    });

    expect(result.ok).toBe(true);
    expect(result.transcript).toMatch(/Cisco/);
    expect(result.answer?.answer).toMatch(/Cisco/);
    expect(result.provider).toBe('grounded');
    expect(result.ttsProvider).toBe('grok');
    expect(result.audioBase64).toBeTruthy();
  });

  it('uses Grok enrichment when enabled', async () => {
    const result = await runVoiceTurn({
      audio: Buffer.from('fake'),
      mimeType: 'audio/webm',
      enableLlm: true,
      grokApiKey: 'grok_api_key_value',
      offerLiveAgent: false,
      enableCloudTts: false,
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('grok');
    expect(result.llmUsed).toBe(true);
    expect(result.answer?.offerLiveAgent).toBe(false);
    expect(result.ttsProvider).toBe('none');
  });
});
