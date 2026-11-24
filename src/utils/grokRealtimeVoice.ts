/**
 * Browser helper for Grok Voice 3.0 speech-to-speech over WebSocket.
 * Uses ephemeral client secrets from /api/chat/voice/realtime-session.
 */

export type RealtimeSessionBootstrap = {
  token: string;
  wsUrl: string;
  voice?: string;
  instructions?: string;
  tools?: unknown[];
};

export type RealtimeVoiceHandlers = {
  onStatus?: (status: string) => void;
  onTranscript?: (role: 'visitor' | 'assistant', text: string) => void;
  onError?: (message: string) => void;
  /** 0..1 RMS-ish level for waveform UI; source is mic capture or assistant playback. */
  onAudioLevel?: (level: number, source: 'mic' | 'playback') => void;
  /** Called when the model invokes portfolio_answer; return tool result text. */
  onPortfolioTool?: (question: string) => Promise<string>;
};

function rmsLevel(samples: ArrayLike<number>, scale = 1): number {
  let sum = 0;
  const n = samples.length;
  if (!n) return 0;
  for (let i = 0; i < n; i++) {
    const v = Number(samples[i]) * scale;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / n));
}

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export class GrokRealtimeVoiceSession {
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private playbackContext: AudioContext | null = null;
  private nextPlayTime = 0;
  private closed = false;
  private activeResponseId: string | null = null;
  private cancelledResponseIds = new Set<string>();
  private playingSources = new Set<AudioBufferSourceNode>();
  private lastLevelEmitMs = 0;

  constructor(
    private readonly bootstrap: RealtimeSessionBootstrap,
    private readonly handlers: RealtimeVoiceHandlers = {}
  ) {}

  private emitLevel(level: number, source: 'mic' | 'playback'): void {
    if (!this.handlers.onAudioLevel) return;
    const now = Date.now();
    // Cap UI updates ~20fps while still responsive.
    if (now - this.lastLevelEmitMs < 50 && level < 0.02) return;
    if (now - this.lastLevelEmitMs < 40) return;
    this.lastLevelEmitMs = now;
    this.handlers.onAudioLevel(level, source);
  }

  async start(): Promise<void> {
    if (this.ws) return;
    this.closed = false;
    this.handlers.onStatus?.('Connecting…');

    const protocols = [`xai-client-secret.${this.bootstrap.token}`];
    this.ws = new WebSocket(this.bootstrap.wsUrl, protocols);
    this.ws.addEventListener('open', () => {
      this.handlers.onStatus?.('Connected — configuring…');
      this.ws?.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            voice: this.bootstrap.voice || 'eve',
            instructions: this.bootstrap.instructions,
            tools: this.bootstrap.tools || [],
            turn_detection: { type: 'server_vad' },
            audio: {
              input: { format: { type: 'audio/pcm', rate: 24000 } },
              output: { format: { type: 'audio/pcm', rate: 24000 } },
            },
          },
        })
      );
    });

    this.ws.addEventListener('message', (event) => {
      void this.handleMessage(String(event.data || ''));
    });
    this.ws.addEventListener('error', () => {
      this.handlers.onError?.('Live voice connection failed.');
    });
    this.ws.addEventListener('close', () => {
      this.handlers.onStatus?.('Disconnected');
      void this.stop();
    });

    await this.startMic();
  }

  async stop(): Promise<void> {
    this.closed = true;
    this.clearPlayback();
    try {
      this.processor?.disconnect();
    } catch {
      /* ignore */
    }
    this.processor = null;
    try {
      await this.audioContext?.close();
    } catch {
      /* ignore */
    }
    this.audioContext = null;
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    try {
      await this.playbackContext?.close();
    } catch {
      /* ignore */
    }
    this.playbackContext = null;
    this.nextPlayTime = 0;
    this.activeResponseId = null;
    this.cancelledResponseIds.clear();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
    this.ws = null;
  }

  private interruptAssistant(): void {
    if (this.activeResponseId) this.cancelledResponseIds.add(this.activeResponseId);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'response.cancel' }));
    }
    this.clearPlayback();
    this.handlers.onStatus?.('Listening — speak naturally');
  }

  private clearPlayback(): void {
    for (const source of this.playingSources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.playingSources.clear();
    if (this.playbackContext) {
      this.nextPlayTime = this.playbackContext.currentTime;
    } else {
      this.nextPlayTime = 0;
    }
  }

  private async startMic(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    // ScriptProcessor is deprecated but widely supported for PCM capture without a worklet file.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (ev) => {
      if (this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const input = ev.inputBuffer.getChannelData(0);
      this.emitLevel(rmsLevel(input) * 2.2, 'mic');
      const pcm = floatTo16BitPCM(input);
      this.ws.send(
        JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: arrayBufferToBase64(pcm),
        })
      );
    };
    source.connect(this.processor);
    // Keep the processor graph alive without monitoring the mic locally.
    const silent = this.audioContext.createGain();
    silent.gain.value = 0;
    this.processor.connect(silent);
    silent.connect(this.audioContext.destination);
    this.handlers.onStatus?.('Listening — speak naturally');
  }

  private async handleMessage(raw: string): Promise<void> {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    const type = String(event.type || '');
    const responseId =
      typeof event.response_id === 'string'
        ? event.response_id
        : typeof event.responseId === 'string'
          ? event.responseId
          : null;

    if (type === 'session.updated' || type === 'session.created') {
      this.handlers.onStatus?.('Live conversation ready');
    }

    if (type === 'input_audio_buffer.speech_started') {
      this.interruptAssistant();
      return;
    }

    if (type === 'response.created') {
      const id =
        responseId ||
        (typeof event.response === 'object' &&
        event.response &&
        'id' in (event.response as object)
          ? String((event.response as { id?: string }).id || '')
          : '');
      if (id) {
        this.activeResponseId = id;
        this.cancelledResponseIds.delete(id);
      }
      this.handlers.onStatus?.('Assistant speaking…');
    }

    if (type === 'response.done' || type === 'response.cancelled') {
      if (responseId && responseId === this.activeResponseId) this.activeResponseId = null;
      if (type === 'response.cancelled' && responseId) this.cancelledResponseIds.add(responseId);
      this.handlers.onStatus?.('Listening — speak naturally');
    }

    if (type === 'response.output_audio.delta' && typeof event.delta === 'string') {
      if (responseId && this.cancelledResponseIds.has(responseId)) return;
      if (this.activeResponseId && responseId && responseId !== this.activeResponseId) return;
      this.enqueuePlayback(base64ToArrayBuffer(event.delta));
    }

    if (
      type === 'response.output_audio_transcript.done' &&
      typeof event.transcript === 'string' &&
      event.transcript.trim()
    ) {
      if (responseId && this.cancelledResponseIds.has(responseId)) return;
      this.handlers.onTranscript?.('assistant', event.transcript.trim());
    }

    if (
      type === 'conversation.item.input_audio_transcription.completed' &&
      typeof event.transcript === 'string' &&
      event.transcript.trim()
    ) {
      this.handlers.onTranscript?.('visitor', event.transcript.trim());
    }

    if (type === 'response.function_call_arguments.done') {
      if (responseId && this.cancelledResponseIds.has(responseId)) return;
      const name = String(event.name || '');
      const callId = String(event.call_id || event.callId || '');
      const argsRaw = String(event.arguments || '{}');
      let question = '';
      try {
        const parsed = JSON.parse(argsRaw) as { question?: string };
        question = (parsed.question || '').trim();
      } catch {
        question = '';
      }
      if (name === 'portfolio_answer' && question && this.handlers.onPortfolioTool) {
        const result = await this.handlers.onPortfolioTool(question);
        if (this.closed || (responseId && this.cancelledResponseIds.has(responseId))) return;
        this.ws?.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: result.slice(0, 4000),
            },
          })
        );
        this.ws?.send(JSON.stringify({ type: 'response.create' }));
      }
    }

    if (type === 'error') {
      const msg =
        typeof event.error === 'object' && event.error && 'message' in (event.error as object)
          ? String((event.error as { message?: string }).message || 'Live voice error')
          : 'Live voice error';
      // Cancel races often surface as benign errors — ignore cancel-related noise.
      if (/cancel/i.test(msg)) return;
      this.handlers.onError?.(msg);
    }
  }

  private enqueuePlayback(pcm: ArrayBuffer): void {
    if (!pcm.byteLength || this.closed) return;
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;
    }
    const ctx = this.playbackContext;
    const samples = new Int16Array(pcm);
    const floats = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) floats[i] = samples[i] / 0x8000;
    this.emitLevel(rmsLevel(floats) * 1.8, 'playback');
    const buffer = ctx.createBuffer(1, floats.length, 24000);
    buffer.copyToChannel(floats, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => this.playingSources.delete(source);
    this.playingSources.add(source);
    const startAt = Math.max(ctx.currentTime, this.nextPlayTime);
    try {
      source.start(startAt);
      this.nextPlayTime = startAt + buffer.duration;
    } catch {
      this.playingSources.delete(source);
    }
  }
}
