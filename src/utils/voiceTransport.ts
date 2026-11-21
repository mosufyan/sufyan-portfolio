/**
 * Voice agent transport abstraction.
 * v1: HTTP push-to-talk (`HttpTurnTransport`).
 * v2 (future): StreamingTransport over WebSocket/WebRTC without rewriting ChatWidget.
 */

export interface VoiceTurnRequest {
  audio: Blob;
  sessionId?: string;
  receipt?: string;
  visitorId?: string;
}

export interface VoiceTurnResponse {
  ok: boolean;
  status?: number;
  transcript?: string;
  answer?: string;
  sources?: string[];
  followUps?: string[];
  suggestions?: string[];
  provider?: 'grok' | 'grounded' | string;
  ttsProvider?: 'elevenlabs' | 'none' | string;
  audioBase64?: string;
  audioMimeType?: string;
  ownerOnline?: boolean;
  error?: string;
  code?: string;
  remaining?: { questions?: number; llm?: number; voice?: number };
}

export interface VoiceTransport {
  readonly kind: 'http-turn' | 'streaming';
  submitUtterance(request: VoiceTurnRequest): Promise<VoiceTurnResponse>;
}

function headersForReceipt(receipt?: string): HeadersInit {
  return receipt ? { 'X-Chat-Receipt': receipt } : {};
}

/** v1 push-to-talk transport — POST multipart to /api/chat/voice/turn */
export class HttpTurnTransport implements VoiceTransport {
  readonly kind = 'http-turn' as const;

  constructor(private readonly endpoint = '/api/chat/voice/turn') {}

  async submitUtterance(request: VoiceTurnRequest): Promise<VoiceTurnResponse> {
    const form = new FormData();
    const ext = request.audio.type.includes('ogg')
      ? 'ogg'
      : request.audio.type.includes('wav')
        ? 'wav'
        : 'webm';
    form.append('audio', request.audio, `utterance.${ext}`);
    if (request.sessionId) form.append('sessionId', request.sessionId);
    if (request.receipt) form.append('receipt', request.receipt);
    if (request.visitorId) form.append('visitorId', request.visitorId);

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: headersForReceipt(request.receipt),
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as VoiceTurnResponse;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error || `Voice turn failed (${res.status}).`,
        code: data.code,
        transcript: data.transcript,
      };
    }
    return { ...data, ok: true, status: res.status };
  }
}

/** Factory kept narrow so a future StreamingTransport can plug in here. */
export function createVoiceTransport(
  kind: 'http-turn' = 'http-turn'
): VoiceTransport {
  if (kind === 'http-turn') return new HttpTurnTransport();
  return new HttpTurnTransport();
}
