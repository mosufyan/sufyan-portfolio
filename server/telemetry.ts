import crypto from 'crypto';
import dns from 'dns/promises';
import type { Request } from 'express';
import { sanitizeHeaderValue } from './security.ts';
import { validateAndNormalizePhone, type PhoneValidationResult } from '../src/utils/phoneValidation.ts';

export type RiskLevel = 'low' | 'medium' | 'high';
export type VerificationStatus = 'otp_verified' | 'mx_verified' | 'phone_only' | 'repeat_session';

export interface IpIntelligence {
  ipAddress: string;
  isPrivate: boolean;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isp: string;
  asn: string;
  org: string;
  timezone: string;
  isProxy: boolean;
  isHosting: boolean;
  isMobile: boolean;
  lookupProvider: 'ip-api' | 'ipwho.is' | 'local' | 'unavailable';
}

export interface RiskAssessment {
  riskScore: number;
  riskLevel: RiskLevel;
  isVpnSuspected: boolean;
  timezoneMismatch: boolean;
  asnVpnMatch: boolean;
  riskReasons: string[];
}

export interface VisitorTelemetryReport {
  downloadId: string;
  sessionId: string;
  ip: IpIntelligence;
  risk: RiskAssessment;
  clientTimezone: string;
  clientLanguage: string;
  clientScreen: string;
  referrer: string;
  userAgent: string;
  verificationStatus: VerificationStatus;
}

const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  'anonymbox.com',
  'burner.kiwi',
  'burnermail.io',
  'discard.email',
  'dispostable.com',
  'dropmail.me',
  'emailondeck.com',
  'example.com',
  'example.net',
  'example.org',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.net',
  'guerrillamail.org',
  'harakirimail.com',
  'inboxkitten.com',
  'invalid',
  'jetable.org',
  'localhost',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailinator.net',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'mytemp.email',
  'nada.email',
  'sharklasers.com',
  'spam4.me',
  'spamgourmet.com',
  'temp-mail.io',
  'temp-mail.org',
  'tempail.com',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'tempr.email',
  'test.com',
  'throwawaymail.com',
  'tmpmail.net',
  'tmpmail.org',
  'trashmail.com',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
]);

const HOSTING_OR_VPN_KEYWORDS = [
  'amazon',
  'aws',
  'google cloud',
  'digitalocean',
  'linode',
  'akamai connected cloud',
  'vultr',
  'hetzner',
  'ovh',
  'm247',
  'nordvpn',
  'expressvpn',
  'protonvpn',
  'proton ag',
  'mullvad',
  'surfshark',
  'private internet access',
  'cyberghost',
  'windscribe',
  'tor exit',
  'cloudflare warp',
  'datacamp',
  'packethub',
  'choopa',
  'leaseweb',
  'oracle cloud',
  'contabo',
  'scaleway',
  'upcloud',
  'tzulo',
];

export function normalizeIpString(raw: string | undefined): string {
  if (!raw) return '';
  let ip = raw.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  // Strip IPv4 port suffix like 203.0.113.5:41234
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.split(':')[0];
  }
  // Strip bracketed IPv6 [::1]:1234
  if (ip.startsWith('[')) {
    const closeIdx = ip.indexOf(']');
    if (closeIdx > 1) {
      ip = ip.slice(1, closeIdx);
    }
  }
  return ip.slice(0, 64);
}

export function extractClientIp(
  req: Pick<Request, 'headers' | 'ip'> & { socket?: { remoteAddress?: string } }
): string {
  const candidates = [
    typeof req.headers['cf-connecting-ip'] === 'string' ? req.headers['cf-connecting-ip'] : '',
    typeof req.headers['true-client-ip'] === 'string' ? req.headers['true-client-ip'] : '',
    typeof req.headers['fastly-client-ip'] === 'string' ? req.headers['fastly-client-ip'] : '',
    typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'] : '',
    typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'] : '',
    typeof req.ip === 'string' ? req.ip : '',
    typeof req.socket?.remoteAddress === 'string' ? req.socket.remoteAddress : '',
  ];

  for (const raw of candidates) {
    const normalized = normalizeIpString(raw);
    if (normalized) return normalized;
  }
  return 'unknown';
}

export function isPrivateOrLoopbackIp(ip: string): boolean {
  if (!ip || ip === 'unknown') return true;
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === 'localhost' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
    return true;
  }
  if (lower.startsWith('127.') || lower.startsWith('10.') || lower.startsWith('192.168.') || lower.startsWith('169.254.')) {
    return true;
  }
  const match172 = /^172\.(\d{1,3})\./.exec(lower);
  if (match172) {
    const second = Number(match172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function isDisposableEmailDomain(email: string): boolean {
  const atIdx = email.lastIndexOf('@');
  if (atIdx < 1) return false;
  const domain = email.slice(atIdx + 1).trim().toLowerCase();
  if (!domain) return true;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  for (const bad of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith(`.${bad}`)) return true;
  }
  return false;
}

export function validatePhoneDetails(phone: string): PhoneValidationResult {
  return validateAndNormalizePhone(phone, 'US');
}

export function isPlausiblePhoneNumber(phone: string): boolean {
  if (!phone) return true;
  return validateAndNormalizePhone(phone, 'US').valid;
}

export async function verifyEmailMxRecord(
  email: string
): Promise<{ ok: boolean; hasMx: boolean; reason?: string; transientError?: boolean }> {
  const atIdx = email.lastIndexOf('@');
  if (atIdx < 1) {
    return { ok: false, hasMx: false, reason: 'Please enter a valid email address.' };
  }
  const domain = email.slice(atIdx + 1).trim().toLowerCase();
  if (isDisposableEmailDomain(email)) {
    return {
      ok: false,
      hasMx: false,
      reason: 'Temporary or disposable email domains are not accepted. Please use a real email address.',
    };
  }

  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ETIMEOUT')), ms);
      promise.then(
        (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });

  try {
    const mx = await withTimeout(dns.resolveMx(domain), 2500);
    if (Array.isArray(mx) && mx.length > 0) {
      return { ok: true, hasMx: true };
    }
    return {
      ok: false,
      hasMx: false,
      reason: 'This email domain does not have active mail servers.',
    };
  } catch (err) {
    const code = (err as { code?: string; message?: string })?.code || (err as Error)?.message || '';
    if (code === 'ENOTFOUND' || code === 'NXDOMAIN') {
      return {
        ok: false,
        hasMx: false,
        reason: 'Email domain could not be found. Please check for typos.',
      };
    }
    if (code === 'ENODATA') {
      try {
        const aRecords = await withTimeout(dns.resolve4(domain), 2000);
        if (Array.isArray(aRecords) && aRecords.length > 0) {
          return { ok: true, hasMx: false };
        }
      } catch {
        // fall through to rejection
      }
      return {
        ok: false,
        hasMx: false,
        reason: 'This email domain cannot receive mail (no MX or A record).',
      };
    }
    // Fail open on transient DNS timeouts so real recruiters aren't blocked
    return { ok: true, hasMx: false, transientError: true };
  }
}

export function getTimezoneOffsetMinutes(tz: string, date = new Date()): number | null {
  if (!tz || tz.length > 64) return null;
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    if (Number.isNaN(utcDate.getTime()) || Number.isNaN(tzDate.getTime())) {
      return null;
    }
    return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
  } catch {
    return null;
  }
}

export function hasTimezoneMismatch(ipTimezone: string, clientTimezone: string): boolean {
  if (!ipTimezone || !clientTimezone) return false;
  const ipOffset = getTimezoneOffsetMinutes(ipTimezone);
  const clientOffset = getTimezoneOffsetMinutes(clientTimezone);
  if (ipOffset === null || clientOffset === null) return false;
  return Math.abs(ipOffset - clientOffset) >= 90;
}

export function isHostingOrVpnAsn(isp: string, org: string, asn: string): boolean {
  const combined = `${isp} ${org} ${asn}`.toLowerCase();
  if (!combined.trim()) return false;
  return HOSTING_OR_VPN_KEYWORDS.some((kw) => combined.includes(kw));
}

const ipGeoCache = new Map<string, { value: IpIntelligence; expiresAt: number }>();
const IP_CACHE_TTL_MS = 10 * 60 * 1000;
const IP_CACHE_MAX_ENTRIES = 500;

export async function lookupIpIntelligence(ipAddress: string): Promise<IpIntelligence> {
  if (isPrivateOrLoopbackIp(ipAddress)) {
    return {
      ipAddress,
      isPrivate: true,
      country: 'Local / Private Network',
      countryCode: 'LOC',
      region: 'Private',
      city: 'Localhost',
      isp: 'Private / Loopback Interface',
      asn: 'LOCAL',
      org: 'Local Network',
      timezone: '',
      isProxy: false,
      isHosting: false,
      isMobile: false,
      lookupProvider: 'local',
    };
  }

  const now = Date.now();
  const cached = ipGeoCache.get(ipAddress);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const saveCache = (value: IpIntelligence) => {
    if (ipGeoCache.size >= IP_CACHE_MAX_ENTRIES) {
      for (const [k, v] of ipGeoCache.entries()) {
        if (v.expiresAt <= now) ipGeoCache.delete(k);
      }
      if (ipGeoCache.size >= IP_CACHE_MAX_ENTRIES) {
        const firstKey = ipGeoCache.keys().next().value;
        if (firstKey) ipGeoCache.delete(firstKey);
      }
    }
    ipGeoCache.set(ipAddress, { value, expiresAt: now + IP_CACHE_TTL_MS });
  };

  // Primary lookup: ip-api.com provides native proxy/hosting/mobile flags
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ipAddress)}?fields=status,country,countryCode,regionName,city,timezone,isp,org,as,proxy,hosting,mobile`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        country?: string;
        countryCode?: string;
        regionName?: string;
        city?: string;
        timezone?: string;
        isp?: string;
        org?: string;
        as?: string;
        proxy?: boolean;
        hosting?: boolean;
        mobile?: boolean;
      };
      if (data.status === 'success') {
        const intel: IpIntelligence = {
          ipAddress,
          isPrivate: false,
          country: sanitizeHeaderValue(data.country || 'Unknown').slice(0, 80),
          countryCode: sanitizeHeaderValue(data.countryCode || '').slice(0, 12),
          region: sanitizeHeaderValue(data.regionName || '').slice(0, 80),
          city: sanitizeHeaderValue(data.city || '').slice(0, 80),
          isp: sanitizeHeaderValue(data.isp || 'Unknown').slice(0, 120),
          asn: sanitizeHeaderValue((data.as || '').split(' ')[0] || '').slice(0, 64),
          org: sanitizeHeaderValue(data.org || data.isp || '').slice(0, 120),
          timezone: sanitizeHeaderValue(data.timezone || '').slice(0, 64),
          isProxy: Boolean(data.proxy),
          isHosting: Boolean(data.hosting),
          isMobile: Boolean(data.mobile),
          lookupProvider: 'ip-api',
        };
        saveCache(intel);
        return intel;
      }
    }
  } catch {
    // Fall back to ipwho.is below
  }

  // Fallback lookup: ipwho.is over HTTPS
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ipAddress)}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        success?: boolean;
        country?: string;
        country_code?: string;
        region?: string;
        city?: string;
        timezone?: { id?: string };
        connection?: { asn?: number; org?: string; isp?: string };
      };
      if (data.success) {
        const isp = sanitizeHeaderValue(data.connection?.isp || data.connection?.org || 'Unknown').slice(0, 120);
        const org = sanitizeHeaderValue(data.connection?.org || isp).slice(0, 120);
        const asn = data.connection?.asn ? `AS${data.connection.asn}` : '';
        const intel: IpIntelligence = {
          ipAddress,
          isPrivate: false,
          country: sanitizeHeaderValue(data.country || 'Unknown').slice(0, 80),
          countryCode: sanitizeHeaderValue(data.country_code || '').slice(0, 12),
          region: sanitizeHeaderValue(data.region || '').slice(0, 80),
          city: sanitizeHeaderValue(data.city || '').slice(0, 80),
          isp,
          asn: asn.slice(0, 64),
          org,
          timezone: sanitizeHeaderValue(data.timezone?.id || '').slice(0, 64),
          isProxy: false,
          isHosting: isHostingOrVpnAsn(isp, org, asn),
          isMobile: false,
          lookupProvider: 'ipwho.is',
        };
        saveCache(intel);
        return intel;
      }
    }
  } catch {
    // Unavailable
  }

  return {
    ipAddress,
    isPrivate: false,
    country: 'Unknown',
    countryCode: '',
    region: '',
    city: '',
    isp: 'Lookup unavailable',
    asn: '',
    org: '',
    timezone: '',
    isProxy: false,
    isHosting: false,
    isMobile: false,
    lookupProvider: 'unavailable',
  };
}

export function assessVisitorRisk(
  intel: IpIntelligence,
  context: {
    clientTimezone?: string;
    hasEmail: boolean;
    phoneCountry?: string;
  }
): RiskAssessment {
  let score = 0;
  const riskReasons: string[] = [];
  const clientTz = sanitizeHeaderValue(context.clientTimezone || '').slice(0, 64);
  const asnVpnMatch = !intel.isPrivate && isHostingOrVpnAsn(intel.isp, intel.org, intel.asn);
  const timezoneMismatch = !intel.isPrivate && hasTimezoneMismatch(intel.timezone, clientTz);
  const phoneGeoMismatch =
    Boolean(context.phoneCountry) &&
    !intel.isPrivate &&
    Boolean(intel.countryCode) &&
    context.phoneCountry !== intel.countryCode;

  if (intel.isProxy) {
    score += 60;
    riskReasons.push('VPN / Proxy / Tor IP flagged');
  }
  if (intel.isHosting || asnVpnMatch) {
    score += 40;
    riskReasons.push('Cloud / Datacenter ASN');
  }
  if (timezoneMismatch) {
    score += 35;
    riskReasons.push('Browser vs IP timezone mismatch');
  }
  if (!context.hasEmail) {
    score += 20;
    riskReasons.push('Phone-only contact (no email)');
  }
  if (phoneGeoMismatch) {
    score += 15;
    riskReasons.push(`Phone region (${context.phoneCountry}) differs from IP (${intel.countryCode})`);
  }

  const riskLevel: RiskLevel = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  const isVpnSuspected = !intel.isPrivate && (intel.isProxy || intel.isHosting || asnVpnMatch || timezoneMismatch);

  return {
    riskScore: score,
    riskLevel,
    isVpnSuspected,
    timezoneMismatch,
    asnVpnMatch,
    riskReasons,
  };
}

export function generateDownloadId(): string {
  return `CV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function generateSessionId(): string {
  return `SES-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

export function maskEmailAddress(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx <= 1) return email;
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

export interface SessionReceiptPayload {
  sessionId: string;
  name: string;
  email: string;
  phone: string;
  reason: string;
  verificationStatus: VerificationStatus;
  issuedAt: number;
}

export function signSessionReceipt(payload: SessionReceiptPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionReceipt(
  token: string | undefined,
  secret: string,
  maxAgeMs = 12 * 60 * 60 * 1000
): SessionReceiptPayload | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionReceiptPayload;
    if (!parsed || typeof parsed.sessionId !== 'string' || typeof parsed.issuedAt !== 'number') {
      return null;
    }
    if (Date.now() - parsed.issuedAt > maxAgeMs) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface OtpPendingPayload {
  name: string;
  email: string;
  phone: string;
  reason: string;
  action: 'pdf' | 'print' | 'ats' | 'install';
  formatLabel: string;
  theme: 'dark' | 'light';
  clientTimezone: string;
  clientLanguage: string;
  clientScreen: string;
  referrer: string;
  userAgent: string;
  ip: IpIntelligence;
  risk: RiskAssessment;
}

export interface ContactOtpPendingPayload {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  theme: 'dark' | 'light';
  clientTimezone: string;
  referrer: string;
  userAgent: string;
  ip: IpIntelligence;
  risk: RiskAssessment;
}

export interface OtpChallengeRecord<T = OtpPendingPayload> {
  challengeId: string;
  codeHash: string;
  tokenHash: string;
  expiresAt: number;
  attempts: number;
  payload: T;
}

export function hashOtpValue(challengeId: string, value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${challengeId}:${value}`).digest('hex');
}

export function createOtpChallenge<T = OtpPendingPayload>(
  store: Map<string, OtpChallengeRecord<T>>,
  payload: T,
  secret: string,
  options: { now?: number; ttlMs?: number; fixedCode?: string } = {}
): { challengeId: string; challengeToken: string; code: string; expiresAt: number } {
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? 10 * 60 * 1000;

  // Prune expired entries first
  for (const [id, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(id);
    }
  }
  if (store.size >= 500) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }

  const challengeId = `otp_${crypto.randomBytes(8).toString('hex')}`;
  const challengeToken = crypto.randomBytes(18).toString('base64url');
  const code = options.fixedCode ?? String(crypto.randomInt(100000, 1000000));
  const expiresAt = now + ttlMs;

  store.set(challengeId, {
    challengeId,
    codeHash: hashOtpValue(challengeId, code, secret),
    tokenHash: hashOtpValue(challengeId, challengeToken, secret),
    expiresAt,
    attempts: 0,
    payload,
  });

  return { challengeId, challengeToken, code, expiresAt };
}

export function verifyOtpChallenge<T = OtpPendingPayload>(
  store: Map<string, OtpChallengeRecord<T>>,
  input: { challengeId: string; challengeToken: string; code: string },
  secret: string,
  options: { now?: number; maxAttempts?: number } = {}
): { ok: true; payload: T } | { ok: false; error: string } {
  const now = options.now ?? Date.now();
  const maxAttempts = options.maxAttempts ?? 5;
  const record = store.get(input.challengeId);
  if (!record) {
    return { ok: false, error: 'Verification code expired or invalid. Please request a new code.' };
  }
  if (record.expiresAt <= now) {
    store.delete(input.challengeId);
    return { ok: false, error: 'Verification code expired. Please submit the form again.' };
  }

  const submittedTokenHash = hashOtpValue(input.challengeId, input.challengeToken, secret);
  if (
    submittedTokenHash.length !== record.tokenHash.length ||
    !crypto.timingSafeEqual(Buffer.from(submittedTokenHash), Buffer.from(record.tokenHash))
  ) {
    return { ok: false, error: 'Invalid verification session. Please refresh and try again.' };
  }

  record.attempts += 1;
  if (record.attempts > maxAttempts) {
    store.delete(input.challengeId);
    return { ok: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }

  const cleanCode = input.code.replace(/\s+/g, '');
  const submittedCodeHash = hashOtpValue(input.challengeId, cleanCode, secret);
  if (
    submittedCodeHash.length !== record.codeHash.length ||
    !crypto.timingSafeEqual(Buffer.from(submittedCodeHash), Buffer.from(record.codeHash))
  ) {
    const remaining = maxAttempts - record.attempts;
    if (remaining <= 0) {
      store.delete(input.challengeId);
      return { ok: false, error: 'Too many incorrect attempts. Please request a new code.' };
    }
    return { ok: false, error: `Incorrect 6-digit code (${remaining} attempts left).` };
  }

  // Single-use: consume challenge immediately on match
  store.delete(input.challengeId);
  return { ok: true, payload: record.payload };
}
