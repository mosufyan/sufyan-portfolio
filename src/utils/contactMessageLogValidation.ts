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

export const LEAD_SOURCES = ['', 'linkedin', 'referral', 'organic', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_PRIORITIES = ['', 'hot', 'warm', 'cold'] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const LEAD_OUTCOMES = ['', 'open', 'interview', 'offer', 'closed_won', 'closed_lost'] as const;
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number];

export interface LeadCrmFields {
  leadCompany: string;
  leadRole: string;
  leadSource: LeadSource;
  leadPriority: LeadPriority;
  leadNextAction: string;
  leadNextActionDueAtMs: number | null;
  leadOutcome: LeadOutcome;
}

export const DEFAULT_LEAD_CRM: LeadCrmFields = {
  leadCompany: '',
  leadRole: '',
  leadSource: '',
  leadPriority: '',
  leadNextAction: '',
  leadNextActionDueAtMs: null,
  leadOutcome: '',
};

export const LEAD_CRM_CONSTRAINTS = {
  companyMax: 120,
  roleMax: 120,
  nextActionMax: 200,
} as const;

export interface ContactMessageLogRecord extends ContactMessageSummary, LeadCrmFields {
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

export function sanitizeLeadCrmFields(input: Partial<LeadCrmFields> | null | undefined): LeadCrmFields {
  if (!input || typeof input !== 'object') return { ...DEFAULT_LEAD_CRM };

  const leadSource = (LEAD_SOURCES as readonly string[]).includes(input.leadSource || '')
    ? (input.leadSource as LeadSource)
    : '';
  const leadPriority = (LEAD_PRIORITIES as readonly string[]).includes(input.leadPriority || '')
    ? (input.leadPriority as LeadPriority)
    : '';
  const leadOutcome = (LEAD_OUTCOMES as readonly string[]).includes(input.leadOutcome || '')
    ? (input.leadOutcome as LeadOutcome)
    : '';
  const due =
    typeof input.leadNextActionDueAtMs === 'number' &&
    Number.isFinite(input.leadNextActionDueAtMs) &&
    input.leadNextActionDueAtMs > 0
      ? Math.floor(input.leadNextActionDueAtMs)
      : null;

  return {
    leadCompany: clampString(input.leadCompany, LEAD_CRM_CONSTRAINTS.companyMax),
    leadRole: clampString(input.leadRole, LEAD_CRM_CONSTRAINTS.roleMax),
    leadSource,
    leadPriority,
    leadNextAction: clampString(input.leadNextAction, LEAD_CRM_CONSTRAINTS.nextActionMax),
    leadNextActionDueAtMs: due,
    leadOutcome,
  };
}

export function sanitizeContactTriageUpdate(input: {
  triageStatus: unknown;
  ownerNote: unknown;
  leadCompany?: unknown;
  leadRole?: unknown;
  leadSource?: unknown;
  leadPriority?: unknown;
  leadNextAction?: unknown;
  leadNextActionDueAtMs?: unknown;
  leadOutcome?: unknown;
}): { triageStatus: ContactTriageStatus; ownerNote: string } & LeadCrmFields {
  const lead = sanitizeLeadCrmFields({
    leadCompany: typeof input.leadCompany === 'string' ? input.leadCompany : '',
    leadRole: typeof input.leadRole === 'string' ? input.leadRole : '',
    leadSource: input.leadSource as LeadCrmFields['leadSource'],
    leadPriority: input.leadPriority as LeadCrmFields['leadPriority'],
    leadNextAction: typeof input.leadNextAction === 'string' ? input.leadNextAction : '',
    leadNextActionDueAtMs:
      typeof input.leadNextActionDueAtMs === 'number' ? input.leadNextActionDueAtMs : null,
    leadOutcome: input.leadOutcome as LeadCrmFields['leadOutcome'],
  });

  return {
    triageStatus: normalizeContactTriageStatus(input.triageStatus),
    ownerNote:
      typeof input.ownerNote === 'string'
        ? input.ownerNote.trim().slice(0, CONTACT_MESSAGE_LOG_CONSTRAINTS.ownerNoteMaxLength)
        : '',
    ...lead,
  };
}

export function emptyLeadCrm(): LeadCrmFields {
  return { ...DEFAULT_LEAD_CRM };
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
