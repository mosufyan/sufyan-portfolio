/**
 * Owner email notification router: urgent / warning immediate mail, digest queue.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { OwnerAlertClass, OwnerAlertEventType, PortfolioSettings } from '../src/utils/ownerGovernance.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, '..', '.owner-alert-digest-cache.json');
const DEDUPE_MS = 15 * 60 * 1000;
const MAX_DIGEST = 80;

export interface OwnerNotifyPrefs {
  alertEmailEnabled: boolean;
  alertEmailUrgent: boolean;
  alertEmailWarning: boolean;
  alertEmailDigest: boolean;
  alertClassNewInquiry: OwnerAlertClass;
  alertClassLiveChat: OwnerAlertClass;
  alertClassRiskDownload: OwnerAlertClass;
  alertClassUnusualTraffic: OwnerAlertClass;
  alertClassChatLimit: OwnerAlertClass;
  alertClassOverdueCrm: OwnerAlertClass;
}

export interface DigestAlertItem {
  id: string;
  eventType: OwnerAlertEventType;
  alertClass: OwnerAlertClass;
  title: string;
  detail: string;
  createdAtMs: number;
}

interface DigestCacheFile {
  items: DigestAlertItem[];
  recentKeys: Record<string, number>;
}

let digestItems: DigestAlertItem[] = [];
const recentKeys = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function loadCache(): void {
  try {
    if (!fs.existsSync(CACHE_PATH)) return;
    const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Partial<DigestCacheFile>;
    if (Array.isArray(parsed.items)) {
      digestItems = parsed.items.slice(-MAX_DIGEST);
    }
    if (parsed.recentKeys && typeof parsed.recentKeys === 'object') {
      const now = Date.now();
      for (const [k, v] of Object.entries(parsed.recentKeys)) {
        if (typeof v === 'number' && now - v < DEDUPE_MS * 4) recentKeys.set(k, v);
      }
    }
  } catch {
    /* ignore */
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      const payload: DigestCacheFile = {
        items: digestItems.slice(-MAX_DIGEST),
        recentKeys: Object.fromEntries(recentKeys.entries()),
      };
      fs.writeFileSync(CACHE_PATH, JSON.stringify(payload), 'utf8');
    } catch {
      /* non-fatal */
    }
  }, 1200);
}

loadCache();

export function prefsFromPortfolioSettings(settings: Pick<
  PortfolioSettings,
  | 'alertEmailEnabled'
  | 'alertEmailUrgent'
  | 'alertEmailWarning'
  | 'alertEmailDigest'
  | 'alertClassNewInquiry'
  | 'alertClassLiveChat'
  | 'alertClassRiskDownload'
  | 'alertClassUnusualTraffic'
  | 'alertClassChatLimit'
  | 'alertClassOverdueCrm'
>): OwnerNotifyPrefs {
  return {
    alertEmailEnabled: settings.alertEmailEnabled,
    alertEmailUrgent: settings.alertEmailUrgent,
    alertEmailWarning: settings.alertEmailWarning,
    alertEmailDigest: settings.alertEmailDigest,
    alertClassNewInquiry: settings.alertClassNewInquiry,
    alertClassLiveChat: settings.alertClassLiveChat,
    alertClassRiskDownload: settings.alertClassRiskDownload,
    alertClassUnusualTraffic: settings.alertClassUnusualTraffic,
    alertClassChatLimit: settings.alertClassChatLimit,
    alertClassOverdueCrm: settings.alertClassOverdueCrm,
  };
}

export function classForEvent(prefs: OwnerNotifyPrefs, eventType: OwnerAlertEventType): OwnerAlertClass {
  switch (eventType) {
    case 'new_inquiry':
      return prefs.alertClassNewInquiry;
    case 'live_chat':
      return prefs.alertClassLiveChat;
    case 'risk_download':
      return prefs.alertClassRiskDownload;
    case 'unusual_traffic':
      return prefs.alertClassUnusualTraffic;
    case 'chat_limit':
      return prefs.alertClassChatLimit;
    case 'overdue_crm':
      return prefs.alertClassOverdueCrm;
    default:
      return 'off';
  }
}

export function shouldSendImmediate(prefs: OwnerNotifyPrefs, alertClass: OwnerAlertClass): boolean {
  if (!prefs.alertEmailEnabled || alertClass === 'off' || alertClass === 'digest') return false;
  if (alertClass === 'urgent') return prefs.alertEmailUrgent;
  if (alertClass === 'warning') return prefs.alertEmailWarning;
  return false;
}

export function shouldQueueDigest(prefs: OwnerNotifyPrefs, alertClass: OwnerAlertClass): boolean {
  if (!prefs.alertEmailEnabled || !prefs.alertEmailDigest) return false;
  return alertClass === 'digest' || alertClass === 'warning' || alertClass === 'urgent';
}

function isDuplicate(dedupeKey: string, now: number): boolean {
  const prev = recentKeys.get(dedupeKey);
  if (prev && now - prev < DEDUPE_MS) return true;
  recentKeys.set(dedupeKey, now);
  if (recentKeys.size > 500) {
    const cutoff = now - DEDUPE_MS * 4;
    for (const [k, v] of recentKeys) {
      if (v < cutoff) recentKeys.delete(k);
    }
  }
  scheduleFlush();
  return false;
}

export function queueDigestItem(item: Omit<DigestAlertItem, 'id' | 'createdAtMs'> & { createdAtMs?: number }): void {
  const createdAtMs = item.createdAtMs || Date.now();
  digestItems.push({
    id: `al-${crypto.randomBytes(4).toString('hex')}`,
    eventType: item.eventType,
    alertClass: item.alertClass,
    title: item.title.slice(0, 160),
    detail: item.detail.slice(0, 500),
    createdAtMs,
  });
  if (digestItems.length > MAX_DIGEST) digestItems = digestItems.slice(-MAX_DIGEST);
  scheduleFlush();
}

export function peekDigestItems(): DigestAlertItem[] {
  return [...digestItems];
}

export function drainDigestItems(): DigestAlertItem[] {
  const items = [...digestItems];
  digestItems = [];
  scheduleFlush();
  return items;
}

export function formatDigestQueueText(items: DigestAlertItem[]): string {
  if (items.length === 0) return '';
  const lines = ['Queued owner alerts', '────────────────────'];
  for (const item of items) {
    lines.push(
      `[${item.alertClass.toUpperCase()}] ${item.title}`,
      `  ${item.detail}`,
      `  ${new Date(item.createdAtMs).toISOString()} · ${item.eventType}`,
      ''
    );
  }
  return lines.join('\n');
}

export type NotifyOutcome = 'sent' | 'queued' | 'skipped' | 'duplicate';

export async function routeOwnerNotification(input: {
  prefs: OwnerNotifyPrefs;
  eventType: OwnerAlertEventType;
  title: string;
  detail: string;
  dedupeKey: string;
  sendImmediate: (payload: {
    alertClass: 'urgent' | 'warning';
    subject: string;
    title: string;
    detail: string;
  }) => Promise<void>;
}): Promise<NotifyOutcome> {
  const now = Date.now();
  const alertClass = classForEvent(input.prefs, input.eventType);
  if (alertClass === 'off' || !input.prefs.alertEmailEnabled) return 'skipped';
  if (isDuplicate(input.dedupeKey, now)) return 'duplicate';

  let outcome: NotifyOutcome = 'skipped';

  if (shouldSendImmediate(input.prefs, alertClass) && (alertClass === 'urgent' || alertClass === 'warning')) {
    const tag = alertClass === 'urgent' ? '[URGENT]' : '[WARNING]';
    await input.sendImmediate({
      alertClass,
      subject: `${tag} ${input.title}`.slice(0, 200),
      title: input.title,
      detail: input.detail,
    });
    outcome = 'sent';
  }

  if (shouldQueueDigest(input.prefs, alertClass)) {
    queueDigestItem({
      eventType: input.eventType,
      alertClass,
      title: input.title,
      detail: input.detail,
      createdAtMs: now,
    });
    if (outcome === 'skipped') outcome = 'queued';
  }

  return outcome;
}

export function resetOwnerNotifyForTests(): void {
  digestItems = [];
  recentKeys.clear();
}
