/**
 * Push-to-talk voice turn orchestration:
 * STT (Groq) → portfolio RAG/Grok answer → optional TTS (ElevenLabs).
 */
import type { ChatAnswer } from './chatKnowledge.ts';
import { enrichAnswerWithGrokLlm } from './grokLlm.ts';
import { answerPortfolioQuestionSmart } from './portfolioVector.ts';
import { isVoiceSttConfigured, transcribeAudioWithGroq, type VoiceSttOptions } from './voiceStt.ts';
import {
  isVoiceTtsConfigured,
  synthesizeSpeechWithElevenLabs,
  type VoiceTtsOptions,
} from './voiceTts.ts';

export interface VoiceTurnAnswerOptions {
  question: string;
  enableLlm: boolean;
  grokApiKey: string;
  chatLlmModel?: string;
  offerLiveAgent: boolean;
}

export interface VoiceTurnAnswerResult {
  answer: ChatAnswer;
  provider: 'grok' | 'grounded';
  llmUsed: boolean;
}

export interface VoiceTurnFullOptions {
  audio: Buffer;
  mimeType: string;
  filename?: string;
  enableLlm: boolean;
  grokApiKey: string;
  chatLlmModel?: string;
  offerLiveAgent: boolean;
  enableCloudTts: boolean;
  stt?: VoiceSttOptions;
  tts?: VoiceTtsOptions;
}

export interface VoiceTurnFullResult {
  ok: boolean;
  transcript?: string;
  answer?: ChatAnswer;
  provider?: 'grok' | 'grounded';
  llmUsed?: boolean;
  audioBase64?: string;
  audioMimeType?: string;
  ttsProvider?: 'elevenlabs' | 'none';
  error?: string;
  sttLatencyMs?: number;
  ttsLatencyMs?: number;
}

export async function answerVoiceQuestion(
  options: VoiceTurnAnswerOptions
): Promise<VoiceTurnAnswerResult> {
  const question = options.question.trim();
  let answer = await answerPortfolioQuestionSmart(question);
  let provider: 'grok' | 'grounded' = 'grounded';
  let llmUsed = false;

  if (options.enableLlm && options.grokApiKey.trim()) {
    const enriched = await enrichAnswerWithGrokLlm(question, {
      apiKey: options.grokApiKey,
      modelId: options.chatLlmModel,
      grounded: answer,
    });
    answer = {
      ...enriched.answer,
      followUps: enriched.answer.followUps?.length
        ? enriched.answer.followUps
        : answer.followUps,
      retrieval: answer.retrieval,
      retrievalContext: answer.retrievalContext,
    };
    provider = enriched.provider;
    llmUsed = enriched.provider === 'grok';
  }

  if (!options.offerLiveAgent) {
    answer = { ...answer, offerLiveAgent: false };
  }

  return { answer, provider, llmUsed };
}

export async function runVoiceTurn(
  options: VoiceTurnFullOptions
): Promise<VoiceTurnFullResult> {
  if (!isVoiceSttConfigured(options.stt?.apiKey ?? process.env.GROQ_API_KEY)) {
    return { ok: false, error: 'Voice agent speech recognition is not configured.' };
  }

  const stt = await transcribeAudioWithGroq(options.audio, {
    ...options.stt,
    mimeType: options.mimeType,
    filename: options.filename,
  });
  if (!stt.ok || !stt.transcript) {
    return {
      ok: false,
      error: stt.error || 'Unable to transcribe audio.',
      sttLatencyMs: stt.latencyMs,
    };
  }

  const transcript = stt.transcript.trim();
  if (transcript.length < 3) {
    return {
      ok: false,
      transcript,
      error: 'Please speak a longer question (at least a few words).',
      sttLatencyMs: stt.latencyMs,
    };
  }

  const answered = await answerVoiceQuestion({
    question: transcript,
    enableLlm: options.enableLlm,
    grokApiKey: options.grokApiKey,
    chatLlmModel: options.chatLlmModel,
    offerLiveAgent: options.offerLiveAgent,
  });

  let audioBase64: string | undefined;
  let audioMimeType: string | undefined;
  let ttsProvider: 'elevenlabs' | 'none' = 'none';
  let ttsLatencyMs: number | undefined;

  if (
    options.enableCloudTts &&
    isVoiceTtsConfigured(options.tts?.apiKey ?? process.env.ELEVENLABS_API_KEY)
  ) {
    const tts = await synthesizeSpeechWithElevenLabs(answered.answer.answer, options.tts);
    ttsLatencyMs = tts.latencyMs;
    if (tts.ok && tts.audioBase64) {
      audioBase64 = tts.audioBase64;
      audioMimeType = tts.mimeType || 'audio/mpeg';
      ttsProvider = 'elevenlabs';
    }
  }

  return {
    ok: true,
    transcript,
    answer: answered.answer,
    provider: answered.provider,
    llmUsed: answered.llmUsed,
    audioBase64,
    audioMimeType,
    ttsProvider,
    sttLatencyMs: stt.latencyMs,
    ttsLatencyMs,
  };
}
