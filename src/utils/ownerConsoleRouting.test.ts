import { describe, expect, it } from 'vitest';
import {
  buildOwnerConsoleHash,
  composeOwnerReplySubject,
  parseOwnerConsoleHash,
} from './ownerConsoleRouting';

describe('ownerConsoleRouting', () => {
  it('parses owner console hash sections and cms tabs', () => {
    expect(parseOwnerConsoleHash('#owner/messages')).toEqual({
      open: true,
      section: 'messages',
      cmsTab: 'announcements',
    });
    expect(parseOwnerConsoleHash('#owner/chat')).toEqual({
      open: true,
      section: 'chat',
      cmsTab: 'announcements',
    });
    expect(parseOwnerConsoleHash('#owner/cms')).toEqual({
      open: true,
      section: 'cms',
      cmsTab: 'announcements',
    });
    expect(parseOwnerConsoleHash('#owner/cms/credentials')).toEqual({
      open: true,
      section: 'cms',
      cmsTab: 'credentials',
    });
    expect(parseOwnerConsoleHash('#owner/cms/experience')).toEqual({
      open: true,
      section: 'cms',
      cmsTab: 'experience',
    });
    // Legacy deep links collapse into the CMS hub
    expect(parseOwnerConsoleHash('#owner/credentials')).toEqual({
      open: true,
      section: 'cms',
      cmsTab: 'credentials',
    });
    expect(parseOwnerConsoleHash('#owner/experience')).toEqual({
      open: true,
      section: 'cms',
      cmsTab: 'experience',
    });
    expect(parseOwnerConsoleHash('#owner/ciscoRole')).toEqual({
      open: true,
      section: 'cms',
      cmsTab: 'experience',
    });
    expect(parseOwnerConsoleHash('#/owner/profile')).toEqual({
      open: true,
      section: 'profile',
      cmsTab: 'announcements',
    });
    expect(parseOwnerConsoleHash('#owner')).toEqual({
      open: true,
      section: 'profile',
      cmsTab: 'announcements',
    });
    expect(parseOwnerConsoleHash('#experience')).toEqual({
      open: false,
      section: 'profile',
      cmsTab: 'announcements',
    });
    expect(parseOwnerConsoleHash('#owner/not-a-tab')).toEqual({
      open: true,
      section: 'profile',
      cmsTab: 'announcements',
    });
  });

  it('builds console hashes and reply subjects', () => {
    expect(buildOwnerConsoleHash('cms', 'recognition')).toBe('#owner/cms/recognition');
    expect(buildOwnerConsoleHash('cms')).toBe('#owner/cms/announcements');
    expect(buildOwnerConsoleHash('settings')).toBe('#owner/settings');
    expect(composeOwnerReplySubject('Architecture inquiry')).toBe('Re: Architecture inquiry');
    expect(composeOwnerReplySubject('Re: Already threaded')).toBe('Re: Already threaded');
  });
});
