import { describe, expect, it } from 'vitest';
import { toUserFacingError } from './userFacingError.ts';

describe('toUserFacingError', () => {
  it('maps permission-denied without leaking auth JSON', () => {
    const leaked = JSON.stringify({
      error: 'Missing or insufficient permissions.',
      authInfo: { userId: 'abc', email: 'sufyan.net@gmail.com' },
      operationType: 'write',
      path: 'portfolio_settings/global',
    });
    const msg = toUserFacingError(new Error(leaked), 'Unable to save site controls.');
    expect(msg.toLowerCase()).toMatch(/firestore|rules|blocked/);
    expect(msg).not.toContain('sufyan.net@gmail.com');
    expect(msg).not.toContain('portfolio_settings');
    expect(msg).not.toContain('userId');
    expect(msg).not.toContain('{');
  });

  it('uses Firebase error codes when present', () => {
    const err = Object.assign(new Error('SECRET path=/x'), { code: 'permission-denied' });
    expect(toUserFacingError(err)).toMatch(/firestore|rules|blocked/i);
    expect(toUserFacingError(err)).not.toContain('SECRET');
  });

  it('keeps short clean API messages', () => {
    expect(toUserFacingError(new Error('Please complete the bot verification challenge.'))).toBe(
      'Please complete the bot verification challenge.'
    );
  });

  it('falls back for empty or junk input', () => {
    expect(toUserFacingError(null, 'Fallback copy.')).toBe('Fallback copy.');
    expect(toUserFacingError(new Error(''), 'Fallback copy.')).toBe('Fallback copy.');
  });
});
