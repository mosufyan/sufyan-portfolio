import type { AdminAuditLogRecord } from './ownerGovernance';
import type { ContactMessageLogRecord } from './contactMessageLogValidation';
import type { CvDownloadLogRecord } from './cvDownloadLogValidation';

export interface FunnelSnapshot {
  windowDays: number;
  contactMessages: number;
  contactReplied: number;
  contactShortlisted: number;
  cvExports: number;
  cvOtpVerified: number;
  cvHighRisk: number;
  uniqueVisitorEmails: number;
  replyRate: number;
  otpShareOfExports: number;
}

export function computeFunnelSnapshot(
  messages: ContactMessageLogRecord[],
  downloads: CvDownloadLogRecord[],
  windowDays = 30,
  nowMs = Date.now()
): FunnelSnapshot {
  const cutoff = nowMs - windowDays * 24 * 60 * 60 * 1000;
  const msgs = messages.filter((m) => m.createdAtMs >= cutoff);
  const cvs = downloads.filter((d) => d.createdAtMs >= cutoff);
  const emails = new Set<string>();
  for (const m of msgs) {
    if (m.senderEmail) emails.add(m.senderEmail.toLowerCase());
  }
  for (const d of cvs) {
    if (d.visitorEmail) emails.add(d.visitorEmail.toLowerCase());
  }
  const contactReplied = msgs.filter((m) => m.triageStatus === 'replied').length;
  const contactShortlisted = msgs.filter((m) => m.triageStatus === 'shortlisted').length;
  const cvOtpVerified = cvs.filter((d) => d.verificationStatus === 'otp_verified').length;
  const cvHighRisk = cvs.filter((d) => d.riskLevel !== 'low' || d.isVpnSuspected).length;

  return {
    windowDays,
    contactMessages: msgs.length,
    contactReplied,
    contactShortlisted,
    cvExports: cvs.length,
    cvOtpVerified,
    cvHighRisk,
    uniqueVisitorEmails: emails.size,
    replyRate: msgs.length ? contactReplied / msgs.length : 0,
    otpShareOfExports: cvs.length ? cvOtpVerified / cvs.length : 0,
  };
}

export type OwnerAlertSeverity = 'info' | 'warning' | 'critical';

export interface OwnerAlertItem {
  id: string;
  severity: OwnerAlertSeverity;
  title: string;
  detail: string;
  createdAtMs: number;
  hrefSection?: 'messages' | 'downloads' | 'audit' | 'settings';
}

export function buildOwnerAlerts(input: {
  messages: ContactMessageLogRecord[];
  downloads: CvDownloadLogRecord[];
  nowMs?: number;
}): OwnerAlertItem[] {
  const nowMs = input.nowMs ?? Date.now();
  const dayAgo = nowMs - 24 * 60 * 60 * 1000;
  const alerts: OwnerAlertItem[] = [];

  const newMsgs = input.messages.filter((m) => m.triageStatus === 'new' && m.createdAtMs >= dayAgo);
  if (newMsgs.length > 0) {
    alerts.push({
      id: `new-inq-${newMsgs.length}`,
      severity: 'info',
      title: `${newMsgs.length} new inquir${newMsgs.length === 1 ? 'y' : 'ies'} (24h)`,
      detail: 'OTP-verified contact submissions awaiting triage.',
      createdAtMs: Math.max(...newMsgs.map((m) => m.createdAtMs)),
      hrefSection: 'messages',
    });
  }

  const overdue = input.messages.filter(
    (m) =>
      m.leadNextActionDueAtMs != null &&
      m.leadNextActionDueAtMs > 0 &&
      m.leadNextActionDueAtMs < nowMs &&
      m.triageStatus !== 'archived'
  );
  if (overdue.length > 0) {
    alerts.push({
      id: `overdue-${overdue.length}`,
      severity: 'warning',
      title: `${overdue.length} overdue follow-up${overdue.length === 1 ? '' : 's'}`,
      detail: 'Lead next-action due dates have passed.',
      createdAtMs: nowMs,
      hrefSection: 'messages',
    });
  }

  const riskyCv = input.downloads.filter(
    (d) => d.createdAtMs >= dayAgo && (d.isVpnSuspected || d.riskLevel === 'high')
  );
  const riskyMsg = input.messages.filter(
    (m) => m.createdAtMs >= dayAgo && (m.isVpnSuspected || m.riskLevel === 'high')
  );
  const riskyCount = riskyCv.length + riskyMsg.length;
  if (riskyCount >= 3) {
    alerts.push({
      id: `risk-spike-${riskyCount}`,
      severity: 'critical',
      title: `High-risk / VPN spike (${riskyCount} in 24h)`,
      detail: 'Consider reviewing access rules or enabling incident mode.',
      createdAtMs: nowMs,
      hrefSection: 'downloads',
    });
  }

  const unansweredHot = input.messages.filter(
    (m) => m.leadPriority === 'hot' && m.triageStatus === 'new'
  );
  if (unansweredHot.length > 0) {
    alerts.push({
      id: `hot-${unansweredHot.length}`,
      severity: 'critical',
      title: `${unansweredHot.length} hot lead${unansweredHot.length === 1 ? '' : 's'} still New`,
      detail: 'Prioritize reply or shortlist these inquiries.',
      createdAtMs: nowMs,
      hrefSection: 'messages',
    });
  }

  return alerts.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export interface SavedOwnerView {
  id: string;
  name: string;
  section: 'messages' | 'downloads';
  triageStatus?: string;
  priority?: string;
  search?: string;
  createdAtMs: number;
}

const SAVED_VIEWS_KEY = 'owner-console-saved-views-v1';

export function loadSavedOwnerViews(): SavedOwnerView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedOwnerView[];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function saveSavedOwnerViews(views: SavedOwnerView[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views.slice(0, 20)));
  } catch {
    /* ignore quota */
  }
}

export function filterActivityTimeline(
  logs: AdminAuditLogRecord[],
  filter: 'all' | 'auth' | 'ops' | 'outreach' = 'all'
): AdminAuditLogRecord[] {
  return logs.filter((entry) => {
    if (filter === 'all') return true;
    if (filter === 'auth') {
      return entry.eventType === 'owner_login' || entry.eventType === 'owner_logout';
    }
    if (filter === 'ops') {
      return (
        entry.eventType === 'settings_updated' ||
        entry.eventType === 'rule_created' ||
        entry.eventType === 'rule_deleted' ||
        entry.eventType === 'incident_mode_toggled' ||
        entry.eventType === 'delegate_added' ||
        entry.eventType === 'delegate_removed'
      );
    }
    return (
      entry.eventType === 'triage_updated' ||
      entry.eventType === 'owner_reply_sent' ||
      entry.eventType === 'announcement_mutated'
    );
  });
}

export interface SiteTelemetrySnapshot {
  pageviews: number;
  ogShares: number;
  ogByTrack: Record<string, number>;
  updatedAtIso: string;
}

export const EMPTY_SITE_TELEMETRY: SiteTelemetrySnapshot = {
  pageviews: 0,
  ogShares: 0,
  ogByTrack: {},
  updatedAtIso: '',
};

export function buildDigestText(input: {
  funnel: FunnelSnapshot;
  alerts: OwnerAlertItem[];
  telemetry: SiteTelemetrySnapshot;
}): string {
  const lines = [
    `Owner digest — last ${input.funnel.windowDays} days`,
    '',
    `Inquiries: ${input.funnel.contactMessages} (replied ${input.funnel.contactReplied}, shortlisted ${input.funnel.contactShortlisted})`,
    `Reply rate: ${(input.funnel.replyRate * 100).toFixed(0)}%`,
    `CV exports: ${input.funnel.cvExports} (OTP ${(input.funnel.otpShareOfExports * 100).toFixed(0)}%, high-risk ${input.funnel.cvHighRisk})`,
    `Unique visitor emails: ${input.funnel.uniqueVisitorEmails}`,
    `Pageviews: ${input.telemetry.pageviews} · OG shares: ${input.telemetry.ogShares}`,
    '',
    `Open alerts: ${input.alerts.length}`,
    ...input.alerts.slice(0, 8).map((a) => `- [${a.severity}] ${a.title}`),
  ];
  return lines.join('\n');
}
