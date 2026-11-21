import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  classForEvent,
  drainDigestItems,
  peekDigestItems,
  prefsFromPortfolioSettings,
  resetOwnerNotifyForTests,
  routeOwnerNotification,
  shouldQueueDigest,
  shouldSendImmediate,
} from './ownerNotify.ts';
import { DEFAULT_PORTFOLIO_SETTINGS } from '../src/utils/ownerGovernance.ts';

describe('ownerNotify', () => {
  beforeEach(() => {
    resetOwnerNotifyForTests();
  });

  it('maps portfolio settings into notify prefs with live chat as urgent by default', () => {
    const prefs = prefsFromPortfolioSettings(DEFAULT_PORTFOLIO_SETTINGS);
    expect(prefs.alertEmailEnabled).toBe(true);
    expect(classForEvent(prefs, 'live_chat')).toBe('urgent');
    expect(classForEvent(prefs, 'new_inquiry')).toBe('digest');
    expect(shouldSendImmediate(prefs, 'urgent')).toBe(true);
    expect(shouldSendImmediate(prefs, 'digest')).toBe(false);
    expect(shouldQueueDigest(prefs, 'digest')).toBe(true);
  });

  it('sends urgent events immediately and queues digest copies', async () => {
    const prefs = prefsFromPortfolioSettings(DEFAULT_PORTFOLIO_SETTINGS);
    const sendImmediate = vi.fn(async () => undefined);
    const outcome = await routeOwnerNotification({
      prefs,
      eventType: 'live_chat',
      title: 'New live chat from Alex',
      detail: 'alex@example.com started a verified session.',
      dedupeKey: 'live:alex@example.com:1',
      sendImmediate,
    });
    expect(outcome).toBe('sent');
    expect(sendImmediate).toHaveBeenCalledOnce();
    expect(peekDigestItems().length).toBe(1);
  });

  it('queues digest-class events without immediate email', async () => {
    const prefs = prefsFromPortfolioSettings(DEFAULT_PORTFOLIO_SETTINGS);
    const sendImmediate = vi.fn(async () => undefined);
    const outcome = await routeOwnerNotification({
      prefs,
      eventType: 'new_inquiry',
      title: 'New inquiry',
      detail: 'Verified contact form submission.',
      dedupeKey: 'inq:1',
      sendImmediate,
    });
    expect(outcome).toBe('queued');
    expect(sendImmediate).not.toHaveBeenCalled();
    expect(drainDigestItems().length).toBe(1);
    expect(peekDigestItems().length).toBe(0);
  });

  it('dedupes repeated events inside the window', async () => {
    const prefs = prefsFromPortfolioSettings({
      ...DEFAULT_PORTFOLIO_SETTINGS,
      alertClassLiveChat: 'urgent',
    });
    const sendImmediate = vi.fn(async () => undefined);
    const first = await routeOwnerNotification({
      prefs,
      eventType: 'live_chat',
      title: 'Live chat',
      detail: 'one',
      dedupeKey: 'same-key',
      sendImmediate,
    });
    const second = await routeOwnerNotification({
      prefs,
      eventType: 'live_chat',
      title: 'Live chat',
      detail: 'two',
      dedupeKey: 'same-key',
      sendImmediate,
    });
    expect(first).toBe('sent');
    expect(second).toBe('duplicate');
    expect(sendImmediate).toHaveBeenCalledOnce();
  });

  it('skips when master email alerts are disabled', async () => {
    const prefs = prefsFromPortfolioSettings({
      ...DEFAULT_PORTFOLIO_SETTINGS,
      alertEmailEnabled: false,
    });
    const outcome = await routeOwnerNotification({
      prefs,
      eventType: 'risk_download',
      title: 'Risk',
      detail: 'vpn',
      dedupeKey: 'risk:1',
      sendImmediate: async () => undefined,
    });
    expect(outcome).toBe('skipped');
  });
});
