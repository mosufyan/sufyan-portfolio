export const CONTACT_MESSAGE_LOG_CONSTRAINTS = {
  idMinLength: 4,
  idMaxLength: 64,
  idPattern: /^[a-zA-Z0-9_-]+$/,
  nameMinLength: 1,
  nameMaxLength: 120,
  emailMinLength: 3,
  emailMaxLength: 254,
  phoneMaxLength: 40,
  subjectMaxLength: 200,
  messageMinLength: 1,
  messageMaxLength: 5000,
  ipMaxLength: 64,
  geoMaxLength: 80,
  ispMaxLength: 120,
  asnMaxLength: 64,
  tzMaxLength: 64,
  riskReasonsMaxLength: 240,
  referrerMaxLength: 200,
  userAgentMaxLength: 220,
  ownerNoteMaxLength: 1000,
} as const;

export const CONTACT_TRIAGE_STATUSES = ['new', 'replied', 'shortlisted', 'archived'] as const;
export type ContactTriageStatus = (typeof CONTACT_TRIAGE_STATUSES)[number];

export interface ContactMessageSummary {
  messageId: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  subject: string;
  message: string;
  theme: 'dark' | 'light';
  ipAddress: string;
  country: string;
  region: string;
  city: string;
  isp: string;
  asn: string;
  timezone: string;
  clientTimezone: string;
  isVpnSuspected: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  riskReasons: string;
  referrer: string;
  userAgent: string;
}

export interface ContactMessageLogRecord extends ContactMessageSummary {
  triageStatus: ContactTriageStatus;
  ownerNote: string;
  triagedAtMs: number | null;
  createdAtMs: number;
  createdAtIso: string;
}

export function normalizeContactTriageStatus(raw: unknown): ContactTriageStatus {
  if (
    raw === 'new' ||
    raw === 'replied' ||
    raw === 'shortlisted' ||
    raw === 'archived'
  ) {
    return raw;
  }
  return 'new';
}

export function sanitizeContactTriageUpdate(input: {
  triageStatus: unknown;
  ownerNote: unknown;
}): { triageStatus: ContactTriageStatus; ownerNote: string } {
  return {
    triageStatus: normalizeContactTriageStatus(input.triageStatus),
    ownerNote:
      typeof input.ownerNote === 'string'
        ? input.ownerNote.trim().slice(0, CONTACT_MESSAGE_LOG_CONSTRAINTS.ownerNoteMaxLength)
        : '',
  };
}

function clampString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

export function sanitizeContactMessageLogPayload(
  input: Partial<ContactMessageSummary> | null | undefined
): ContactMessageSummary | null {
  if (!input || typeof input !== 'object') return null;

  const messageId = clampString(input.messageId, CONTACT_MESSAGE_LOG_CONSTRAINTS.idMaxLength);
  if (
    messageId.length < CONTACT_MESSAGE_LOG_CONSTRAINTS.idMinLength ||
    !CONTACT_MESSAGE_LOG_CONSTRAINTS.idPattern.test(messageId)
  ) {
    return null;
  }

  const senderName = clampString(input.senderName, CONTACT_MESSAGE_LOG_CONSTRAINTS.nameMaxLength);
  const senderEmail = clampString(input.senderEmail, CONTACT_MESSAGE_LOG_CONSTRAINTS.emailMaxLength);
  const senderPhone = clampString(input.senderPhone, CONTACT_MESSAGE_LOG_CONSTRAINTS.phoneMaxLength);
  const message = clampString(input.message, CONTACT_MESSAGE_LOG_CONSTRAINTS.messageMaxLength);

  if (
    senderName.length < CONTACT_MESSAGE_LOG_CONSTRAINTS.nameMinLength ||
    senderEmail.length < CONTACT_MESSAGE_LOG_CONSTRAINTS.emailMinLength ||
    message.length < CONTACT_MESSAGE_LOG_CONSTRAINTS.messageMinLength
  ) {
    return null;
  }

  const theme: ContactMessageSummary['theme'] = input.theme === 'light' ? 'light' : 'dark';
  const riskLevel: ContactMessageSummary['riskLevel'] =
    input.riskLevel === 'high' || input.riskLevel === 'medium' ? input.riskLevel : 'low';

  return {
    messageId,
    senderName,
    senderEmail,
    senderPhone,
    subject: clampString(input.subject, CONTACT_MESSAGE_LOG_CONSTRAINTS.subjectMaxLength),
    message,
    theme,
    ipAddress: clampString(input.ipAddress, CONTACT_MESSAGE_LOG_CONSTRAINTS.ipMaxLength),
    country: clampString(input.country, CONTACT_MESSAGE_LOG_CONSTRAINTS.geoMaxLength) || 'Unknown',
    region: clampString(input.region, CONTACT_MESSAGE_LOG_CONSTRAINTS.geoMaxLength),
    city: clampString(input.city, CONTACT_MESSAGE_LOG_CONSTRAINTS.geoMaxLength),
    isp: clampString(input.isp, CONTACT_MESSAGE_LOG_CONSTRAINTS.ispMaxLength),
    asn: clampString(input.asn, CONTACT_MESSAGE_LOG_CONSTRAINTS.asnMaxLength),
    timezone: clampString(input.timezone, CONTACT_MESSAGE_LOG_CONSTRAINTS.tzMaxLength),
    clientTimezone: clampString(input.clientTimezone, CONTACT_MESSAGE_LOG_CONSTRAINTS.tzMaxLength),
    isVpnSuspected: Boolean(input.isVpnSuspected),
    riskLevel,
    riskReasons: clampString(input.riskReasons, CONTACT_MESSAGE_LOG_CONSTRAINTS.riskReasonsMaxLength),
    referrer: clampString(input.referrer, CONTACT_MESSAGE_LOG_CONSTRAINTS.referrerMaxLength),
    userAgent: clampString(input.userAgent, CONTACT_MESSAGE_LOG_CONSTRAINTS.userAgentMaxLength),
  };
}

function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${formulaSafe.replace(/"/g, '""')}"`;
}

export function buildCsvFromContactLogs(logs: ContactMessageLogRecord[]): string {
  const headers = [
    'Timestamp',
    'Message ID',
    'Sender Name',
    'Email',
    'Phone',
    'Subject',
    'Message',
    'IP Address',
    'Country',
    'Region',
    'City',
    'ISP',
    'ASN',
    'IP Timezone',
    'Browser Timezone',
    'VPN Suspected',
    'Risk Level',
    'Risk Signals',
    'Referrer',
    'Triage Status',
    'Owner Note',
  ];

  const rows = logs.map((log) =>
    [
      log.createdAtIso,
      log.messageId,
      log.senderName,
      log.senderEmail,
      log.senderPhone,
      log.subject,
      log.message,
      log.ipAddress,
      log.country,
      log.region,
      log.city,
      log.isp,
      log.asn,
      log.timezone,
      log.clientTimezone,
      log.isVpnSuspected ? 'YES' : 'NO',
      log.riskLevel,
      log.riskReasons,
      log.referrer,
      log.triageStatus || 'new',
      log.ownerNote || '',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}
