/**
 * Pure helpers for durable owner metrics / chat snapshots (Firestore + Redis).
 * Keeps merge/sanitize logic testable without Admin SDK or Upstash.
 */

export interface SiteTelemetryState {
  pageviews: number;
  ogShares: number;
  ogByTrack: Record<string, number>;
  updatedAtIso: string;
}

const OG_TRACKS = ['executive', 'security', 'platform', 'ai'] as const;

export function emptySiteTelemetry(now = new Date()): SiteTelemetryState {
  return {
    pageviews: 0,
    ogShares: 0,
    ogByTrack: {},
    updatedAtIso: now.toISOString(),
  };
}

export function sanitizeOgByTrack(raw: unknown): Record<string, number> {
  const out: Record<string, number> = Object.create(null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const src = raw as Record<string, unknown>;
  for (const id of OG_TRACKS) {
    const n = Number(src[id]);
    if (Number.isFinite(n) && n > 0) out[id] = Math.floor(n);
  }
  return out;
}

export function sanitizeSiteTelemetry(raw: unknown): SiteTelemetryState {
  const defaults = emptySiteTelemetry();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
  const parsed = raw as Partial<SiteTelemetryState>;
  return {
    pageviews: Math.max(0, Math.floor(Number(parsed.pageviews) || 0)),
    ogShares: Math.max(0, Math.floor(Number(parsed.ogShares) || 0)),
    ogByTrack: sanitizeOgByTrack(parsed.ogByTrack),
    updatedAtIso:
      typeof parsed.updatedAtIso === 'string' && parsed.updatedAtIso
        ? parsed.updatedAtIso
        : defaults.updatedAtIso,
  };
}

/** Prefer the higher counters so a stale empty replica cannot wipe durable state. */
export function mergeSiteTelemetry(
  local: SiteTelemetryState,
  remote: SiteTelemetryState
): SiteTelemetryState {
  const ogByTrack: Record<string, number> = { ...local.ogByTrack };
  for (const id of OG_TRACKS) {
    const a = Number(local.ogByTrack[id]) || 0;
    const b = Number(remote.ogByTrack[id]) || 0;
    const max = Math.max(a, b);
    if (max > 0) ogByTrack[id] = max;
    else delete ogByTrack[id];
  }
  const localTs = Date.parse(local.updatedAtIso) || 0;
  const remoteTs = Date.parse(remote.updatedAtIso) || 0;
  return {
    pageviews: Math.max(local.pageviews, remote.pageviews),
    ogShares: Math.max(local.ogShares, remote.ogShares),
    ogByTrack,
    updatedAtIso: remoteTs >= localTs ? remote.updatedAtIso : local.updatedAtIso,
  };
}

export const OWNER_METRICS_SITE_DOC = 'site';
export const OWNER_METRICS_CHAT_DOC = 'chat_cache';
export const OWNER_METRICS_COLLECTION = 'owner_metrics';
export const SITE_TELEMETRY_REDIS_KEY = 'owner:site-telemetry';
