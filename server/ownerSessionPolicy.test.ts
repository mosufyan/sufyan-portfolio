import { describe, expect, it } from 'vitest';
import {
  OWNER_SESSION_ABSOLUTE_TTL_MS,
  OWNER_SESSION_IDLE_TTL_MS,
  OWNER_SESSION_WARN_WINDOW_MS,
  evaluateOwnerSessionTiming,
} from './ownerSessionPolicy.ts';

describe('evaluateOwnerSessionTiming', () => {
  const issuedAt = 1_000_000;
  const lastActivityAt = 1_000_000;

  it('is ok when within idle and absolute windows', () => {
    const result = evaluateOwnerSessionTiming({
      issuedAt,
      lastActivityAt,
      now: issuedAt + 60_000,
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.warn).toBe(false);
    expect(result.idleRemainingMs).toBe(OWNER_SESSION_IDLE_TTL_MS - 60_000);
    expect(result.absoluteRemainingMs).toBe(OWNER_SESSION_ABSOLUTE_TTL_MS - 60_000);
  });

  it('expires on idle timeout', () => {
    const result = evaluateOwnerSessionTiming({
      issuedAt,
      lastActivityAt,
      now: lastActivityAt + OWNER_SESSION_IDLE_TTL_MS + 1,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('idle');
    expect(result.idleRemainingMs).toBe(0);
  });

  it('expires on absolute timeout even if recently active', () => {
    const now = issuedAt + OWNER_SESSION_ABSOLUTE_TTL_MS + 1;
    const result = evaluateOwnerSessionTiming({
      issuedAt,
      lastActivityAt: now - 1_000,
      now,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('absolute');
    expect(result.absoluteRemainingMs).toBe(0);
  });

  it('warns when within the soft-warning window for idle', () => {
    const result = evaluateOwnerSessionTiming({
      issuedAt,
      lastActivityAt,
      now: lastActivityAt + OWNER_SESSION_IDLE_TTL_MS - OWNER_SESSION_WARN_WINDOW_MS + 1,
    });
    expect(result.ok).toBe(true);
    expect(result.warn).toBe(true);
  });

  it('warns when within the soft-warning window for absolute', () => {
    const result = evaluateOwnerSessionTiming({
      issuedAt,
      lastActivityAt: issuedAt + OWNER_SESSION_ABSOLUTE_TTL_MS - 60_000,
      now: issuedAt + OWNER_SESSION_ABSOLUTE_TTL_MS - OWNER_SESSION_WARN_WINDOW_MS + 1,
    });
    expect(result.ok).toBe(true);
    expect(result.warn).toBe(true);
  });

  it('prefers absolute over idle when both expired', () => {
    const now = issuedAt + OWNER_SESSION_ABSOLUTE_TTL_MS + OWNER_SESSION_IDLE_TTL_MS;
    const result = evaluateOwnerSessionTiming({
      issuedAt,
      lastActivityAt: issuedAt,
      now,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('absolute');
  });
});
