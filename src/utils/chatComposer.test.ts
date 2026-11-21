import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHAT_QUICK_EMOJIS,
  detectClientEnvironment,
  ensureMicrophoneAccess,
  getMicrophoneEnableHelp,
  isSpeechToTextSupported,
  microphoneHelpForSpeechError,
} from './chatComposer.ts';

describe('chatComposer', () => {
  it('exposes a compact curated emoji set', () => {
    expect(CHAT_QUICK_EMOJIS.length).toBeGreaterThanOrEqual(12);
    expect(CHAT_QUICK_EMOJIS.length).toBeLessThanOrEqual(24);
    expect(CHAT_QUICK_EMOJIS).toContain('👍');
  });

  it('reports speech support without throwing in jsdom', () => {
    expect(typeof isSpeechToTextSupported()).toBe('boolean');
  });

  it('detects major platforms from user agents', () => {
    expect(
      detectClientEnvironment(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      ).platform
    ).toBe('ios');
    expect(
      detectClientEnvironment(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      ).platform
    ).toBe('android');
    expect(
      detectClientEnvironment(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'MacIntel'
      ).platform
    ).toBe('mac');
    expect(
      detectClientEnvironment(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Win32'
      ).platform
    ).toBe('windows');
  });

  it('returns platform-specific mic enable steps', () => {
    const ios = getMicrophoneEnableHelp(
      detectClientEnvironment(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
      )
    );
    expect(ios.title.toLowerCase()).toMatch(/iphone|ipad/);
    expect(ios.steps.length).toBeGreaterThan(1);

    const win = getMicrophoneEnableHelp(
      detectClientEnvironment(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Win32'
      )
    );
    expect(win.title.toLowerCase()).toContain('windows');
  });

  it('maps not-allowed speech errors to enable help', () => {
    const help = microphoneHelpForSpeechError('not-allowed');
    expect(help.steps.length).toBeGreaterThan(0);
    expect(help.title.toLowerCase()).toMatch(/microphone|allow/);
  });

  it('always calls getUserMedia so the browser Ask popup can appear', async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop }],
    });
    vi.stubGlobal('window', {
      isSecureContext: true,
    });
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia },
      permissions: {
        query: vi.fn().mockResolvedValue({ state: 'denied' }),
      },
    });

    const result = await ensureMicrophoneAccess();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result).toEqual({ ok: true });
    expect(stop).toHaveBeenCalled();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
