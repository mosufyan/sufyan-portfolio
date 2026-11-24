import { describe, expect, it } from 'vitest';
import {
  emptySiteTelemetry,
  mergeSiteTelemetry,
  sanitizeSiteTelemetry,
} from './ownerDurableState.ts';

describe('ownerDurableState', () => {
  it('sanitizes telemetry and rejects junk', () => {
    expect(sanitizeSiteTelemetry(null).pageviews).toBe(0);
    const clean = sanitizeSiteTelemetry({
      pageviews: 12.9,
      ogShares: -3,
      ogByTrack: { executive: 2, evil: 9, security: '1' },
      updatedAtIso: '2026-01-01T00:00:00.000Z',
    });
    expect(clean.pageviews).toBe(12);
    expect(clean.ogShares).toBe(0);
    expect(clean.ogByTrack).toEqual({ executive: 2, security: 1 });
    expect(clean.updatedAtIso).toBe('2026-01-01T00:00:00.000Z');
  });

  it('merges remote and local by taking the higher counters', () => {
    const local = {
      ...emptySiteTelemetry(),
      pageviews: 5,
      ogShares: 1,
      ogByTrack: { executive: 1 },
      updatedAtIso: '2026-01-01T00:00:00.000Z',
    };
    const remote = {
      ...emptySiteTelemetry(),
      pageviews: 40,
      ogShares: 0,
      ogByTrack: { executive: 3, ai: 2 },
      updatedAtIso: '2026-01-02T00:00:00.000Z',
    };
    const merged = mergeSiteTelemetry(local, remote);
    expect(merged.pageviews).toBe(40);
    expect(merged.ogShares).toBe(1);
    expect(merged.ogByTrack).toEqual({ executive: 3, ai: 2 });
    expect(merged.updatedAtIso).toBe('2026-01-02T00:00:00.000Z');
  });
});
