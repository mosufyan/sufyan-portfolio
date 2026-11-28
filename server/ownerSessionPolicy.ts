/**
 * Owner console server-session policy (idle + absolute).
 * Used with Firebase session cookies + server-side activity metadata.
 */

/** Sign out after this much inactivity (no successful owner API / touch). */
export const OWNER_SESSION_IDLE_TTL_MS = 15 * 60 * 1000;

/** Hard cap from session issue time; "Stay signed in" does not extend this. */
export const OWNER_SESSION_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;

/** Soft-warning window before idle or absolute expiry. */
export const OWNER_SESSION_WARN_WINDOW_MS = 2 * 60 * 1000;

export const OWNER_SESSION_COOKIE_NAME = 'owner_session';

export type OwnerSessionExpiryReason = 'idle' | 'absolute' | null;

export interface OwnerSessionTimingInput {
  issuedAt: number;
  lastActivityAt: number;
  now?: number;
  idleTtlMs?: number;
  absoluteTtlMs?: number;
  warnWindowMs?: number;
}

export interface OwnerSessionTimingResult {
  ok: boolean;
  reason: OwnerSessionExpiryReason;
  idleRemainingMs: number;
  absoluteRemainingMs: number;
  warn: boolean;
}

export function evaluateOwnerSessionTiming(
  input: OwnerSessionTimingInput
): OwnerSessionTimingResult {
  const now = input.now ?? Date.now();
  const idleTtl = input.idleTtlMs ?? OWNER_SESSION_IDLE_TTL_MS;
  const absoluteTtl = input.absoluteTtlMs ?? OWNER_SESSION_ABSOLUTE_TTL_MS;
  const warnWindow = input.warnWindowMs ?? OWNER_SESSION_WARN_WINDOW_MS;

  const idleRemainingMs = Math.max(0, input.lastActivityAt + idleTtl - now);
  const absoluteRemainingMs = Math.max(0, input.issuedAt + absoluteTtl - now);

  if (absoluteRemainingMs <= 0) {
    return {
      ok: false,
      reason: 'absolute',
      idleRemainingMs,
      absoluteRemainingMs: 0,
      warn: false,
    };
  }
  if (idleRemainingMs <= 0) {
    return {
      ok: false,
      reason: 'idle',
      idleRemainingMs: 0,
      absoluteRemainingMs,
      warn: false,
    };
  }

  const warn =
    idleRemainingMs <= warnWindow || absoluteRemainingMs <= warnWindow;

  return {
    ok: true,
    reason: null,
    idleRemainingMs,
    absoluteRemainingMs,
    warn,
  };
}
