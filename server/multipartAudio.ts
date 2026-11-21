/**
 * Parse a single audio file field from multipart/form-data without multer.
 * Uses @fastify/busboy (direct dependency).
 */
import type { IncomingMessage } from 'http';
import { Busboy } from '@fastify/busboy';

export const VOICE_AUDIO_MAX_BYTES = 3 * 1024 * 1024; // 3 MB
export const VOICE_AUDIO_FIELD = 'audio';

const ALLOWED_MIME = new Set([
  'audio/webm',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'video/webm',
]);

export interface ParsedMultipartAudio {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  fields: Record<string, string>;
}

export interface ParseMultipartAudioOptions {
  maxBytes?: number;
  fieldName?: string;
}

function normalizeMime(raw: string): string {
  return (raw || '').split(';')[0].trim().toLowerCase();
}

export function isAllowedAudioMime(mimeType: string): boolean {
  const m = normalizeMime(mimeType);
  return ALLOWED_MIME.has(m) || m.startsWith('audio/');
}

export function parseMultipartAudio(
  req: IncomingMessage,
  options: ParseMultipartAudioOptions = {}
): Promise<ParsedMultipartAudio> {
  const maxBytes = options.maxBytes ?? VOICE_AUDIO_MAX_BYTES;
  const fieldName = options.fieldName ?? VOICE_AUDIO_FIELD;
  const contentType = String(req.headers['content-type'] || '');

  return new Promise((resolve, reject) => {
    if (!/multipart\/form-data/i.test(contentType)) {
      reject(new Error('Content-Type must be multipart/form-data.'));
      return;
    }

    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const succeed = (value: ParsedMultipartAudio) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let fileBufs: Buffer[] = [];
    let fileSize = 0;
    let mimeType = '';
    let filename = '';
    let sawFile = false;
    const fields: Record<string, string> = Object.create(null);

    let bb: InstanceType<typeof Busboy>;
    try {
      bb = new Busboy({
        headers: { 'content-type': contentType },
        limits: {
          files: 1,
          fileSize: maxBytes,
          fields: 12,
          fieldSize: 4_096,
        },
      });
    } catch (err) {
      fail(err instanceof Error ? err : new Error('Invalid multipart headers.'));
      return;
    }

    bb.on('file', (name, stream, fileName, _encoding, fileMime) => {
      if (name !== fieldName) {
        stream.resume();
        return;
      }
      sawFile = true;
      mimeType = normalizeMime(fileMime || '');
      filename = String(fileName || 'utterance.webm').slice(0, 120);
      stream.on('data', (chunk: Buffer) => {
        fileSize += chunk.length;
        if (fileSize > maxBytes) {
          stream.destroy();
          fail(new Error('Audio file exceeds size limit.'));
          return;
        }
        fileBufs.push(chunk);
      });
      stream.on('limit', () => {
        fail(new Error('Audio file exceeds size limit.'));
      });
      stream.on('error', (err: Error) => fail(err));
    });

    bb.on('field', (name, value) => {
      if (typeof name === 'string' && typeof value === 'string') {
        fields[name.slice(0, 64)] = value.slice(0, 4_000);
      }
    });

    bb.on('error', (err: Error) => fail(err));
    bb.on('finish', () => {
      if (!sawFile) {
        fail(new Error('Missing audio file field.'));
        return;
      }
      const buffer = Buffer.concat(fileBufs);
      fileBufs = [];
      if (!buffer.length) {
        fail(new Error('Empty audio file.'));
        return;
      }
      if (!isAllowedAudioMime(mimeType || 'audio/webm')) {
        fail(new Error('Unsupported audio type.'));
        return;
      }
      succeed({
        buffer,
        mimeType: mimeType || 'audio/webm',
        filename: filename || 'utterance.webm',
        fields,
      });
    });

    req.pipe(bb);
  });
}
