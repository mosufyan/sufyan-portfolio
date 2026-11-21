import { describe, expect, it } from 'vitest';
import {
  CHAT_WINDOW_DEFAULT,
  CHAT_WINDOW_MIN,
  clampChatWindowSize,
  expandedChatWindowSize,
} from './chatWindowLayout.ts';

describe('chatWindowLayout', () => {
  it('clamps below minimum and above viewport', () => {
    expect(clampChatWindowSize({ width: 10, height: 10 }, { width: 1000, height: 800 })).toEqual({
      width: CHAT_WINDOW_MIN.width,
      height: CHAT_WINDOW_MIN.height,
    });
    const big = clampChatWindowSize({ width: 5000, height: 5000 }, { width: 900, height: 700 });
    expect(big.width).toBe(900 - 24);
    expect(big.height).toBe(700 - 88);
  });

  it('keeps defaults when values are omitted', () => {
    expect(clampChatWindowSize({}, { width: 1400, height: 900 })).toEqual({
      ...CHAT_WINDOW_DEFAULT,
    });
  });

  it('builds an expanded size within the viewport', () => {
    const size = expandedChatWindowSize({ width: 1280, height: 800 });
    expect(size.width).toBeGreaterThanOrEqual(CHAT_WINDOW_MIN.width);
    expect(size.width).toBeLessThanOrEqual(1280 - 24);
    expect(size.height).toBe(800 - 88);
  });
});
