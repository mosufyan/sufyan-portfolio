export type CvDownloadAction = 'pdf' | 'print' | 'ats' | 'install';
export type CvVerificationStatus = 'otp_verified' | 'mx_verified' | 'phone_only' | 'repeat_session';
export type CvRiskLevel = 'low' | 'medium' | 'high';

export const CV_DOWNLOAD_CONSTRAINTS = {
  idPattern: /^[a-zA-Z0-9_-]+$/,
  idMinLength: 4,
  idMaxLength: 64,
  visitorNameMaxLength: 120,
  visitorEmailMaxLength: 254,
  visitorPhoneMaxLength: 40,
  reasonMinLength: 3,
  reasonMaxLength: 500,
  formatLabelMinLength: 2,
  formatLabelMaxLength: 80,
  ipMaxLength: 64,
  geoMaxLength: 80,
  ispMaxLength: 120,
  asnMaxLength: 64,
  timezoneMaxLength: 64,
  riskReasonsMaxLength: 240,
  referrerMaxLength: 200,
  userAgentMaxLength: 220,
} as const;

export interface CvTrackingSummary {
  downloadId: string;
  sessionId: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  reason: string;
  action: CvDownloadAction;
  formatLabel: string;
  theme: 'dark' | 'light';
  verificationStatus: CvVerificationStatus;
  ipAddress: string;
  country: string;
  region: string;
  city: string;
  isp: string;
  asn: string;
  timezone: string;
  clientTimezone: string;
  isVpnSuspected: boolean;
  isProxy: boolean;
  isHosting: boolean;
  timezoneMismatch: boolean;
  riskLevel: CvRiskLevel;
  riskReasons: string;
  referrer: string;
  userAgent: string;
  isSubsequent: boolean;
}

export interface CvDownloadLogRecord extends CvTrackingSummary {
  createdAtMs: number;
  createdAtIso: string;
}

function cleanId(raw: string, prefix: string, maxLen: number): string {
  const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen);
  if (sanitized.length >= CV_DOWNLOAD_CONSTRAINTS.idMinLength && CV_DOWNLOAD_CONSTRAINTS.idPattern.test(sanitized)) {
    return sanitized;
  }
  const fallback = `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  return fallback.slice(0, maxLen);
}

function clampString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function sanitizeCvDownloadLogPayload(input: Partial<CvTrackingSummary>): CvTrackingSummary | null {
  const downloadId = cleanId(typeof input.downloadId === 'string' ? input.downloadId : '', 'CV', CV_DOWNLOAD_CONSTRAINTS.idMaxLength);
  const sessionId = cleanId(typeof input.sessionId === 'string' ? input.sessionId : '', 'SES', CV_DOWNLOAD_CONSTRAINTS.idMaxLength);

  const visitorName = clampString(input.visitorName, CV_DOWNLOAD_CONSTRAINTS.visitorNameMaxLength);
  const visitorEmail = clampString(input.visitorEmail, CV_DOWNLOAD_CONSTRAINTS.visitorEmailMaxLength);
  const visitorPhone = clampString(input.visitorPhone, CV_DOWNLOAD_CONSTRAINTS.visitorPhoneMaxLength);

  if (!visitorEmail && !visitorPhone) {
    return null;
  }

  let reason = clampString(input.reason, CV_DOWNLOAD_CONSTRAINTS.reasonMaxLength);
  if (reason.length < CV_DOWNLOAD_CONSTRAINTS.reasonMinLength) {
    reason = 'Portfolio CV export';
  }

  const action: CvDownloadAction =
    input.action === 'print' || input.action === 'ats' || input.action === 'install'
      ? input.action
      : 'pdf';

  let formatLabel = clampString(input.formatLabel, CV_DOWNLOAD_CONSTRAINTS.formatLabelMaxLength);
  if (formatLabel.length < CV_DOWNLOAD_CONSTRAINTS.formatLabelMinLength) {
    formatLabel = action === 'install' ? 'Portfolio PWA' : 'Executive Summary';
  }

  const theme: 'dark' | 'light' = input.theme === 'light' ? 'light' : 'dark';

  const verificationStatus: CvVerificationStatus =
    input.verificationStatus === 'otp_verified' ||
    input.verificationStatus === 'mx_verified' ||
    input.verificationStatus === 'phone_only' ||
    input.verificationStatus === 'repeat_session'
      ? input.verificationStatus
      : 'mx_verified';

  const riskLevel: CvRiskLevel =
    input.riskLevel === 'high' || input.riskLevel === 'medium' ? input.riskLevel : 'low';

  return {
    downloadId,
    sessionId,
    visitorName,
    visitorEmail,
    visitorPhone,
    reason,
    action,
    formatLabel,
    theme,
    verificationStatus,
    ipAddress: clampString(input.ipAddress, CV_DOWNLOAD_CONSTRAINTS.ipMaxLength),
    country: clampString(input.country, CV_DOWNLOAD_CONSTRAINTS.geoMaxLength) || 'Unknown',
    region: clampString(input.region, CV_DOWNLOAD_CONSTRAINTS.geoMaxLength),
    city: clampString(input.city, CV_DOWNLOAD_CONSTRAINTS.geoMaxLength),
    isp: clampString(input.isp, CV_DOWNLOAD_CONSTRAINTS.ispMaxLength),
    asn: clampString(input.asn, CV_DOWNLOAD_CONSTRAINTS.asnMaxLength),
    timezone: clampString(input.timezone, CV_DOWNLOAD_CONSTRAINTS.timezoneMaxLength),
    clientTimezone: clampString(input.clientTimezone, CV_DOWNLOAD_CONSTRAINTS.timezoneMaxLength),
    isVpnSuspected: Boolean(input.isVpnSuspected),
    isProxy: Boolean(input.isProxy),
    isHosting: Boolean(input.isHosting),
    timezoneMismatch: Boolean(input.timezoneMismatch),
    riskLevel,
    riskReasons: clampString(input.riskReasons, CV_DOWNLOAD_CONSTRAINTS.riskReasonsMaxLength),
    referrer: clampString(input.referrer, CV_DOWNLOAD_CONSTRAINTS.referrerMaxLength),
    userAgent: clampString(input.userAgent, CV_DOWNLOAD_CONSTRAINTS.userAgentMaxLength),
    isSubsequent: Boolean(input.isSubsequent),
  };
}

export function collectClientTelemetryContext(): {
  clientTimezone: string;
  clientLanguage: string;
  clientScreen: string;
  referrer: string;
} {
  if (typeof window === 'undefined') {
    return {
      clientTimezone: '',
      clientLanguage: '',
      clientScreen: '',
      referrer: '',
    };
  }

  let clientTimezone = '';
  try {
    clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    clientTimezone = '';
  }

  let referrer = '';
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get('utm_source') || params.get('cv') || params.get('track') || '';
    const ref = document.referrer ? new URL(document.referrer).hostname : '';
    referrer = [ref, utm ? `tag:${utm}` : ''].filter(Boolean).join(' · ').slice(0, 200);
  } catch {
    referrer = document.referrer.slice(0, 200);
  }

  return {
    clientTimezone: clientTimezone.slice(0, 64),
    clientLanguage: (navigator.language || '').slice(0, 32),
    clientScreen: `${window.screen?.width || 0}x${window.screen?.height || 0}`.slice(0, 32),
    referrer: referrer || 'Direct',
  };
}

function csvSafeCell(value: unknown): string {
  const raw = String(value ?? '').replace(/\r?\n/g, ' ');
  const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function buildCsvFromDownloadLogs(logs: CvDownloadLogRecord[]): string {
  const headers = [
    'Timestamp',
    'Download ID',
    'Session ID',
    'Action',
    'Format',
    'Theme',
    'Verification',
    'Visitor Name',
    'Email',
    'Phone',
    'Reason',
    'IP Address',
    'City',
    'Region',
    'Country',
    'ISP',
    'ASN',
    'VPN Suspected',
    'Risk Level',
    'Risk Signals',
    'IP Timezone',
    'Browser Timezone',
    'Referrer',
    'Subsequent Export',
  ];

  const rows = logs.map((log) =>
    [
      log.createdAtIso,
      log.downloadId,
      log.sessionId,
      log.action,
      log.formatLabel,
      log.theme,
      log.verificationStatus,
      log.visitorName,
      log.visitorEmail,
      log.visitorPhone,
      log.reason,
      log.ipAddress,
      log.city,
      log.region,
      log.country,
      log.isp,
      log.asn,
      log.isVpnSuspected ? 'YES' : 'NO',
      log.riskLevel,
      log.riskReasons,
      log.timezone,
      log.clientTimezone,
      log.referrer,
      log.isSubsequent ? 'YES' : 'NO',
    ]
      .map(csvSafeCell)
      .join(',')
  );

  return [headers.map(csvSafeCell).join(','), ...rows].join('\n');
}
