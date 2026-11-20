import { describe, expect, it } from 'vitest';
import {
  buildOwnerConsoleHash,
  composeOwnerReplySubject,
  parseOwnerConsoleHash,
} from './ownerConsoleRouting';

describe('ownerConsoleRouting', () => {
  it('parses owner console hash sections', () => {
    expect(parseOwnerConsoleHash('#owner/messages')).toEqual({ open: true, section: 'messages' });
    expect(parseOwnerConsoleHash('#/owner/profile')).toEqual({ open: true, section: 'profile' });
    expect(parseOwnerConsoleHash('#owner')).toEqual({ open: true, section: 'profile' });
    expect(parseOwnerConsoleHash('#experience')).toEqual({ open: false, section: 'profile' });
    expect(parseOwnerConsoleHash('#owner/not-a-tab')).toEqual({ open: true, section: 'profile' });
  });

  it('builds console hashes and reply subjects', () => {
    expect(buildOwnerConsoleHash('settings')).toBe('#owner/settings');
    expect(composeOwnerReplySubject('Architecture inquiry')).toBe('Re: Architecture inquiry');
    expect(composeOwnerReplySubject('Re: Already threaded')).toBe('Re: Already threaded');
  });
});
