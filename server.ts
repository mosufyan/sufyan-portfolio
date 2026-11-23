import crypto from 'crypto';
import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  MAX_FIELD_LENGTHS,
  applySecurityHeaders,
  escapeHtml,
  isAiStudioPreviewHost,
  isAllowedRequestOrigin,
  isBlockedBotUserAgent,
  isCloudflareEdgeProxied,
  isCspStrictStylesEnabled,
  isDisallowedFetchSite,
  isFormSubmitFallbackAllowed,
  isHoneypotTriggered,
  isValidEmailAddress,
  isValidPhoneNumber,
  resolveAllowedOrigins,
  resolveSafeBaseUrl,
  sanitizeDisplayName,
  sanitizeHeaderValue,
  shouldAllowPreviewIframe,
  verifyTurnstileToken,
} from './server/security.ts';
import {
  getEmailPalette,
  parseEmailAccent,
  parseEmailTheme,
  type EmailAccent,
  type EmailTheme,
} from './server/emailTheme.ts';
import {
  assessVisitorRisk,
  configureOtpRedisBridge,
  createOtpChallengeAsync,
  extractClientIp,
  generateDownloadId,
  generateSessionId,
  lookupIpIntelligence,
  maskEmailAddress,
  signSessionReceipt,
  validatePhoneDetails,
  verifyEmailMxRecord,
  verifyOtpChallengeAsync,
  verifySessionReceipt,
  type ContactOtpPendingPayload,
  type OtpChallengeRecord,
  type VerificationStatus,
  type VisitorTelemetryReport,
} from './server/telemetry.ts';
import { SESSION_EXPIRED_CODE, SESSION_EXPIRED_MESSAGES } from './server/sessionPolicy.ts';
import { APP_VERSION, APP_VERSION_LABEL } from './server/appVersion.ts';
import {
  checkDistributedRateLimit,
  isDistributedStoreEnabled,
  loadDistributedOwnerPolicy,
  redisDel,
  redisGetJson,
  redisSetJson,
  saveDistributedOwnerPolicy,
  type RateLimitNamespace,
} from './server/distributedStore.ts';
import {
  bumpMetric,
  captureException,
  evaluateBotProtection,
  evaluateGoldPathHardening,
  getObservabilitySnapshot,
  postSlackAlert,
  requestContextMiddleware,
  structuredLog,
} from './server/observability.ts';
import {
  adminGetContactMessage,
  adminMarkContactReplied,
  adminWriteContactMessage,
  adminWriteCvDownload,
  isFirebaseAdminConfigured,
} from './server/firebaseAdmin.ts';
import { answerPortfolioQuestion, listChatSuggestions } from './server/chatKnowledge.ts';
import {
  answerPortfolioQuestionSmart,
  isPortfolioVectorConfigured,
  syncPortfolioVectors,
} from './server/portfolioVector.ts';
import {
  chatSessionAuthError,
  extractChatReceipt as extractChatReceiptToken,
  signChatSessionReceipt as signChatSessionReceiptToken,
  verifyChatSessionReceipt as verifyChatSessionReceiptToken,
} from './server/chatReceipt.ts';
import {
  appendChatMessage,
  bumpBotQuestion,
  bumpLiveRequest,
  bumpLlmCall,
  closeChatSession,
  createChatSession,
  ensureChatCacheHydrated,
  getChatSessionAsync,
  getChatStats,
  isOwnerOnline,
  listChatSessions,
  publicSessionView,
  startNewChatThread,
  clearOwnerPresence,
  flushChatCacheSync,
  touchOwnerPresence,
} from './server/chatSessions.ts';
import {
  buildVisitorKey,
  checkChatLimitAsync,
  consumeChatLimitAsync,
  getChatUsageTotals,
  type ChatLimitPolicy,
} from './server/chatLimits.ts';
import {
  enrichAnswerWithGrokLlm,
  isGrokLlmConfigured,
  shouldSkipGrokEnrichment,
} from './server/grokLlm.ts';
import { parseMultipartAudio, VOICE_AUDIO_MAX_BYTES } from './server/multipartAudio.ts';
import { isVoiceSttConfigured } from './server/voiceStt.ts';
import { isVoiceTtsConfigured } from './server/voiceTts.ts';
import { runVoiceTurn } from './server/voiceTurn.ts';
import { buildDynamicSocialSvg, SHARE_CARD_TRACKS, type ShareTrackId } from './src/utils/ogShare.ts';
import {
  DEFAULT_PORTFOLIO_SETTINGS,
  evaluateAccessRules,
  sanitizeOwnerAlertClass,
  validateAccessRuleDraft,
  type CompactAccessRule,
  type OwnerAlertClass,
} from './src/utils/ownerGovernance.ts';
import {
  drainDigestItems,
  formatDigestQueueText,
  prefsFromPortfolioSettings,
  routeOwnerNotification,
} from './server/ownerNotify.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readFirebaseProjectId(): string {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    return parsed.projectId || 'mohammed-sufyan-portfolio';
  } catch {
    return 'mohammed-sufyan-portfolio';
  }
}

const FIREBASE_PROJECT_ID = readFirebaseProjectId();
const PORT = Number(process.env.PORT) || 3000;
const DESTINATION_EMAIL = process.env.CONTACT_TO_EMAIL || 'sufyan.net@gmail.com';
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY?.trim() || '';
const TURNSTILE_SITE_KEY =
  process.env.VITE_TURNSTILE_SITE_KEY?.trim() || process.env.TURNSTILE_SITE_KEY?.trim() || '';
const SESSION_SECRET_ENV = process.env.SESSION_SECRET?.trim() || '';
if (process.env.NODE_ENV === 'production' && !SESSION_SECRET_ENV) {
  throw new Error(
    'SESSION_SECRET is required in production for OTP HMAC and session receipts.'
  );
}
const OTP_SECRET = SESSION_SECRET_ENV || crypto.randomBytes(32).toString('hex');
const FORCE_CV_OTP = (process.env.FORCE_CV_OTP || '').toLowerCase() === 'true';
const ALLOWED_ORIGINS = resolveAllowedOrigins(process.env.APP_URL, PORT);
const otpChallengeStore = new Map<string, OtpChallengeRecord>();
const contactOtpChallengeStore = new Map<string, OtpChallengeRecord<ContactOtpPendingPayload>>();
interface ChatLiveOtpPayload {
  name: string;
  email: string;
  company: string;
  interest: string;
  openingMessage: string;
  theme: EmailTheme;
  accent?: EmailAccent;
  userAgent: string;
  ipAddress: string;
}
const chatLiveOtpStore = new Map<string, OtpChallengeRecord<ChatLiveOtpPayload>>();

configureOtpRedisBridge({
  enabled: () => isDistributedStoreEnabled(),
  setJson: redisSetJson,
  getJson: redisGetJson,
  del: redisDel,
});

function signChatSessionReceipt(sessionId: string, email: string): string {
  return signChatSessionReceiptToken(sessionId, email, OTP_SECRET);
}

function verifyChatSessionReceipt(
  receipt: string | undefined,
  sessionId: string
): { ok: true; email: string } | { ok: false; reason: 'expired' | 'invalid' } {
  return verifyChatSessionReceiptToken(receipt, sessionId, OTP_SECRET);
}

interface RuntimeOwnerPolicy {
  rules: CompactAccessRule[];
  strictOtpForAll: boolean;
  requireOtpForChat: boolean;
  requireOtpForContact: boolean;
  requireOtpForCv: boolean;
  enableContactForm: boolean;
  enableCvDownloads: boolean;
  enablePwaInstall: boolean;
  enableSiteTelemetry: boolean;
  incidentMode: boolean;
  notifyOnNewInquiry: boolean;
  enablePortfolioChat: boolean;
  enableLiveChat: boolean;
  enableChatLlm: boolean;
  enableVoiceAgent: boolean;
  chatMaxQuestionsPerVisitor: number;
  chatMaxLlmPerVisitor: number;
  chatMaxLiveSessionsPerVisitor: number;
  chatMaxVoiceTurnsPerVisitor: number;
  chatRateWindowHours: number;
  chatLlmModel: string;
  chatShowSuggestions: boolean;
  chatOfferLiveAgent: boolean;
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

function chatLimitPolicyFromRuntime(policy: RuntimeOwnerPolicy): ChatLimitPolicy {
  return {
    maxQuestionsPerVisitor: policy.chatMaxQuestionsPerVisitor,
    maxLlmPerVisitor: policy.chatMaxLlmPerVisitor,
    maxLiveSessionsPerVisitor: policy.chatMaxLiveSessionsPerVisitor,
    maxVoiceTurnsPerVisitor: policy.chatMaxVoiceTurnsPerVisitor,
    rateWindowHours: policy.chatRateWindowHours,
  };
}

function clampPolicyInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const POLICY_CACHE_PATH = path.join(__dirname, '.owner-policy-cache.json');
const TELEMETRY_CACHE_PATH = path.join(__dirname, '.owner-telemetry-cache.json');

interface SiteTelemetryState {
  pageviews: number;
  ogShares: number;
  ogByTrack: Record<string, number>;
  updatedAtIso: string;
}

function normalizeShareTrack(track?: string): ShareTrackId {
  // Literal returns so static analysis cannot treat the key as user-controlled.
  if (track === 'security') return 'security';
  if (track === 'platform') return 'platform';
  if (track === 'ai') return 'ai';
  return 'executive';
}

function sanitizeOgByTrack(raw: unknown): Record<string, number> {
  const out: Record<string, number> = Object.create(null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const src = raw as Record<string, unknown>;
  for (const id of ['executive', 'security', 'platform', 'ai'] as const) {
    const n = Number(src[id]);
    if (Number.isFinite(n) && n > 0) out[id] = Math.floor(n);
  }
  return out;
}

function loadSiteTelemetry(): SiteTelemetryState {
  const defaults: SiteTelemetryState = {
    pageviews: 0,
    ogShares: 0,
    ogByTrack: {},
    updatedAtIso: new Date().toISOString(),
  };
  try {
    if (!fs.existsSync(TELEMETRY_CACHE_PATH)) return defaults;
    const parsed = JSON.parse(fs.readFileSync(TELEMETRY_CACHE_PATH, 'utf8')) as Partial<SiteTelemetryState>;
    return {
      pageviews: Number(parsed.pageviews) || 0,
      ogShares: Number(parsed.ogShares) || 0,
      ogByTrack: sanitizeOgByTrack(parsed.ogByTrack),
      updatedAtIso: typeof parsed.updatedAtIso === 'string' ? parsed.updatedAtIso : defaults.updatedAtIso,
    };
  } catch {
    return defaults;
  }
}

let siteTelemetry: SiteTelemetryState = loadSiteTelemetry();
let telemetryFlushTimer: ReturnType<typeof setTimeout> | null = null;

function persistSiteTelemetryToDisk(): void {
  try {
    fs.writeFileSync(TELEMETRY_CACHE_PATH, JSON.stringify(siteTelemetry, null, 2), 'utf8');
  } catch {
    /* non-fatal */
  }
}

function scheduleSiteTelemetryFlush(): void {
  if (telemetryFlushTimer) return;
  telemetryFlushTimer = setTimeout(() => {
    telemetryFlushTimer = null;
    persistSiteTelemetryToDisk();
  }, 2000);
}

function bumpSiteTelemetry(kind: 'pageview' | 'og_share', track?: string): void {
  const next: SiteTelemetryState = {
    pageviews: siteTelemetry.pageviews + (kind === 'pageview' ? 1 : 0),
    ogShares: siteTelemetry.ogShares + (kind === 'og_share' ? 1 : 0),
    ogByTrack: { ...siteTelemetry.ogByTrack },
    updatedAtIso: new Date().toISOString(),
  };
  if (kind === 'og_share') {
    // Assign via literal property names (avoids remote-property-injection).
    switch (normalizeShareTrack(track)) {
      case 'security':
        next.ogByTrack.security = (next.ogByTrack.security || 0) + 1;
        break;
      case 'platform':
        next.ogByTrack.platform = (next.ogByTrack.platform || 0) + 1;
        break;
      case 'ai':
        next.ogByTrack.ai = (next.ogByTrack.ai || 0) + 1;
        break;
      default:
        next.ogByTrack.executive = (next.ogByTrack.executive || 0) + 1;
        break;
    }
  }
  siteTelemetry = next;
  scheduleSiteTelemetryFlush();
}

function otpRequiredFor(surface: 'chat' | 'contact' | 'cv'): boolean {
  if (runtimeOwnerPolicy.incidentMode) return true;
  if (surface === 'chat') return runtimeOwnerPolicy.requireOtpForChat;
  if (surface === 'contact') return runtimeOwnerPolicy.requireOtpForContact;
  return runtimeOwnerPolicy.requireOtpForCv || runtimeOwnerPolicy.strictOtpForAll;
}

function loadInitialOwnerPolicy(): RuntimeOwnerPolicy {
  const defaults: RuntimeOwnerPolicy = {
    rules: [],
    strictOtpForAll: DEFAULT_PORTFOLIO_SETTINGS.strictOtpForAll,
    requireOtpForChat: DEFAULT_PORTFOLIO_SETTINGS.requireOtpForChat,
    requireOtpForContact: DEFAULT_PORTFOLIO_SETTINGS.requireOtpForContact,
    requireOtpForCv: DEFAULT_PORTFOLIO_SETTINGS.requireOtpForCv,
    enableContactForm: true,
    enableCvDownloads: true,
    enablePwaInstall: DEFAULT_PORTFOLIO_SETTINGS.enablePwaInstall,
    enableSiteTelemetry: DEFAULT_PORTFOLIO_SETTINGS.enableSiteTelemetry,
    incidentMode: false,
    notifyOnNewInquiry: true,
    enablePortfolioChat: DEFAULT_PORTFOLIO_SETTINGS.enablePortfolioChat,
    enableLiveChat: DEFAULT_PORTFOLIO_SETTINGS.enableLiveChat,
    enableChatLlm: DEFAULT_PORTFOLIO_SETTINGS.enableChatLlm,
    enableVoiceAgent: DEFAULT_PORTFOLIO_SETTINGS.enableVoiceAgent,
    chatMaxQuestionsPerVisitor: DEFAULT_PORTFOLIO_SETTINGS.chatMaxQuestionsPerVisitor,
    chatMaxLlmPerVisitor: DEFAULT_PORTFOLIO_SETTINGS.chatMaxLlmPerVisitor,
    chatMaxLiveSessionsPerVisitor: DEFAULT_PORTFOLIO_SETTINGS.chatMaxLiveSessionsPerVisitor,
    chatMaxVoiceTurnsPerVisitor: DEFAULT_PORTFOLIO_SETTINGS.chatMaxVoiceTurnsPerVisitor,
    chatRateWindowHours: DEFAULT_PORTFOLIO_SETTINGS.chatRateWindowHours,
    chatLlmModel: DEFAULT_PORTFOLIO_SETTINGS.chatLlmModel,
    chatShowSuggestions: DEFAULT_PORTFOLIO_SETTINGS.chatShowSuggestions,
    chatOfferLiveAgent: DEFAULT_PORTFOLIO_SETTINGS.chatOfferLiveAgent,
    alertEmailEnabled: DEFAULT_PORTFOLIO_SETTINGS.alertEmailEnabled,
    alertEmailUrgent: DEFAULT_PORTFOLIO_SETTINGS.alertEmailUrgent,
    alertEmailWarning: DEFAULT_PORTFOLIO_SETTINGS.alertEmailWarning,
    alertEmailDigest: DEFAULT_PORTFOLIO_SETTINGS.alertEmailDigest,
    alertClassNewInquiry: DEFAULT_PORTFOLIO_SETTINGS.alertClassNewInquiry,
    alertClassLiveChat: DEFAULT_PORTFOLIO_SETTINGS.alertClassLiveChat,
    alertClassRiskDownload: DEFAULT_PORTFOLIO_SETTINGS.alertClassRiskDownload,
    alertClassUnusualTraffic: DEFAULT_PORTFOLIO_SETTINGS.alertClassUnusualTraffic,
    alertClassChatLimit: DEFAULT_PORTFOLIO_SETTINGS.alertClassChatLimit,
    alertClassOverdueCrm: DEFAULT_PORTFOLIO_SETTINGS.alertClassOverdueCrm,
  };
  try {
    if (!fs.existsSync(POLICY_CACHE_PATH)) return defaults;
    const parsed = JSON.parse(fs.readFileSync(POLICY_CACHE_PATH, 'utf8')) as Partial<RuntimeOwnerPolicy>;
    const requireOtpForCv =
      typeof parsed.requireOtpForCv === 'boolean'
        ? parsed.requireOtpForCv
        : typeof parsed.strictOtpForAll === 'boolean'
          ? Boolean(parsed.strictOtpForAll)
          : defaults.requireOtpForCv;
    return {
      rules: Array.isArray(parsed.rules) ? parsed.rules.slice(0, 200) : [],
      requireOtpForChat:
        typeof parsed.requireOtpForChat === 'boolean'
          ? parsed.requireOtpForChat
          : defaults.requireOtpForChat,
      requireOtpForContact:
        typeof parsed.requireOtpForContact === 'boolean'
          ? parsed.requireOtpForContact
          : defaults.requireOtpForContact,
      requireOtpForCv,
      strictOtpForAll: requireOtpForCv,
      enableContactForm: typeof parsed.enableContactForm === 'boolean' ? parsed.enableContactForm : true,
      enableCvDownloads: typeof parsed.enableCvDownloads === 'boolean' ? parsed.enableCvDownloads : true,
      enablePwaInstall:
        typeof parsed.enablePwaInstall === 'boolean'
          ? parsed.enablePwaInstall
          : DEFAULT_PORTFOLIO_SETTINGS.enablePwaInstall,
      enableSiteTelemetry:
        typeof parsed.enableSiteTelemetry === 'boolean'
          ? parsed.enableSiteTelemetry
          : DEFAULT_PORTFOLIO_SETTINGS.enableSiteTelemetry,
      incidentMode: Boolean(parsed.incidentMode),
      notifyOnNewInquiry:
        typeof parsed.notifyOnNewInquiry === 'boolean' ? parsed.notifyOnNewInquiry : true,
      enablePortfolioChat:
        typeof parsed.enablePortfolioChat === 'boolean'
          ? parsed.enablePortfolioChat
          : defaults.enablePortfolioChat,
      enableLiveChat:
        typeof parsed.enableLiveChat === 'boolean' ? parsed.enableLiveChat : defaults.enableLiveChat,
      enableChatLlm:
        typeof parsed.enableChatLlm === 'boolean' ? parsed.enableChatLlm : defaults.enableChatLlm,
      enableVoiceAgent:
        typeof parsed.enableVoiceAgent === 'boolean'
          ? parsed.enableVoiceAgent
          : defaults.enableVoiceAgent,
      chatMaxQuestionsPerVisitor: clampPolicyInt(
        parsed.chatMaxQuestionsPerVisitor,
        defaults.chatMaxQuestionsPerVisitor,
        1,
        200
      ),
      chatMaxLlmPerVisitor: clampPolicyInt(
        parsed.chatMaxLlmPerVisitor,
        defaults.chatMaxLlmPerVisitor,
        0,
        100
      ),
      chatMaxLiveSessionsPerVisitor: clampPolicyInt(
        parsed.chatMaxLiveSessionsPerVisitor,
        defaults.chatMaxLiveSessionsPerVisitor,
        0,
        50
      ),
      chatMaxVoiceTurnsPerVisitor: clampPolicyInt(
        parsed.chatMaxVoiceTurnsPerVisitor,
        defaults.chatMaxVoiceTurnsPerVisitor,
        0,
        50
      ),
      chatRateWindowHours: clampPolicyInt(
        parsed.chatRateWindowHours,
        defaults.chatRateWindowHours,
        1,
        168
      ),
      chatLlmModel:
        typeof parsed.chatLlmModel === 'string'
          ? parsed.chatLlmModel.slice(0, 64)
          : defaults.chatLlmModel,
      chatShowSuggestions:
        typeof parsed.chatShowSuggestions === 'boolean'
          ? parsed.chatShowSuggestions
          : defaults.chatShowSuggestions,
      chatOfferLiveAgent:
        typeof parsed.chatOfferLiveAgent === 'boolean'
          ? parsed.chatOfferLiveAgent
          : defaults.chatOfferLiveAgent,
      alertEmailEnabled:
        typeof parsed.alertEmailEnabled === 'boolean'
          ? parsed.alertEmailEnabled
          : defaults.alertEmailEnabled,
      alertEmailUrgent:
        typeof parsed.alertEmailUrgent === 'boolean'
          ? parsed.alertEmailUrgent
          : defaults.alertEmailUrgent,
      alertEmailWarning:
        typeof parsed.alertEmailWarning === 'boolean'
          ? parsed.alertEmailWarning
          : defaults.alertEmailWarning,
      alertEmailDigest:
        typeof parsed.alertEmailDigest === 'boolean'
          ? parsed.alertEmailDigest
          : defaults.alertEmailDigest,
      alertClassNewInquiry: sanitizeOwnerAlertClass(
        parsed.alertClassNewInquiry,
        defaults.alertClassNewInquiry
      ),
      alertClassLiveChat: sanitizeOwnerAlertClass(
        parsed.alertClassLiveChat,
        defaults.alertClassLiveChat
      ),
      alertClassRiskDownload: sanitizeOwnerAlertClass(
        parsed.alertClassRiskDownload,
        defaults.alertClassRiskDownload
      ),
      alertClassUnusualTraffic: sanitizeOwnerAlertClass(
        parsed.alertClassUnusualTraffic,
        defaults.alertClassUnusualTraffic
      ),
      alertClassChatLimit: sanitizeOwnerAlertClass(
        parsed.alertClassChatLimit,
        defaults.alertClassChatLimit
      ),
      alertClassOverdueCrm: sanitizeOwnerAlertClass(
        parsed.alertClassOverdueCrm,
        defaults.alertClassOverdueCrm
      ),
    };
  } catch {
    return defaults;
  }
}

function buildOwnerAlertEmailHtml(input: {
  alertClass: 'urgent' | 'warning';
  title: string;
  detail: string;
  theme?: EmailTheme;
  accent?: EmailAccent;
  timestamp?: string;
}): string {
  const p = getEmailPalette(parseEmailTheme(input.theme), parseEmailAccent(input.accent));
  const isUrgent = input.alertClass === 'urgent';
  const badgeBg = isUrgent ? (p.theme === 'light' ? '#ffe4e6' : '#4c0519') : p.badgeSuccessBg;
  const badgeBorder = isUrgent ? (p.theme === 'light' ? '#fb7185' : '#e11d48') : p.badgeSuccessBorder;
  const badgeText = isUrgent ? (p.theme === 'light' ? '#be123c' : '#fb7185') : p.badgeSuccessText;
  const accentBar = isUrgent ? '#e11d48' : '#d97706';
  const safeTitle = escapeHtml(input.title);
  const safeDetail = escapeHtml(input.detail).replace(/\r?\n/g, '<br />');
  const safeTime = escapeHtml(input.timestamp || new Date().toUTCString());
  const consoleUrl = cleanSecretEnv(process.env.APP_URL) || 'https://www.mohammedsufyan.com';
  const safeConsoleUrl = escapeHtml(consoleUrl.replace(/\/$/, ''));

  return `<!DOCTYPE html>
<html lang="en" data-theme="${p.theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="${p.theme}" />
  <meta name="supported-color-schemes" content="${p.theme}" />
  <title>${isUrgent ? 'Urgent' : 'Warning'} Alert — ${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:${p.pageBg};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${p.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${p.pageBg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background-color:${p.cardBg};border:1px solid ${p.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background-color:${p.headerBg};border-bottom:1px solid ${p.border};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width:38px;height:38px;border-radius:10px;background-color:${p.accentSoftBg};border:1px solid ${p.accentDeep};text-align:center;vertical-align:middle;font-weight:700;font-size:14px;color:${p.accent};font-family:monospace;">
                          MS
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:15px;font-weight:700;color:${p.textStrong};letter-spacing:0.02em;">
                            MOHAMMED SUFYAN
                          </div>
                          <div style="font-size:11px;font-family:monospace;color:${p.accent};text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">
                            Owner Alert Dispatch
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:5px 10px;border-radius:6px;background-color:${badgeBg};border:1px solid ${badgeBorder};color:${badgeText};font-size:10px;font-family:monospace;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                      ${isUrgent ? 'URGENT' : 'WARNING'}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 16px 28px;">
              <div style="font-size:11px;font-family:monospace;color:${p.accent};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
                ${isUrgent ? 'IMMEDIATE ATTENTION' : 'OWNER NOTICE'}
              </div>
              <h1 style="margin:0;font-size:21px;font-weight:700;color:${p.textStrong};line-height:1.3;">
                ${safeTitle}
              </h1>
              <p style="margin:8px 0 0 0;font-size:12px;font-family:monospace;color:${p.textMuted};">
                Dispatched ${safeTime} · Theme ${p.theme}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 20px 28px;">
              <div style="background-color:${p.panelBg};border:1px solid ${p.border};border-left:3px solid ${accentBar};border-radius:12px;padding:18px 20px;">
                <div style="font-size:10px;font-family:monospace;color:${badgeText};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">
                  Alert Detail
                </div>
                <div style="font-size:14px;line-height:1.65;color:${p.text};">
                  ${safeDetail}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <a href="${safeConsoleUrl}/#owner/chat" style="display:inline-block;padding:11px 20px;background-color:${p.ctaBg};color:${p.ctaText};font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">
                Open Owner Console
              </a>
              <div style="margin-top:12px;font-size:12px;font-family:monospace;color:${p.textMuted};">
                Alerts · Chat · Messages · ${safeConsoleUrl}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background-color:${p.footerBg};border-top:1px solid ${p.border};font-size:11px;font-family:monospace;color:${p.textSoft};">
              Mohammed Sufyan Portfolio · Automated owner alert · Matches visitor ${p.theme} theme
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function emitOwnerAlert(input: {
  eventType:
    | 'new_inquiry'
    | 'live_chat'
    | 'risk_download'
    | 'unusual_traffic'
    | 'chat_limit'
    | 'overdue_crm';
  title: string;
  detail: string;
  dedupeKey: string;
  /** Visitor site theme so the alert email matches their light/dark choice. */
  theme?: EmailTheme;
  /** Visitor accent pack (cyan / amber) for branded alert chrome. */
  accent?: EmailAccent;
}): Promise<void> {
  try {
    const prefs = prefsFromPortfolioSettings(runtimeOwnerPolicy);
    const theme = parseEmailTheme(input.theme);
    const accent = parseEmailAccent(input.accent);
    await routeOwnerNotification({
      prefs,
      eventType: input.eventType,
      title: input.title,
      detail: input.detail,
      dedupeKey: input.dedupeKey,
      sendImmediate: async ({ subject, title, detail, alertClass }) => {
        bumpMetric('alertsDispatched');
        if (alertClass === 'urgent' || alertClass === 'warning') {
          void postSlackAlert({ title, detail, alertClass });
        }
        if (!isDirectEmailTransportConfigured()) return;
        const timestamp = new Date().toUTCString();
        const html = buildOwnerAlertEmailHtml({
          alertClass,
          title,
          detail,
          theme,
          accent,
          timestamp,
        });
        const text = [
          `${alertClass.toUpperCase()} — ${title}`,
          '==============================',
          detail,
          '',
          `Theme: ${theme} · Accent: ${accent}`,
          'Open Owner Console → Alerts / Chat / Messages',
          cleanSecretEnv(process.env.APP_URL) || 'https://www.mohammedsufyan.com',
        ].join('\n');
        await dispatchEmailMessage({
          to: DESTINATION_EMAIL,
          fromDisplayName: 'Portfolio Alerts',
          subjectLine: subject,
          html,
          text,
        });
      },
    });
  } catch (err) {
    structuredLog('warn', 'owner_alert_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    void captureException(err, { source: 'emitOwnerAlert', dedupeKey: input.dedupeKey });
  }
}

let runtimeOwnerPolicy: RuntimeOwnerPolicy = loadInitialOwnerPolicy();

function saveRuntimeOwnerPolicy(next: RuntimeOwnerPolicy): void {
  runtimeOwnerPolicy = next;
  try {
    fs.writeFileSync(POLICY_CACHE_PATH, JSON.stringify(next, null, 2), 'utf8');
  } catch {
    /* non-fatal in read-only filesystem */
  }
  void saveDistributedOwnerPolicy(next);
}

async function enforceRateLimit(
  res: Response,
  namespace: RateLimitNamespace,
  key: string,
  options: { maxRequests?: number; error: string }
): Promise<boolean> {
  const result = await checkDistributedRateLimit(namespace, key, {
    maxRequests: options.maxRequests,
  });
  if (!result.limited) return false;
  res.setHeader('Retry-After', String(result.retryAfterSeconds));
  res.status(429).json({ error: options.error });
  return true;
}

async function tryPersistCvTracking(
  summary: ReturnType<typeof buildTrackingSummaryForClient>
): Promise<boolean> {
  if (!isFirebaseAdminConfigured()) return false;
  return adminWriteCvDownload(summary.downloadId, { ...summary });
}

async function tryPersistContactSummary(summary: Record<string, unknown>): Promise<boolean> {
  if (!isFirebaseAdminConfigured()) return false;
  const messageId = typeof summary.messageId === 'string' ? summary.messageId : '';
  if (!messageId) return false;
  return adminWriteContactMessage(messageId, summary);
}

let cachedFirebaseCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedFirebaseCerts && cachedFirebaseCerts.expiresAt > now) {
    return cachedFirebaseCerts.certs;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) {
    throw new Error('Unable to fetch Firebase verification certificates.');
  }
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const ttlMs = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) * 1000 : 3600 * 1000;
  const certs = (await res.json()) as Record<string, string>;
  cachedFirebaseCerts = { certs, expiresAt: now + ttlMs };
  return certs;
}

function readFirebaseDatabaseId(): string {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as { firestoreDatabaseId?: string };
    return parsed.firestoreDatabaseId || '(default)';
  } catch {
    return '(default)';
  }
}

const FIRESTORE_DATABASE_ID = readFirebaseDatabaseId();

async function verifyFirebaseIdTokenPayload(
  authHeader: string | undefined
): Promise<
  | { ok: true; email: string; uid: string; emailVerified: boolean; rawToken: string }
  | { ok: false; error: string }
> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, error: 'Missing owner authorization token.' };
  }
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: 'Malformed authorization token.' };
  }

  try {
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      aud?: string;
      iss?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      email?: string;
      email_verified?: boolean;
    };

    if (header.alg !== 'RS256' || !header.kid) {
      return { ok: false, error: 'Unsupported token signature algorithm.' };
    }

    const certs = await getFirebasePublicCerts();
    const cert = certs[header.kid];
    if (!cert) {
      return { ok: false, error: 'Unknown signing key identifier.' };
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const sigBuf = Buffer.from(sigB64, 'base64url');
    if (!verifier.verify(cert, sigBuf)) {
      return { ok: false, error: 'Invalid token signature.' };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (
      payload.aud !== FIREBASE_PROJECT_ID ||
      payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
      !payload.sub ||
      typeof payload.exp !== 'number' ||
      payload.exp <= nowSec
    ) {
      return { ok: false, error: 'Token expired or audience mismatch.' };
    }

    if (!payload.email || payload.email_verified !== true) {
      return { ok: false, error: 'Verified email claim required.' };
    }

    return {
      ok: true,
      email: payload.email,
      uid: payload.sub,
      emailVerified: true,
      rawToken: token,
    };
  } catch {
    return { ok: false, error: 'Failed to verify owner authorization token.' };
  }
}

async function verifyOwnerFirebaseIdToken(
  authHeader: string | undefined
): Promise<{ ok: true; email: string; uid: string } | { ok: false; error: string }> {
  const verified = await verifyFirebaseIdTokenPayload(authHeader);
  if (!verified.ok) return verified;
  if (verified.email.toLowerCase() !== DESTINATION_EMAIL.toLowerCase()) {
    return { ok: false, error: 'Restricted to verified portfolio owner.' };
  }
  return { ok: true, email: verified.email, uid: verified.uid };
}

/** Primary owner or Firestore-confirmed delegate admin. */
async function verifyConsoleActorToken(
  authHeader: string | undefined
): Promise<{ ok: true; email: string; uid: string; role: 'owner' | 'delegate' } | { ok: false; error: string }> {
  const verified = await verifyFirebaseIdTokenPayload(authHeader);
  if (!verified.ok) return verified;

  if (verified.email.toLowerCase() === DESTINATION_EMAIL.toLowerCase()) {
    return { ok: true, email: verified.email, uid: verified.uid, role: 'owner' };
  }

  try {
    const dbPath = encodeURIComponent(FIRESTORE_DATABASE_ID);
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${dbPath}/documents/admins/${encodeURIComponent(verified.uid)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${verified.rawToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, error: 'Restricted to verified portfolio owner or delegate admin.' };
    }
    return { ok: true, email: verified.email, uid: verified.uid, role: 'delegate' };
  } catch {
    return { ok: false, error: 'Unable to verify console actor privileges.' };
  }
}

interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  theme?: EmailTheme;
  accent?: EmailAccent;
  messageId?: string;
  telemetryNote?: string;
}

function buildPortfolioEmailHtml(payload: ContactPayload, timestamp: string): string {
  const p = getEmailPalette(parseEmailTheme(payload.theme), parseEmailAccent(payload.accent));
  const safeName = escapeHtml(payload.name);
  const safeEmail = escapeHtml(payload.email);
  const safePhone = payload.phone ? escapeHtml(payload.phone) : 'Not provided';
  const safeSubject = payload.subject ? escapeHtml(payload.subject) : 'Portfolio Architecture Inquiry';
  const safeMessage = escapeHtml(payload.message).replace(/\r?\n/g, '<br />');
  const safeTime = escapeHtml(timestamp);
  const safeTelemetryNote = payload.telemetryNote ? escapeHtml(payload.telemetryNote) : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="${p.theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="${p.theme}" />
  <meta name="supported-color-schemes" content="${p.theme}" />
  <title>Portfolio Inquiry — ${safeName}</title>
</head>
<body style="margin:0;padding:0;background-color:${p.pageBg};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${p.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${p.pageBg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background-color:${p.cardBg};border:1px solid ${p.border};border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 28px;background-color:${p.headerBg};border-bottom:1px solid ${p.border};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width:38px;height:38px;border-radius:10px;background-color:${p.accentSoftBg};border:1px solid ${p.accentDeep};text-align:center;vertical-align:middle;font-weight:700;font-size:14px;color:${p.accent};font-family:monospace;">
                          MS
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:15px;font-weight:700;color:${p.textStrong};letter-spacing:0.02em;">
                            MOHAMMED SUFYAN
                          </div>
                          <div style="font-size:11px;font-family:monospace;color:${p.accent};text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">
                            Portfolio Inbound Transmission
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:5px 10px;border-radius:6px;background-color:${p.accentSoftBg};border:1px solid ${p.accentSoftBorder};color:${p.accent};font-size:10px;font-family:monospace;font-weight:700;letter-spacing:0.08em;">
                      P1 ROUTING
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Intro Banner -->
          <tr>
            <td style="padding:24px 28px 16px 28px;">
              <div style="font-size:11px;font-family:monospace;color:${p.accent};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
                NEW MESSAGE RECEIVED
              </div>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:${p.textStrong};line-height:1.3;">
                ${safeSubject}
              </h1>
              <p style="margin:8px 0 0 0;font-size:12px;font-family:monospace;color:${p.textMuted};">
                Received ${safeTime} · Theme ${p.theme}
              </p>
            </td>
          </tr>

          <!-- Sender Details Card -->
          <tr>
            <td style="padding:8px 28px 16px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${p.panelBg};border:1px solid ${p.border};border-radius:12px;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid ${p.border};width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;letter-spacing:0.08em;">
                      Sender Name
                    </div>
                    <div style="font-size:14px;font-weight:600;color:${p.textStrong};margin-top:4px;">
                      ${safeName}
                    </div>
                  </td>
                  <td style="padding:14px 18px;border-bottom:1px solid ${p.border};border-left:1px solid ${p.border};width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;letter-spacing:0.08em;">
                      Sender Email
                    </div>
                    <div style="font-size:14px;font-weight:600;color:${p.accent};margin-top:4px;">
                      <a href="mailto:${safeEmail}" style="color:${p.accent};text-decoration:none;">${safeEmail}</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;letter-spacing:0.08em;">
                      Phone Number
                    </div>
                    <div style="font-size:13px;font-family:monospace;color:${p.text};margin-top:4px;">
                      ${safePhone}
                    </div>
                  </td>
                  <td style="padding:14px 18px;border-left:1px solid ${p.border};width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;letter-spacing:0.08em;">
                      Subject / Intent
                    </div>
                    <div style="font-size:13px;color:${p.text};margin-top:4px;">
                      ${safeSubject}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <div style="background-color:${p.panelBg};border:1px solid ${p.border};border-left:3px solid ${p.accent};border-radius:12px;padding:18px 20px;">
                <div style="font-size:10px;font-family:monospace;color:${p.accent};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">
                  Message Details
                </div>
                <div style="font-size:14px;line-height:1.65;color:${p.text};">
                  ${safeMessage}
                </div>
              </div>
            </td>
          </tr>

          <!-- Action CTA -->
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <a href="mailto:${encodeURIComponent(payload.email)}?subject=${encodeURIComponent(`Re: ${payload.subject || 'Portfolio Inquiry'}`)}" style="display:inline-block;padding:11px 20px;background-color:${p.ctaBg};color:${p.ctaText};font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">
                Reply to ${safeName}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px;background-color:${p.footerBg};border-top:1px solid ${p.border};font-size:11px;font-family:monospace;color:${p.textSoft};">
              ${safeTelemetryNote ? `<div style="margin-bottom:6px;color:${p.text};">${safeTelemetryNote}</div>` : ''}
              Dispatched from Mohammed Sufyan Portfolio · Zero Trust Distributed Systems · Multi-Cloud Architecture
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPlainTextEmail(payload: ContactPayload, timestamp: string): string {
  return [
    'MOHAMMED SUFYAN — PORTFOLIO INBOUND TRANSMISSION',
    '================================================',
    `Received: ${timestamp}`,
    ...(payload.messageId ? [`Ref ID:   ${payload.messageId}`] : []),
    `Theme:    ${parseEmailTheme(payload.theme)}`,
    `Accent:   ${parseEmailAccent(payload.accent)}`,
    `Name:     ${payload.name}`,
    `Email:    ${payload.email}`,
    `Phone:    ${payload.phone || 'Not provided'}`,
    `Subject:  ${payload.subject || 'Portfolio Architecture Inquiry'}`,
    ...(payload.telemetryNote ? [`Network:  ${payload.telemetryNote}`] : []),
    '',
    'Message Details:',
    '----------------',
    payload.message,
  ].join('\n');
}

function cleanSecretEnv(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim().replace(/^["']|["']$/g, '').trim();
  if (!trimmed || /^(MY_|YOUR_|REPLACE_|PLACEHOLDER)/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

interface CvAccessPayload {
  name?: string;
  email?: string;
  phone?: string;
  reason: string;
  action: 'pdf' | 'print' | 'ats' | 'install';
  formatLabel: string;
  theme?: EmailTheme;
  accent?: EmailAccent;
}

function formatCvActionLabel(action: CvAccessPayload['action']): string {
  if (action === 'print') return 'Browser Print';
  if (action === 'ats') return 'ATS Plain-Text Copy';
  if (action === 'install') return 'App Install';
  return 'PDF Download';
}

function formatVerificationLabel(status: VerificationStatus): string {
  if (status === 'otp_verified') return 'OTP VERIFIED EMAIL';
  if (status === 'mx_verified') return 'MX VERIFIED EMAIL';
  if (status === 'repeat_session') return 'VERIFIED SESSION EXPORT';
  return 'PHONE ONLY (UNVERIFIED EMAIL)';
}

function buildLocationDisplay(telemetry: VisitorTelemetryReport): string {
  const parts = [telemetry.ip.city, telemetry.ip.region, telemetry.ip.country].filter(
    (part) => Boolean(part) && part !== 'Unknown'
  );
  return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
}

function buildCvAccessEmailHtml(
  payload: CvAccessPayload,
  timestamp: string,
  telemetry: VisitorTelemetryReport,
  isSubsequent: boolean
): string {
  const p = getEmailPalette(parseEmailTheme(payload.theme), parseEmailAccent(payload.accent));
  const safeName = escapeHtml(payload.name?.trim() || 'Not provided');
  const safeEmail = payload.email?.trim() ? escapeHtml(payload.email.trim()) : '';
  const safePhone = payload.phone?.trim() ? escapeHtml(payload.phone.trim()) : 'Not provided';
  const safeFormat = escapeHtml(payload.formatLabel || 'Executive Summary');
  const safeAction = formatCvActionLabel(payload.action);
  const safeReason = escapeHtml(payload.reason).replace(/\r?\n/g, '<br />');
  const safeTime = escapeHtml(timestamp);
  const safeUa = escapeHtml(telemetry.userAgent.slice(0, 180) || 'Unknown client');

  const safeDownloadId = escapeHtml(telemetry.downloadId);
  const safeSessionId = escapeHtml(telemetry.sessionId);
  const safeVerifyLabel = escapeHtml(formatVerificationLabel(telemetry.verificationStatus));
  const safeIp = escapeHtml(telemetry.ip.ipAddress || 'Unknown');
  const safeLocation = escapeHtml(buildLocationDisplay(telemetry));
  const safeIsp = escapeHtml(
    telemetry.ip.asn ? `${telemetry.ip.isp} (${telemetry.ip.asn})` : telemetry.ip.isp
  );
  const safeIpTz = escapeHtml(telemetry.ip.timezone || 'Unknown');
  const safeClientTz = escapeHtml(telemetry.clientTimezone || 'Not reported');
  const safeReferrer = escapeHtml(telemetry.referrer || 'Direct / Portfolio');
  const safeDeviceContext = escapeHtml(
    [telemetry.clientLanguage || '', telemetry.clientScreen || ''].filter(Boolean).join(' · ') || 'Standard browser'
  );

  const riskBadgeText = telemetry.risk.isVpnSuspected
    ? `VPN / PROXY SUSPECTED (${telemetry.risk.riskLevel.toUpperCase()})`
    : `LOW RISK (${telemetry.risk.riskLevel.toUpperCase()})`;
  const riskColors = telemetry.risk.isVpnSuspected
    ? p.theme === 'light'
      ? { bg: '#fff1f2', border: '#fda4af', text: '#be123c' }
      : { bg: '#4c0519', border: '#f43f5e', text: '#fda4af' }
    : { bg: p.badgeSuccessBg, border: p.badgeSuccessBorder, text: p.badgeSuccessText };

  const riskReasonsText =
    telemetry.risk.riskReasons.length > 0
      ? escapeHtml(telemetry.risk.riskReasons.join(' · '))
      : 'No VPN, proxy, or timezone anomalies detected';

  return `<!DOCTYPE html>
<html lang="en" data-theme="${p.theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="${p.theme}" />
  <meta name="supported-color-schemes" content="${p.theme}" />
  <title>CV Export Alert — ${safeName}</title>
</head>
<body style="margin:0;padding:0;background-color:${p.pageBg};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${p.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${p.pageBg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background-color:${p.cardBg};border:1px solid ${p.border};border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 28px;background-color:${p.headerBg};border-bottom:1px solid ${p.border};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width:38px;height:38px;border-radius:10px;background-color:${p.accentSoftBg};border:1px solid ${p.accentDeep};text-align:center;vertical-align:middle;font-weight:700;font-size:14px;color:${p.accent};font-family:monospace;">
                          MS
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:15px;font-weight:700;color:${p.textStrong};letter-spacing:0.02em;">
                            MOHAMMED SUFYAN
                          </div>
                          <div style="font-size:11px;font-family:monospace;color:${p.accent};text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">
                            ${isSubsequent ? 'Subsequent CV Export Telemetry' : 'CV Export &amp; Verification Alert'}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:5px 10px;border-radius:6px;background-color:${p.badgeSuccessBg};border:1px solid ${p.badgeSuccessBorder};color:${p.badgeSuccessText};font-size:10px;font-family:monospace;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                      ${safeAction}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:24px 28px 16px 28px;">
              <div style="font-size:11px;font-family:monospace;color:${p.accent};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
                ${safeVerifyLabel} · REF ${safeDownloadId}
              </div>
              <h1 style="margin:0;font-size:21px;font-weight:700;color:${p.textStrong};line-height:1.3;">
                ${safeFormat} (${safeAction})
              </h1>
              <p style="margin:8px 0 0 0;font-size:12px;font-family:monospace;color:${p.textMuted};">
                Exported ${safeTime} · Session ${safeSessionId} · Theme ${p.theme}
              </p>
              <div style="margin-top:12px;">
                <span style="display:inline-block;padding:4px 10px;border-radius:6px;background-color:${riskColors.bg};border:1px solid ${riskColors.border};color:${riskColors.text};font-size:10px;font-family:monospace;font-weight:700;letter-spacing:0.06em;">
                  ${escapeHtml(riskBadgeText)}
                </span>
              </div>
            </td>
          </tr>

          <!-- Visitor Details Grid -->
          <tr>
            <td style="padding:8px 28px 16px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${p.panelBg};border:1px solid ${p.border};border-radius:12px;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid ${p.border};width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;letter-spacing:0.08em;">
                      Visitor Name
                    </div>
                    <div style="font-size:14px;font-weight:600;color:${p.textStrong};margin-top:4px;">
                      ${safeName}
                    </div>
                  </td>
                  <td style="padding:14px 18px;border-bottom:1px solid ${p.border};border-left:1px solid ${p.border};width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;letter-spacing:0.08em;">
                      Email ID
                    </div>
                    <div style="font-size:14px;font-weight:600;color:${p.accent};margin-top:4px;">
                      ${safeEmail ? `<a href="mailto:${safeEmail}" style="color:${p.accent};text-decoration:none;">${safeEmail}</a>` : `<span style="color:${p.textMuted};font-weight:400;">Not provided</span>`}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;letter-spacing:0.08em;">
                      Phone Number
                    </div>
                    <div style="font-size:13px;font-family:monospace;color:${p.text};margin-top:4px;">
                      ${safePhone}
                    </div>
                  </td>
                  <td style="padding:14px 18px;border-left:1px solid ${p.border};width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;letter-spacing:0.08em;">
                      Export Format
                    </div>
                    <div style="font-size:13px;color:${p.text};margin-top:4px;">
                      ${safeFormat}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Network, Geo & VPN Security Telemetry -->
          <tr>
            <td style="padding:0 28px 16px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${p.panelBg};border:1px solid ${p.border};border-radius:12px;">
                <tr>
                  <td colspan="2" style="padding:12px 18px;border-bottom:1px solid ${p.border};">
                    <div style="font-size:10px;font-family:monospace;color:${p.accent};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">
                      Network, Geo &amp; VPN Telemetry
                    </div>
                    <div style="font-size:12px;color:${p.textMuted};margin-top:4px;">
                      ${riskReasonsText}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid ${p.border};width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;">
                      IP Address
                    </div>
                    <div style="font-size:13px;font-family:monospace;color:${p.textStrong};margin-top:4px;">
                      ${safeIp}
                    </div>
                  </td>
                  <td style="padding:12px 18px;border-bottom:1px solid ${p.border};border-left:1px solid ${p.border};width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;">
                      Geo Location
                    </div>
                    <div style="font-size:13px;color:${p.textStrong};margin-top:4px;">
                      ${safeLocation}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;border-bottom:1px solid ${p.border};width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;">
                      ISP / ASN
                    </div>
                    <div style="font-size:12px;font-family:monospace;color:${p.text};margin-top:4px;">
                      ${safeIsp}
                    </div>
                  </td>
                  <td style="padding:12px 18px;border-bottom:1px solid ${p.border};border-left:1px solid ${p.border};width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;">
                      Timezone Check (IP vs Browser)
                    </div>
                    <div style="font-size:12px;font-family:monospace;color:${p.text};margin-top:4px;">
                      ${safeIpTz} vs ${safeClientTz}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;">
                      Referrer / Source
                    </div>
                    <div style="font-size:12px;font-family:monospace;color:${p.text};margin-top:4px;">
                      ${safeReferrer}
                    </div>
                  </td>
                  <td style="padding:12px 18px;border-left:1px solid ${p.border};width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;">
                      Locale &amp; Viewport
                    </div>
                    <div style="font-size:12px;font-family:monospace;color:${p.text};margin-top:4px;">
                      ${safeDeviceContext}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Reason / Purpose -->
          <tr>
            <td style="padding:8px 28px 20px 28px;">
              <div style="background-color:${p.panelBg};border:1px solid ${p.border};border-left:3px solid ${p.badgeSuccessBorder};border-radius:12px;padding:18px 20px;">
                <div style="font-size:10px;font-family:monospace;color:${p.accentAlt};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">
                  Stated Purpose for Downloading
                </div>
                <div style="font-size:14px;line-height:1.65;color:${p.text};">
                  ${safeReason}
                </div>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          ${safeEmail ? `
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <a href="mailto:${encodeURIComponent(payload.email?.trim() || '')}?subject=${encodeURIComponent('Following up on my CV / Portfolio')}" style="display:inline-block;padding:11px 20px;background-color:${p.ctaBg};color:${p.ctaText};font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">
                Connect with ${safeName === 'Not provided' ? safeEmail : safeName}
              </a>
            </td>
          </tr>` : ''}

          <!-- Client Metadata & Footer -->
          <tr>
            <td style="padding:14px 28px;background-color:${p.footerBg};border-top:1px solid ${p.border};font-size:11px;font-family:monospace;color:${p.textSoft};line-height:1.5;">
              <div>Client: ${safeUa}</div>
              <div style="margin-top:4px;">Mohammed Sufyan Portfolio · Hardened CV Access &amp; Audit Telemetry</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildCvAccessPlainText(
  payload: CvAccessPayload,
  timestamp: string,
  telemetry: VisitorTelemetryReport,
  isSubsequent: boolean
): string {
  return [
    `MOHAMMED SUFYAN — ${isSubsequent ? 'SUBSEQUENT CV EXPORT ALERT' : 'CV EXPORT & ACCESS ALERT'}`,
    '====================================================',
    `Download Ref: ${telemetry.downloadId}`,
    `Session ID:   ${telemetry.sessionId}`,
    `Verification: ${formatVerificationLabel(telemetry.verificationStatus)}`,
    `Exported:     ${timestamp}`,
    `Theme:        ${parseEmailTheme(payload.theme)}`,
    `Accent:       ${parseEmailAccent(payload.accent)}`,
    `Action:       ${formatCvActionLabel(payload.action)}`,
    `Format:       ${payload.formatLabel}`,
    `Name:         ${payload.name?.trim() || 'Not provided'}`,
    `Email:        ${payload.email?.trim() || 'Not provided'}`,
    `Phone:        ${payload.phone?.trim() || 'Not provided'}`,
    '',
    'Network, Geo & VPN Telemetry:',
    '-----------------------------',
    `IP Address:   ${telemetry.ip.ipAddress || 'Unknown'}`,
    `Location:     ${buildLocationDisplay(telemetry)}`,
    `ISP / ASN:    ${telemetry.ip.isp}${telemetry.ip.asn ? ` (${telemetry.ip.asn})` : ''}`,
    `VPN / Proxy:  ${telemetry.risk.isVpnSuspected ? 'SUSPECTED' : 'No'} (Risk: ${telemetry.risk.riskLevel.toUpperCase()})`,
    `Risk Signals: ${telemetry.risk.riskReasons.join(', ') || 'None'}`,
    `Timezones:    IP=${telemetry.ip.timezone || 'Unknown'} | Browser=${telemetry.clientTimezone || 'Unknown'}`,
    `Referrer:     ${telemetry.referrer || 'Direct / Portfolio'}`,
    '',
    'Reason for Downloading:',
    '-----------------------',
    payload.reason,
    '',
    `Client: ${telemetry.userAgent || 'Unknown'}`,
  ].join('\n');
}

function buildOtpEmailHtml(
  name: string,
  code: string,
  theme: EmailTheme,
  purpose: 'cv' | 'contact' | 'chat' = 'cv',
  accent: EmailAccent = 'cyan'
): string {
  const p = getEmailPalette(theme, accent);
  const safeName = escapeHtml(name || 'there');
  const safeCode = escapeHtml(code);
  const actionPhrase =
    purpose === 'contact'
      ? 'authenticate your email and transmit your message on <strong>mohammedsufyan.com</strong>'
      : purpose === 'chat'
        ? 'verify your email and start a live portfolio chat on <strong>mohammedsufyan.com</strong>'
        : 'unlock your CV download on <strong>mohammedsufyan.com</strong>';
  const headerLabel =
    purpose === 'contact'
      ? 'Contact Transmission Verification'
      : purpose === 'chat'
        ? 'Live Chat Verification'
        : 'Portfolio Access Verification';

  return `<!DOCTYPE html>
<html lang="en" data-theme="${p.theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Verification Code — Mohammed Sufyan Portfolio</title>
</head>
<body style="margin:0;padding:0;background-color:${p.pageBg};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${p.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${p.pageBg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:${p.cardBg};border:1px solid ${p.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:22px 26px;background-color:${p.headerBg};border-bottom:1px solid ${p.border};">
              <div style="font-size:15px;font-weight:700;color:${p.textStrong};">MOHAMMED SUFYAN</div>
              <div style="font-size:11px;font-family:monospace;color:${p.accent};text-transform:uppercase;margin-top:2px;">
                ${headerLabel}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px;">
              <p style="margin:0 0 14px 0;font-size:14px;color:${p.text};line-height:1.6;">
                Hi ${safeName}, please enter the 6-digit verification code below to ${actionPhrase}:
              </p>
              <div style="margin:20px 0;padding:18px;border-radius:12px;background-color:${p.panelBg};border:1px solid ${p.accentSoftBorder};text-align:center;">
                <span style="font-size:32px;font-weight:700;font-family:monospace;letter-spacing:0.25em;color:${p.accent};">
                  ${safeCode}
                </span>
              </div>
              <p style="margin:0;font-size:12px;color:${p.textMuted};line-height:1.5;">
                This code expires in 10 minutes. If you did not request this verification, you can safely ignore this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface DispatchEmailParams {
  to?: string;
  fromDisplayName: string;
  replyTo?: string;
  subjectLine: string;
  html: string;
  text: string;
  fallbackFields?: Record<string, string>;
}

function isDirectEmailTransportConfigured(): boolean {
  const resendKey = cleanSecretEnv(process.env.RESEND_API_KEY);
  const gmailPass = cleanSecretEnv(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '');
  const smtpHost = cleanSecretEnv(process.env.SMTP_HOST);
  const smtpUser = cleanSecretEnv(process.env.SMTP_USER);
  const smtpPass = cleanSecretEnv(process.env.SMTP_PASS);
  return Boolean(resendKey || gmailPass || (smtpHost && smtpUser && smtpPass));
}

async function dispatchEmailMessage(params: DispatchEmailParams): Promise<{ provider: string }> {
  const { to, fromDisplayName, replyTo, subjectLine, html, text, fallbackFields } = params;
  const recipient = to?.trim() || DESTINATION_EMAIL;
  const isCustomRecipient = recipient.toLowerCase() !== DESTINATION_EMAIL.toLowerCase();
  const transportErrors: string[] = [];

  // 1. Resend API (primary when RESEND_API_KEY is configured)
  const resendApiKey = cleanSecretEnv(process.env.RESEND_API_KEY);
  if (resendApiKey) {
    try {
      const fromEmail = cleanSecretEnv(process.env.RESEND_FROM_EMAIL) || 'Portfolio Dispatch <onboarding@resend.dev>';
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipient],
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject: subjectLine,
          html,
          text,
        }),
      });

      if (resendResponse.ok) {
        return { provider: 'resend' };
      }

      const errText = await resendResponse.text();
      let detail = errText;
      try {
        const parsed = JSON.parse(errText) as { message?: string };
        if (parsed.message) detail = parsed.message;
      } catch {
        // keep raw text
      }
      transportErrors.push(`Resend (${resendResponse.status}): ${detail}`);
      console.warn(`Resend transport failed (${resendResponse.status}), trying fallback:`, detail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      transportErrors.push(`Resend: ${msg}`);
      console.warn('Resend transport threw error, trying fallback:', msg);
    }
  }

  // 2. Gmail SMTP via Nodemailer
  const gmailPass = cleanSecretEnv(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '');
  const gmailUser = cleanSecretEnv(process.env.GMAIL_USER) || DESTINATION_EMAIL;

  if (gmailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        connectionTimeout: 10000,
        socketTimeout: 15000,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      await transporter.sendMail({
        from: `"${fromDisplayName}" <${gmailUser}>`,
        to: recipient,
        ...(replyTo ? { replyTo } : {}),
        subject: subjectLine,
        text,
        html,
      });

      return { provider: 'gmail-smtp' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SMTP error';
      transportErrors.push(`Gmail SMTP: ${msg}`);
      console.warn('Gmail SMTP failed, trying fallback:', msg);
    }
  }

  // 3. Custom SMTP via Nodemailer
  const smtpHost = cleanSecretEnv(process.env.SMTP_HOST);
  const smtpUser = cleanSecretEnv(process.env.SMTP_USER);
  const smtpPass = cleanSecretEnv(process.env.SMTP_PASS);

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const port = Number(cleanSecretEnv(process.env.SMTP_PORT)) || 587;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure: port === 465,
        connectionTimeout: 10000,
        socketTimeout: 15000,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"${fromDisplayName}" <${smtpUser}>`,
        to: recipient,
        ...(replyTo ? { replyTo } : {}),
        subject: subjectLine,
        text,
        html,
      });

      return { provider: 'smtp' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Custom SMTP error';
      transportErrors.push(`Custom SMTP: ${msg}`);
      console.warn('Custom SMTP failed, trying fallback:', msg);
    }
  }

  // 4. FormSubmit relay — only for owner alerts (never relay visitor OTPs through FormSubmit)
  if (!isCustomRecipient && fallbackFields && isFormSubmitFallbackAllowed()) {
    const appUrl = cleanSecretEnv(process.env.APP_URL) || `http://localhost:${PORT}`;
    try {
      const formSubmitRes = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(DESTINATION_EMAIL)}`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Referer: appUrl,
          Origin: appUrl,
        },
        body: JSON.stringify({
          ...fallbackFields,
          _subject: subjectLine,
          ...(replyTo ? { _replyto: replyTo } : {}),
          _template: 'box',
        }),
      });

      if (formSubmitRes.ok) {
        const result = (await formSubmitRes.json().catch(() => ({}))) as {
          success?: string | boolean;
          message?: string;
        };
        if (result.success === 'true' || result.success === true) {
          return { provider: 'formsubmit' };
        }
        if (result.message) {
          transportErrors.push(`FormSubmit: ${result.message}`);
        }
      } else {
        transportErrors.push(`FormSubmit (${formSubmitRes.status})`);
      }
    } catch (fallbackErr) {
      const msg = fallbackErr instanceof Error ? fallbackErr.message : 'Network error';
      transportErrors.push(`FormSubmit: ${msg}`);
    }
  } else if (!isCustomRecipient) {
    transportErrors.push('FormSubmit fallback disabled (set ALLOW_FORMSUBMIT_FALLBACK=true to enable)');
  }

  if (transportErrors.length > 0) {
    throw new Error(
      `Direct email delivery could not be completed (${transportErrors[0]}). Please verify your RESEND_API_KEY or GMAIL_APP_PASSWORD in Secrets.`
    );
  }

  throw new Error(
    'Email transport is not configured yet. Add GMAIL_APP_PASSWORD or a valid RESEND_API_KEY in Secrets to send styled portfolio emails directly.'
  );
}

async function sendContactEmail(payload: ContactPayload): Promise<{ provider: string }> {
  const timestamp = new Date().toUTCString();
  const safeHeaderName = sanitizeDisplayName(payload.name) || 'Portfolio Visitor';
  const safeHeaderSubject = payload.subject ? sanitizeHeaderValue(payload.subject) : '';
  const safeHeaderEmail = sanitizeHeaderValue(payload.email);
  const alertTag = runtimeOwnerPolicy.notifyOnNewInquiry ? '[ALERT] ' : '';
  const subjectLine = safeHeaderSubject
    ? `${alertTag}[Portfolio Inquiry] ${safeHeaderSubject} — ${safeHeaderName}`
    : `${alertTag}[Portfolio Inquiry] New message from ${safeHeaderName}`;
  const html = buildPortfolioEmailHtml(payload, timestamp);
  const text = buildPlainTextEmail(payload, timestamp);

  return dispatchEmailMessage({
    fromDisplayName: `Portfolio Inquiry — ${safeHeaderName}`,
    replyTo: safeHeaderEmail,
    subjectLine,
    html,
    text,
    fallbackFields: {
      name: payload.name,
      email: safeHeaderEmail,
      phone: payload.phone || 'Not provided',
      subject: safeHeaderSubject || 'Portfolio Architecture Inquiry',
      message: payload.message,
    },
  });
}

function buildOwnerReplyEmailHtml(params: {
  toName: string;
  body: string;
  originalSubject?: string;
  theme?: EmailTheme;
  accent?: EmailAccent;
  timestamp?: string;
}): string {
  const p = getEmailPalette(
    parseEmailTheme(params.theme ?? 'light'),
    parseEmailAccent(params.accent)
  );
  const safeName = escapeHtml(sanitizeDisplayName(params.toName) || 'there');
  const safeBody = escapeHtml(params.body).replace(/\r?\n/g, '<br />');
  const safeTime = escapeHtml(params.timestamp || new Date().toUTCString());
  const siteUrl = (cleanSecretEnv(process.env.APP_URL) || 'https://www.mohammedsufyan.com').replace(
    /\/$/,
    ''
  );
  const safeSiteUrl = escapeHtml(siteUrl);
  const originalBlock = params.originalSubject
    ? `<div style="margin-top:16px;padding-top:14px;border-top:1px solid ${p.border};">
        <div style="font-size:10px;font-family:monospace;color:${p.textSoft};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">
          In reply to
        </div>
        <div style="font-size:13px;color:${p.textMuted};line-height:1.5;">
          ${escapeHtml(params.originalSubject)}
        </div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="${p.theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="${p.theme}" />
  <meta name="supported-color-schemes" content="${p.theme}" />
  <title>Reply from Mohammed Sufyan</title>
</head>
<body style="margin:0;padding:0;background-color:${p.pageBg};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${p.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${p.pageBg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background-color:${p.cardBg};border:1px solid ${p.border};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background-color:${p.headerBg};border-bottom:1px solid ${p.border};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width:38px;height:38px;border-radius:10px;background-color:${p.accentSoftBg};border:1px solid ${p.accentDeep};text-align:center;vertical-align:middle;font-weight:700;font-size:14px;color:${p.accent};font-family:monospace;">
                          MS
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:15px;font-weight:700;color:${p.textStrong};letter-spacing:0.02em;">
                            MOHAMMED SUFYAN
                          </div>
                          <div style="font-size:11px;font-family:monospace;color:${p.accent};text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">
                            Portfolio Owner Reply
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:5px 10px;border-radius:6px;background-color:${p.badgeSuccessBg};border:1px solid ${p.badgeSuccessBorder};color:${p.badgeSuccessText};font-size:10px;font-family:monospace;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                      REPLY
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 12px 28px;">
              <div style="font-size:11px;font-family:monospace;color:${p.accent};text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
                Direct reply
              </div>
              <h1 style="margin:0;font-size:20px;font-weight:700;color:${p.textStrong};line-height:1.3;">
                Hi ${safeName},
              </h1>
              <p style="margin:8px 0 0 0;font-size:12px;font-family:monospace;color:${p.textMuted};">
                Sent ${safeTime}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;">
              <div style="background-color:${p.panelBg};border:1px solid ${p.border};border-left:3px solid ${p.accent};border-radius:12px;padding:18px 20px;">
                <div style="font-size:14px;line-height:1.65;color:${p.text};">
                  ${safeBody}
                </div>
                ${originalBlock}
              </div>
              <p style="margin:20px 0 0 0;font-size:13px;color:${p.textMuted};line-height:1.5;">
                — Mohammed Sufyan<br />
                <a href="${safeSiteUrl}" style="color:${p.accent};text-decoration:none;">${safeSiteUrl.replace(/^https?:\/\//, '')}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background-color:${p.footerBg};border-top:1px solid ${p.border};font-size:11px;font-family:monospace;color:${p.textSoft};">
              Mohammed Sufyan Portfolio · Owner reply from the console · You can reply to this email directly
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendOwnerReplyEmail(params: {
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  originalSubject?: string;
  theme?: EmailTheme;
  accent?: EmailAccent;
}): Promise<{ provider: string }> {
  const safeName = sanitizeDisplayName(params.toName) || 'there';
  const safeSubject = sanitizeHeaderValue(params.subject).slice(0, 200);
  const timestamp = new Date().toUTCString();
  const replyTheme = parseEmailTheme(params.theme ?? 'light');
  const replyAccent = parseEmailAccent(params.accent);
  const html = buildOwnerReplyEmailHtml({
    toName: safeName,
    body: params.body,
    originalSubject: params.originalSubject,
    theme: replyTheme,
    accent: replyAccent,
    timestamp,
  });
  const text = [
    `Hi ${safeName},`,
    '',
    params.body.trim(),
    '',
    params.originalSubject ? `In reply to: ${params.originalSubject}` : '',
    '',
    '— Mohammed Sufyan',
    cleanSecretEnv(process.env.APP_URL) || 'https://www.mohammedsufyan.com',
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n')
    .trim();

  const ownerReplyTo =
    cleanSecretEnv(process.env.CONTACT_TO_EMAIL) ||
    cleanSecretEnv(process.env.GMAIL_USER) ||
    undefined;

  structuredLog('info', 'owner_reply_email_built', {
    htmlBytes: html.length,
    branded: html.includes('Portfolio Owner Reply'),
    theme: replyTheme,
    accent: replyAccent,
  });

  return dispatchEmailMessage({
    to: params.toEmail,
    fromDisplayName: 'Mohammed Sufyan',
    replyTo: ownerReplyTo,
    subjectLine: safeSubject,
    html,
    text,
  });
}

async function sendVisitorOtpEmail(params: {
  email: string;
  name: string;
  code: string;
  theme: EmailTheme;
  accent?: EmailAccent;
  purpose?: 'cv' | 'contact' | 'chat';
}): Promise<{ provider: string }> {
  const purpose = params.purpose ?? 'cv';
  const html = buildOtpEmailHtml(
    params.name,
    params.code,
    params.theme,
    purpose,
    parseEmailAccent(params.accent)
  );
  const purposeLabel =
    purpose === 'contact' ? 'Transmit Message' : purpose === 'chat' ? 'Live Chat' : 'CV Access';
  const text = `Hi ${params.name || 'there'},\n\nYour verification code for mohammedsufyan.com (${purposeLabel}) is: ${params.code}\n\nThis code expires in 10 minutes.`;
  return dispatchEmailMessage({
    to: params.email,
    fromDisplayName: 'Mohammed Sufyan Portfolio',
    subjectLine:
      purpose === 'contact'
        ? `${params.code} — Verification Code to Send Your Message`
        : purpose === 'chat'
          ? `${params.code} — Verification Code for Live Portfolio Chat`
          : `${params.code} — Verification Code for Mohammed Sufyan's CV`,
    html,
    text,
  });
}

async function sendCvAccessEmail(
  payload: CvAccessPayload,
  telemetry: VisitorTelemetryReport,
  isSubsequent = false
): Promise<{ provider: string }> {
  const timestamp = new Date().toUTCString();
  const safeHeaderName = sanitizeDisplayName(payload.name || '') || sanitizeHeaderValue(payload.email || payload.phone || 'Visitor');
  const safeHeaderEmail = payload.email ? sanitizeHeaderValue(payload.email) : undefined;
  const actionLabel = formatCvActionLabel(payload.action);
  const subjectPrefix = payload.action === 'install' ? 'App' : 'CV';
  const vpnTag = telemetry.risk.isVpnSuspected ? ' [VPN/PROXY]' : '';
  const repeatTag = isSubsequent ? 'Repeat ' : '';
  const subjectLine = `[${subjectPrefix} ${repeatTag}${actionLabel}]${vpnTag} ${safeHeaderName} (${telemetry.ip.country || 'Unknown'}) — ${sanitizeHeaderValue(payload.formatLabel)}`;
  const html = buildCvAccessEmailHtml(payload, timestamp, telemetry, isSubsequent);
  const text = buildCvAccessPlainText(payload, timestamp, telemetry, isSubsequent);

  return dispatchEmailMessage({
    fromDisplayName:
      payload.action === 'install'
        ? `App Install Alert — ${safeHeaderName}`
        : `CV Export Alert — ${safeHeaderName}`,
    replyTo: safeHeaderEmail,
    subjectLine,
    html,
    text,
    fallbackFields: {
      downloadId: telemetry.downloadId,
      name: payload.name || 'Not provided',
      email: safeHeaderEmail || 'Not provided',
      phone: payload.phone || 'Not provided',
      action: `${actionLabel} (${payload.formatLabel})`,
      verificationStatus: telemetry.verificationStatus,
      ipAddress: telemetry.ip.ipAddress,
      location: buildLocationDisplay(telemetry),
      isp: telemetry.ip.isp,
      vpnSuspected: String(telemetry.risk.isVpnSuspected),
      riskLevel: telemetry.risk.riskLevel,
      reason: payload.reason,
    },
  });
}

function buildTrackingSummaryForClient(
  payload: CvAccessPayload,
  telemetry: VisitorTelemetryReport,
  isSubsequent: boolean
) {
  return {
    downloadId: telemetry.downloadId,
    sessionId: telemetry.sessionId,
    visitorName: payload.name || '',
    visitorEmail: payload.email || '',
    visitorPhone: payload.phone || '',
    reason: payload.reason.slice(0, 500),
    action: payload.action,
    formatLabel: payload.formatLabel.slice(0, 80),
    theme: parseEmailTheme(payload.theme),
    accent: parseEmailAccent(payload.accent),
    verificationStatus: telemetry.verificationStatus,
    ipAddress: telemetry.ip.ipAddress.slice(0, 64),
    country: (telemetry.ip.country || 'Unknown').slice(0, 80),
    region: (telemetry.ip.region || '').slice(0, 80),
    city: (telemetry.ip.city || '').slice(0, 80),
    isp: (telemetry.ip.isp || '').slice(0, 120),
    asn: (telemetry.ip.asn || '').slice(0, 64),
    timezone: (telemetry.ip.timezone || '').slice(0, 64),
    clientTimezone: telemetry.clientTimezone.slice(0, 64),
    isVpnSuspected: telemetry.risk.isVpnSuspected,
    isProxy: telemetry.ip.isProxy,
    isHosting: telemetry.ip.isHosting,
    timezoneMismatch: telemetry.risk.timezoneMismatch,
    riskLevel: telemetry.risk.riskLevel,
    riskReasons: telemetry.risk.riskReasons.join(', ').slice(0, 240),
    referrer: telemetry.referrer.slice(0, 200),
    userAgent: telemetry.userAgent.slice(0, 220),
    isSubsequent,
  };
}

async function startServer() {
  runtimeOwnerPolicy = await loadDistributedOwnerPolicy(runtimeOwnerPolicy);

  if (isPortfolioVectorConfigured()) {
    void syncPortfolioVectors().then((result) => {
      if (result.ok) {
        console.log(`Portfolio vector index synced (${result.count} chunks).`);
      } else {
        console.warn(`Portfolio vector sync skipped/failed: ${result.error || 'unknown'}`);
      }
    });
  }

  const app = express();
  app.disable('x-powered-by');
  // Only trust X-Forwarded-* when explicitly enabled or in production behind a reverse proxy
  const trustProxyEnv = process.env.TRUST_PROXY;
  if (trustProxyEnv !== undefined) {
    if (trustProxyEnv === '0' || trustProxyEnv === 'false') {
      app.set('trust proxy', false);
    } else if (trustProxyEnv === '1' || trustProxyEnv === 'true') {
      app.set('trust proxy', 1);
    } else {
      const hops = Number(trustProxyEnv);
      app.set('trust proxy', Number.isFinite(hops) ? hops : false);
    }
  } else if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(requestContextMiddleware);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const isDev = process.env.NODE_ENV !== 'production';
    const requestHost =
      (typeof req.headers['x-forwarded-host'] === 'string' && req.headers['x-forwarded-host']) ||
      (typeof req.headers.host === 'string' && req.headers.host) ||
      undefined;
    const allowPreviewIframe = shouldAllowPreviewIframe({ isDev, host: requestHost });
    applySecurityHeaders((name, value) => res.setHeader(name, value), {
      isDev,
      isHttps: Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https'),
      allowPreviewIframe,
    });

    const userAgent =
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;
    const isSensitivePost =
      req.method === 'POST' &&
      (req.path.startsWith('/api/contact') ||
        req.path.startsWith('/api/cv-') ||
        req.path.startsWith('/api/chat'));

    if (isBlockedBotUserAgent(userAgent, isSensitivePost)) {
      res.status(403).json({
        error: 'Automated crawler or script access is not permitted.',
      });
      return;
    }

    if (req.path.startsWith('/api/')) {
      res.setHeader(
        'X-Robots-Tag',
        req.path === '/api/og-card.svg' ? 'noarchive' : 'noindex, nofollow, noarchive'
      );
    }

    next();
  });

  app.use(express.json({ limit: '256kb' }));

  function rejectDisallowedOrigin(req: Request, res: Response): boolean {
    if (isDisallowedFetchSite(req.headers['sec-fetch-site'])) {
      res.status(403).json({ error: 'Cross-site requests are not allowed.' });
      return true;
    }

    const originHeader =
      (typeof req.headers.origin === 'string' && req.headers.origin) ||
      (typeof req.headers.referer === 'string' && req.headers.referer) ||
      undefined;
    const requestHost =
      (typeof req.headers['x-forwarded-host'] === 'string' && req.headers['x-forwarded-host'].split(',')[0].trim()) ||
      (typeof req.headers.host === 'string' && req.headers.host.split(',')[0].trim()) ||
      undefined;
    const dynamicAllowed =
      requestHost && isAiStudioPreviewHost(requestHost)
        ? [...ALLOWED_ORIGINS, `https://${requestHost}`, `http://${requestHost}`]
        : ALLOWED_ORIGINS;
    if (!isAllowedRequestOrigin(originHeader, dynamicAllowed)) {
      res.status(403).json({ error: 'Request origin is not allowed.' });
      return true;
    }
    return false;
  }

  async function rejectFailedTurnstile(req: Request, res: Response, body: { turnstileToken?: unknown }): Promise<boolean> {
    const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : undefined;
    const result = await verifyTurnstileToken(token, TURNSTILE_SECRET || undefined, req.ip);
    if (!result.ok) {
      res.status(400).json({ error: result.error || 'Bot verification failed.' });
      return true;
    }
    return false;
  }

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON request payload.' });
      return;
    }
    void captureException(err, { requestId: req.requestId, path: req.path });
    next(err);
  });

  app.get('/api/health', (req: Request, res: Response) => {
    const gold = evaluateGoldPathHardening();
    const botProtection = evaluateBotProtection({
      cloudflareEdge: isCloudflareEdgeProxied({
        'cf-ray': req.headers['cf-ray'],
        'cf-connecting-ip': req.headers['cf-connecting-ip'],
      }),
    });
    const strict =
      (process.env.STRICT_PROD_HARDENING || '').toLowerCase() === 'true' &&
      process.env.NODE_ENV === 'production';
    const degraded = strict && !gold.productionReady;
    res.status(degraded ? 503 : 200).json({
      ok: !degraded,
      status: degraded ? 'degraded' : 'healthy',
      version: APP_VERSION,
      versionLabel: APP_VERSION_LABEL,
      timestamp: new Date().toISOString(),
      emailTransportConfigured: isDirectEmailTransportConfigured(),
      turnstileConfigured: Boolean(TURNSTILE_SECRET && TURNSTILE_SITE_KEY),
      sessionSecretConfigured: Boolean(process.env.SESSION_SECRET?.trim()),
      incidentMode: runtimeOwnerPolicy.incidentMode,
      distributedStore: isDistributedStoreEnabled() ? 'redis' : 'memory',
      serverTelemetryWrites: isFirebaseAdminConfigured(),
      observability: {
        sentry: Boolean((process.env.SENTRY_DSN || '').trim()),
        slack: Boolean((process.env.SLACK_ALERT_WEBHOOK_URL || '').trim()),
      },
      botProtection,
      goldPath: {
        score: gold.score,
        max: gold.max,
        productionReady: gold.productionReady,
        items: gold.items,
      },
    });
  });

  /** Public boolean status for the Security Architecture page (no secrets). */
  app.get('/api/status', (req: Request, res: Response) => {
    const gold = evaluateGoldPathHardening();
    const cloudflareEdge = isCloudflareEdgeProxied({
      'cf-ray': req.headers['cf-ray'],
      'cf-connecting-ip': req.headers['cf-connecting-ip'],
    });
    const botProtection = evaluateBotProtection({ cloudflareEdge });
    res.status(200).json({
      ok: true,
      version: APP_VERSION,
      versionLabel: APP_VERSION_LABEL,
      timestamp: new Date().toISOString(),
      controls: {
        turnstile: Boolean(TURNSTILE_SECRET && TURNSTILE_SITE_KEY),
        redis: isDistributedStoreEnabled(),
        adminWrites: isFirebaseAdminConfigured(),
        mail: isDirectEmailTransportConfigured(),
        incidentMode: runtimeOwnerPolicy.incidentMode,
        sentry: Boolean((process.env.SENTRY_DSN || '').trim()),
        slackAlerts: Boolean((process.env.SLACK_ALERT_WEBHOOK_URL || '').trim()),
        sessionSecret: Boolean(process.env.SESSION_SECRET?.trim()),
        appCheck: Boolean(
          (process.env.VITE_RECAPTCHA_SITE_KEY || '').trim() ||
            (process.env.RECAPTCHA_SITE_KEY || '').trim()
        ),
        piiClientCreatesDenied: true,
        cspReporting: true,
        cspStrictStyles: isCspStrictStylesEnabled(),
        httpsIpIntel: true,
        cloudflareEdge,
        uaBlocklist: true,
        honeypot: true,
      },
      botProtection,
      goldPathScore: `${gold.score}/${gold.max}`,
    });
  });

  /** Lightweight probe for external uptime monitors (Better Stack / UptimeRobot / Cloud Monitoring). */
  app.get('/api/uptime', (_req: Request, res: Response) => {
    const gold = evaluateGoldPathHardening();
    const strict =
      (process.env.STRICT_PROD_HARDENING || '').toLowerCase() === 'true' &&
      process.env.NODE_ENV === 'production';
    const ready = !strict || gold.productionReady;
    res.status(ready ? 200 : 503).json({
      ok: ready,
      service: 'sufyan-portfolio',
      ts: Date.now(),
      redis: isDistributedStoreEnabled(),
      mail: isDirectEmailTransportConfigured(),
    });
  });

  app.post(
    '/api/csp-report',
    express.json({
      type: ['application/csp-report', 'application/reports+json', 'application/json'],
      limit: '16kb',
    }),
    (req: Request, res: Response) => {
      const report = req.body;
      structuredLog('warn', 'csp_violation', {
        requestId: req.requestId,
        report: typeof report === 'object' ? report : String(report).slice(0, 500),
      });
      res.status(204).end();
    }
  );

  app.get('/.well-known/security.txt', (_req: Request, res: Response) => {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    const body = [
      'Contact: mailto:sufyan.net@gmail.com',
      'Expires: ' + expires.toISOString(),
      'Preferred-Languages: en',
      'Canonical: https://www.mohammedsufyan.com/.well-known/security.txt',
      'Policy: https://www.mohammedsufyan.com/#security',
    ].join('\n');
    res.type('text/plain').status(200).send(body + '\n');
  });

  app.get('/api/access-config', (_req: Request, res: Response) => {
    const requireOtpForCv = otpRequiredFor('cv');
    res.status(200).json({
      turnstileSiteKey: TURNSTILE_SITE_KEY,
      otpSupported: isDirectEmailTransportConfigured(),
      forceOtp: FORCE_CV_OTP || requireOtpForCv,
      requireOtpForChat: otpRequiredFor('chat'),
      requireOtpForContact: otpRequiredFor('contact'),
      requireOtpForCv,
      serverTelemetryPreferred: isFirebaseAdminConfigured(),
    });
  });

  app.get('/api/owner/observability', async (req: Request, res: Response) => {
    const authCheck = await verifyConsoleActorToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(401).json({ error: authCheck.error });
      return;
    }
    if (
      await enforceRateLimit(res, 'telemetry', `owner-obs:${authCheck.uid}`, {
        maxRequests: 60,
        error: 'Owner observability rate limit exceeded.',
      })
    ) {
      return;
    }
    res.status(200).json({
      ok: true,
      metrics: getObservabilitySnapshot(),
      goldPath: evaluateGoldPathHardening(),
      chat: getChatStats(),
    });
  });

  app.get('/api/owner/telemetry', async (req: Request, res: Response) => {
    const authCheck = await verifyConsoleActorToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(401).json({ error: authCheck.error });
      return;
    }
    if (
      await enforceRateLimit(res, 'telemetry', `owner-tel:${authCheck.uid}`, {
        maxRequests: 60,
        error: 'Owner telemetry rate limit exceeded.',
      })
    ) {
      return;
    }
    res.status(200).json(siteTelemetry);
  });

  app.post('/api/telemetry/event', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }
      if (rejectDisallowedOrigin(req, res)) return;
      if (!runtimeOwnerPolicy.enableSiteTelemetry || runtimeOwnerPolicy.incidentMode) {
        res.status(204).end();
        return;
      }
      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'telemetry', clientIp, {
          maxRequests: 60,
          error: 'Telemetry rate limit exceeded.',
        })
      ) {
        return;
      }
      const raw = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as {
        type?: unknown;
        track?: unknown;
      };
      const type = raw.type === 'og_share' ? 'og_share' : raw.type === 'pageview' ? 'pageview' : null;
      if (!type) {
        res.status(400).json({ error: 'type must be pageview or og_share.' });
        return;
      }
      const track =
        typeof raw.track === 'string' ? normalizeShareTrack(raw.track.slice(0, 32)) : undefined;
      bumpSiteTelemetry(type, track);
      res.status(204).end();
    } catch {
      res.status(500).json({ error: 'Unable to record telemetry event.' });
    }
  });

  /** Browser ErrorBoundary / client crash reports → structured log + optional Sentry. */
  app.post('/api/telemetry/client-error', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }
      if (rejectDisallowedOrigin(req, res)) return;
      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'telemetry', `cerr:${clientIp}`, {
          maxRequests: 20,
          error: 'Client error report rate limit exceeded.',
        })
      ) {
        return;
      }
      const raw = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as {
        message?: unknown;
        stack?: unknown;
        componentStack?: unknown;
      };
      const message =
        typeof raw.message === 'string' ? raw.message.trim().slice(0, 500) : 'client_error';
      const stack = typeof raw.stack === 'string' ? raw.stack.trim().slice(0, 2000) : undefined;
      const componentStack =
        typeof raw.componentStack === 'string' ? raw.componentStack.trim().slice(0, 2000) : undefined;
      structuredLog('error', 'client_error', {
        requestId: req.requestId,
        message,
        stack,
        componentStack,
      });
      void captureException(new Error(message), {
        source: 'client',
        requestId: req.requestId,
        stack,
        componentStack,
      });
      res.status(204).end();
    } catch {
      res.status(500).json({ error: 'Unable to record client error.' });
    }
  });

  app.post('/api/owner/digest-email', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }
      if (rejectDisallowedOrigin(req, res)) return;
      const authCheck = await verifyConsoleActorToken(req.headers.authorization);
      if (!authCheck.ok) {
        res.status(401).json({ error: authCheck.error });
        return;
      }
      if (
        await enforceRateLimit(res, 'contact', `owner-digest:${authCheck.uid}`, {
          maxRequests: 10,
          error: 'Owner digest rate limit exceeded.',
        })
      ) {
        return;
      }
      const raw = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as {
        subject?: unknown;
        body?: unknown;
        theme?: unknown;
        accent?: unknown;
      };
      const subject =
        typeof raw.subject === 'string' && raw.subject.trim()
          ? sanitizeHeaderValue(raw.subject).slice(0, 200)
          : 'Portfolio owner digest';
      const body =
        typeof raw.body === 'string' ? raw.body.trim().slice(0, 20000) : '';
      const digestTheme = parseEmailTheme(raw.theme);
      const digestAccent = parseEmailAccent(raw.accent);
      const queued = drainDigestItems();
      const queuedText = formatDigestQueueText(queued);
      const combined = [queuedText, body].filter(Boolean).join('\n\n').trim();
      if (combined.length < 20) {
        res.status(400).json({ error: 'Digest body is too short.' });
        return;
      }
      const html = buildOwnerAlertEmailHtml({
        alertClass: 'warning',
        title: subject,
        detail: combined.slice(0, 20000),
        theme: digestTheme,
        accent: digestAccent,
      });
      const result = await dispatchEmailMessage({
        to: DESTINATION_EMAIL,
        fromDisplayName: 'Portfolio Owner Digest',
        subjectLine: subject,
        html,
        text: combined.slice(0, 20000),
      });
      res.status(200).json({ ok: true, provider: result.provider, queuedAlerts: queued.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send digest email.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/owner/policy-sync', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }
      if (rejectDisallowedOrigin(req, res)) return;

      const authCheck = await verifyOwnerFirebaseIdToken(req.headers.authorization);
      if (!authCheck.ok) {
        res.status(401).json({ error: authCheck.error });
        return;
      }
      if (
        await enforceRateLimit(res, 'contact', `owner-policy:${authCheck.uid}`, {
          maxRequests: 30,
          error: 'Owner policy sync rate limit exceeded.',
        })
      ) {
        return;
      }

      const raw = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as {
        rules?: unknown;
        strictOtpForAll?: unknown;
        requireOtpForChat?: unknown;
        requireOtpForContact?: unknown;
        requireOtpForCv?: unknown;
        enableContactForm?: unknown;
        enableCvDownloads?: unknown;
        enablePwaInstall?: unknown;
        enableSiteTelemetry?: unknown;
        incidentMode?: unknown;
        notifyOnNewInquiry?: unknown;
        enablePortfolioChat?: unknown;
        enableLiveChat?: unknown;
        enableChatLlm?: unknown;
        enableVoiceAgent?: unknown;
        chatMaxQuestionsPerVisitor?: unknown;
        chatMaxLlmPerVisitor?: unknown;
        chatMaxLiveSessionsPerVisitor?: unknown;
        chatMaxVoiceTurnsPerVisitor?: unknown;
        chatRateWindowHours?: unknown;
        chatLlmModel?: unknown;
        chatShowSuggestions?: unknown;
        chatOfferLiveAgent?: unknown;
        alertEmailEnabled?: unknown;
        alertEmailUrgent?: unknown;
        alertEmailWarning?: unknown;
        alertEmailDigest?: unknown;
        alertClassNewInquiry?: unknown;
        alertClassLiveChat?: unknown;
        alertClassRiskDownload?: unknown;
        alertClassUnusualTraffic?: unknown;
        alertClassChatLimit?: unknown;
        alertClassOverdueCrm?: unknown;
      };

      const normalizedRules: CompactAccessRule[] = [];
      if (Array.isArray(raw.rules)) {
        for (const item of raw.rules.slice(0, 200)) {
          if (!item || typeof item !== 'object') continue;
          const check = validateAccessRuleDraft(item as {
            ruleType: 'allow' | 'block';
            matchType: 'email' | 'domain' | 'ip';
            value: string;
            note?: string;
          });
          if (check.valid && check.normalized) {
            normalizedRules.push(check.normalized);
          }
        }
      }

      const incidentMode =
        typeof raw.incidentMode === 'boolean' ? raw.incidentMode : runtimeOwnerPolicy.incidentMode;

      const requireOtpForCv = incidentMode
        ? true
        : typeof raw.requireOtpForCv === 'boolean'
          ? raw.requireOtpForCv
          : typeof raw.strictOtpForAll === 'boolean'
            ? raw.strictOtpForAll
            : runtimeOwnerPolicy.requireOtpForCv;
      saveRuntimeOwnerPolicy({
        rules: normalizedRules,
        requireOtpForChat: incidentMode
          ? true
          : typeof raw.requireOtpForChat === 'boolean'
            ? raw.requireOtpForChat
            : runtimeOwnerPolicy.requireOtpForChat,
        requireOtpForContact: incidentMode
          ? true
          : typeof raw.requireOtpForContact === 'boolean'
            ? raw.requireOtpForContact
            : runtimeOwnerPolicy.requireOtpForContact,
        requireOtpForCv,
        strictOtpForAll: requireOtpForCv,
        enableContactForm: incidentMode
          ? false
          : typeof raw.enableContactForm === 'boolean'
            ? raw.enableContactForm
            : runtimeOwnerPolicy.enableContactForm,
        enableCvDownloads: incidentMode
          ? false
          : typeof raw.enableCvDownloads === 'boolean'
            ? raw.enableCvDownloads
            : runtimeOwnerPolicy.enableCvDownloads,
        enablePwaInstall: incidentMode
          ? false
          : typeof raw.enablePwaInstall === 'boolean'
            ? raw.enablePwaInstall
            : runtimeOwnerPolicy.enablePwaInstall,
        enableSiteTelemetry: incidentMode
          ? false
          : typeof raw.enableSiteTelemetry === 'boolean'
            ? raw.enableSiteTelemetry
            : runtimeOwnerPolicy.enableSiteTelemetry,
        incidentMode,
        notifyOnNewInquiry:
          typeof raw.notifyOnNewInquiry === 'boolean'
            ? raw.notifyOnNewInquiry
            : runtimeOwnerPolicy.notifyOnNewInquiry,
        enablePortfolioChat: incidentMode
          ? false
          : typeof raw.enablePortfolioChat === 'boolean'
            ? raw.enablePortfolioChat
            : runtimeOwnerPolicy.enablePortfolioChat,
        enableLiveChat: incidentMode
          ? false
          : typeof raw.enableLiveChat === 'boolean'
            ? raw.enableLiveChat
            : runtimeOwnerPolicy.enableLiveChat,
        enableChatLlm: incidentMode
          ? false
          : typeof raw.enableChatLlm === 'boolean'
            ? raw.enableChatLlm
            : runtimeOwnerPolicy.enableChatLlm,
        enableVoiceAgent: incidentMode
          ? false
          : typeof raw.enableVoiceAgent === 'boolean'
            ? raw.enableVoiceAgent
            : runtimeOwnerPolicy.enableVoiceAgent,
        chatMaxQuestionsPerVisitor: clampPolicyInt(
          raw.chatMaxQuestionsPerVisitor,
          runtimeOwnerPolicy.chatMaxQuestionsPerVisitor,
          1,
          200
        ),
        chatMaxLlmPerVisitor: clampPolicyInt(
          raw.chatMaxLlmPerVisitor,
          runtimeOwnerPolicy.chatMaxLlmPerVisitor,
          0,
          100
        ),
        chatMaxLiveSessionsPerVisitor: clampPolicyInt(
          raw.chatMaxLiveSessionsPerVisitor,
          runtimeOwnerPolicy.chatMaxLiveSessionsPerVisitor,
          0,
          50
        ),
        chatMaxVoiceTurnsPerVisitor: clampPolicyInt(
          raw.chatMaxVoiceTurnsPerVisitor,
          runtimeOwnerPolicy.chatMaxVoiceTurnsPerVisitor,
          0,
          50
        ),
        chatRateWindowHours: clampPolicyInt(
          raw.chatRateWindowHours,
          runtimeOwnerPolicy.chatRateWindowHours,
          1,
          168
        ),
        chatLlmModel:
          typeof raw.chatLlmModel === 'string'
            ? raw.chatLlmModel.slice(0, 64)
            : runtimeOwnerPolicy.chatLlmModel,
        chatShowSuggestions:
          typeof raw.chatShowSuggestions === 'boolean'
            ? raw.chatShowSuggestions
            : runtimeOwnerPolicy.chatShowSuggestions,
        chatOfferLiveAgent:
          typeof raw.chatOfferLiveAgent === 'boolean'
            ? raw.chatOfferLiveAgent
            : runtimeOwnerPolicy.chatOfferLiveAgent,
        alertEmailEnabled:
          typeof raw.alertEmailEnabled === 'boolean'
            ? raw.alertEmailEnabled
            : runtimeOwnerPolicy.alertEmailEnabled,
        alertEmailUrgent:
          typeof raw.alertEmailUrgent === 'boolean'
            ? raw.alertEmailUrgent
            : runtimeOwnerPolicy.alertEmailUrgent,
        alertEmailWarning:
          typeof raw.alertEmailWarning === 'boolean'
            ? raw.alertEmailWarning
            : runtimeOwnerPolicy.alertEmailWarning,
        alertEmailDigest:
          typeof raw.alertEmailDigest === 'boolean'
            ? raw.alertEmailDigest
            : runtimeOwnerPolicy.alertEmailDigest,
        alertClassNewInquiry: sanitizeOwnerAlertClass(
          raw.alertClassNewInquiry,
          runtimeOwnerPolicy.alertClassNewInquiry
        ),
        alertClassLiveChat: sanitizeOwnerAlertClass(
          raw.alertClassLiveChat,
          runtimeOwnerPolicy.alertClassLiveChat
        ),
        alertClassRiskDownload: sanitizeOwnerAlertClass(
          raw.alertClassRiskDownload,
          runtimeOwnerPolicy.alertClassRiskDownload
        ),
        alertClassUnusualTraffic: sanitizeOwnerAlertClass(
          raw.alertClassUnusualTraffic,
          runtimeOwnerPolicy.alertClassUnusualTraffic
        ),
        alertClassChatLimit: sanitizeOwnerAlertClass(
          raw.alertClassChatLimit,
          runtimeOwnerPolicy.alertClassChatLimit
        ),
        alertClassOverdueCrm: sanitizeOwnerAlertClass(
          raw.alertClassOverdueCrm,
          runtimeOwnerPolicy.alertClassOverdueCrm
        ),
      });

      res.status(200).json({ ok: true, ruleCount: normalizedRules.length });
    } catch {
      res.status(500).json({ error: 'Unable to sync owner security policy.' });
    }
  });

  app.post('/api/owner/reply-message', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }
      if (rejectDisallowedOrigin(req, res)) return;

      const authCheck = await verifyConsoleActorToken(req.headers.authorization);
      if (!authCheck.ok) {
        res.status(401).json({ error: authCheck.error });
        return;
      }

      const raw = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as {
        messageId?: unknown;
        toEmail?: unknown;
        toName?: unknown;
        subject?: unknown;
        body?: unknown;
        originalSubject?: unknown;
      };

      const toEmailRaw = typeof raw.toEmail === 'string' ? raw.toEmail.trim().toLowerCase() : '';
      const toNameRaw = typeof raw.toName === 'string' ? raw.toName.trim() : '';
      const subject = typeof raw.subject === 'string' ? raw.subject.trim() : '';
      const body = typeof raw.body === 'string' ? raw.body.trim() : '';
      const messageId = typeof raw.messageId === 'string' ? raw.messageId.trim() : '';
      const originalSubject =
        typeof raw.originalSubject === 'string' ? raw.originalSubject.trim().slice(0, 200) : '';

      if (!messageId || messageId.length < 4) {
        res.status(400).json({ error: 'A valid inquiry messageId is required to send a reply.' });
        return;
      }
      if (subject.length < 3 || body.length < 3) {
        res.status(400).json({ error: 'Reply subject and body must be at least 3 characters.' });
        return;
      }

      // Always bind recipient to the stored inquiry (prevents arbitrary outbound mail relay).
      if (!isFirebaseAdminConfigured()) {
        res.status(503).json({
          error:
            'Owner replies require Firebase Admin SDK binding. Set FIREBASE_SERVICE_ACCOUNT_JSON and retry.',
        });
        return;
      }
      const inquiry = await adminGetContactMessage(messageId);
      if (!inquiry) {
        res.status(404).json({ error: 'Inquiry not found for reply binding.' });
        return;
      }
      if (toEmailRaw && toEmailRaw !== inquiry.senderEmail) {
        res.status(403).json({ error: 'Reply recipient must match the inquiry sender email.' });
        return;
      }
      const toEmail = inquiry.senderEmail;
      const toName = toNameRaw || inquiry.senderName;

      if (
        await enforceRateLimit(res, 'contact', `owner-reply:${authCheck.email || authCheck.uid || 'actor'}`, {
          maxRequests: 30,
          error: 'Too many owner replies. Please wait a few minutes.',
        })
      ) {
        return;
      }

      const result = await sendOwnerReplyEmail({
        toEmail,
        toName,
        subject: subject.slice(0, 200),
        body: body.slice(0, 5000),
        originalSubject,
        // Outbound professional replies default to light; honor inquiry theme/accent when set.
        theme: parseEmailTheme(inquiry.theme ?? 'light'),
        accent: parseEmailAccent(inquiry.accent),
      });

      // Mark triage via Admin SDK so client Firestore rules can't block a successful send.
      const triageUpdated = await adminMarkContactReplied(messageId, body.slice(0, 5000));

      res.status(200).json({
        ok: true,
        provider: result.provider,
        messageId,
        triageUpdated,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to send owner reply email.';
      res.status(500).json({ error: message });
    }
  });

  app.get(['/api/og-card.svg', '/og-card.svg'], async (req: Request, res: Response) => {
    const clientIp = extractClientIp(req);
    const ogLimit = await checkDistributedRateLimit('telemetry', `og:${clientIp}`, { maxRequests: 120 });
    if (ogLimit.limited) {
      res.setHeader('Retry-After', String(ogLimit.retryAfterSeconds));
      res.status(429).type('text/plain').send('Rate limit exceeded.');
      return;
    }
    const rawTrack = typeof req.query.track === 'string' ? req.query.track : undefined;
    const track = normalizeShareTrack(rawTrack);
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const skillLabel =
      typeof req.query.skill === 'string' ? req.query.skill.slice(0, 60) : undefined;
    bumpSiteTelemetry('og_share', track);
    const svg = buildDynamicSocialSvg({ track, theme, skillLabel });
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(svg);
  });

  app.post('/api/contact', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }

      if (rejectDisallowedOrigin(req, res)) return;

      if (!runtimeOwnerPolicy.enableContactForm) {
        res.status(503).json({
          error: 'The contact form is temporarily paused by the portfolio owner. Please reach out directly via email.',
        });
        return;
      }

      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'contact', clientIp, {
          error: 'Too many messages sent from this connection. Please wait a few minutes and try again.',
        })
      ) {
        return;
      }

      const rawBody = req.body;
      const body = (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {}) as Partial<ContactPayload> & {
        website?: unknown;
        turnstileToken?: unknown;
        theme?: unknown;
        accent?: unknown;
        clientTimezone?: unknown;
        referrer?: unknown;
      };

      // Silent honeypot sink for automated spam bots
      if (isHoneypotTriggered(body.website)) {
        res.status(200).json({
          ok: true,
          provider: 'filtered',
          message: `Email transmitted directly to ${DESTINATION_EMAIL}.`,
        });
        return;
      }

      if (await rejectFailedTurnstile(req, res, body)) return;

      const { name, email, phone, subject, message } = body;

      const cleanName = typeof name === 'string' ? sanitizeHeaderValue(name) : '';
      const cleanEmail = typeof email === 'string' ? sanitizeHeaderValue(email) : '';
      const cleanPhone = typeof phone === 'string' ? sanitizeHeaderValue(phone) : '';
      const cleanSubject = typeof subject === 'string' ? sanitizeHeaderValue(subject) : '';
      const cleanMessage = typeof message === 'string' ? message.trim() : '';

      const accessCheck = evaluateAccessRules(runtimeOwnerPolicy.rules, {
        email: cleanEmail,
        ipAddress: clientIp,
      });
      if (accessCheck.blocked) {
        res.status(403).json({
          error: 'This email domain or network address is restricted from submitting inquiries.',
        });
        return;
      }

      if (!cleanName || !cleanEmail || !cleanMessage) {
        res.status(400).json({ error: 'Please fill out the required fields: Name, Email, and Message.' });
        return;
      }

      if (
        cleanName.length > MAX_FIELD_LENGTHS.name ||
        cleanEmail.length > MAX_FIELD_LENGTHS.email ||
        cleanPhone.length > MAX_FIELD_LENGTHS.phone ||
        cleanSubject.length > MAX_FIELD_LENGTHS.subject ||
        cleanMessage.length > MAX_FIELD_LENGTHS.message
      ) {
        res.status(400).json({ error: 'One or more fields exceed the allowed character limit.' });
        return;
      }

      if (!isValidEmailAddress(cleanEmail)) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }

      const mxCheck = await verifyEmailMxRecord(cleanEmail);
      if (!mxCheck.ok) {
        res.status(400).json({ error: mxCheck.reason || 'Please provide a valid, active email domain.' });
        return;
      }

      const contactPhoneCheck = validatePhoneDetails(cleanPhone);
      if (cleanPhone && (!isValidPhoneNumber(cleanPhone) || !contactPhoneCheck.valid)) {
        res.status(400).json({
          error:
            contactPhoneCheck.reason ||
            'Please provide a genuine phone number (with country code) or leave it blank.',
        });
        return;
      }

      if (!isDirectEmailTransportConfigured()) {
        res.status(503).json({
          error: otpRequiredFor('contact')
            ? 'Email OTP verification service is currently unavailable. Please email directly.'
            : 'Email delivery is currently unavailable. Please email directly.',
        });
        return;
      }

      const normalizedContactPhone = contactPhoneCheck.internationalDisplay || cleanPhone;
      const clientTimezone =
        typeof body.clientTimezone === 'string'
          ? sanitizeHeaderValue(body.clientTimezone).slice(0, 64)
          : '';
      const referrer =
        typeof body.referrer === 'string'
          ? sanitizeHeaderValue(body.referrer).slice(0, 200)
          : typeof req.headers.referer === 'string'
            ? sanitizeHeaderValue(req.headers.referer).slice(0, 200)
            : '';
      const userAgent =
        typeof req.headers['user-agent'] === 'string'
          ? sanitizeHeaderValue(req.headers['user-agent']).slice(0, 220)
          : 'Unknown';

      const ipIntel = await lookupIpIntelligence(clientIp);
      const risk = assessVisitorRisk(ipIntel, {
        clientTimezone,
        hasEmail: true,
        phoneCountry: contactPhoneCheck.countryCode || undefined,
      });
      const cleanTheme = parseEmailTheme(body.theme);
      const cleanAccent = parseEmailAccent(body.accent);

      if (!otpRequiredFor('contact')) {
        const messageId = `MSG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const geoSummary =
          [ipIntel.city, ipIntel.region, ipIntel.country].filter(Boolean).join(', ') || 'Unknown';
        const telemetryNote = `Ref: ${messageId} · OTP bypassed by owner · IP: ${ipIntel.ipAddress} · Geo: ${geoSummary} · ${
          risk.isVpnSuspected ? `VPN/Proxy Flagged (${risk.riskLevel})` : 'Clean Network'
        }`;
        const result = await sendContactEmail({
          name: cleanName,
          email: cleanEmail,
          phone: normalizedContactPhone,
          subject: cleanSubject,
          message: cleanMessage,
          theme: cleanTheme,
          accent: cleanAccent,
          messageId,
          telemetryNote,
        });
        const contactSummary = {
          messageId,
          senderName: cleanName.slice(0, 120),
          senderEmail: cleanEmail.slice(0, 254),
          senderPhone: normalizedContactPhone.slice(0, 40),
          subject: cleanSubject.slice(0, 200),
          message: cleanMessage.slice(0, 5000),
          theme: cleanTheme,
          accent: cleanAccent,
          ipAddress: ipIntel.ipAddress.slice(0, 64),
          country: ipIntel.country.slice(0, 80),
          region: ipIntel.region.slice(0, 80),
          city: ipIntel.city.slice(0, 80),
          isp: ipIntel.isp.slice(0, 120),
          asn: ipIntel.asn.slice(0, 64),
          timezone: ipIntel.timezone.slice(0, 64),
          clientTimezone: clientTimezone.slice(0, 64),
          isVpnSuspected: risk.isVpnSuspected,
          riskLevel: risk.riskLevel,
          riskReasons: risk.riskReasons.join(', ').slice(0, 240),
          referrer: referrer.slice(0, 200),
          userAgent: userAgent.slice(0, 220),
        };
        const telemetryPersistedByServer = await tryPersistContactSummary(contactSummary);
        void emitOwnerAlert({
          eventType: 'new_inquiry',
          title: `New inquiry from ${cleanName}`,
          detail: `${cleanEmail}${cleanSubject ? ` · ${cleanSubject}` : ''} · risk ${risk.riskLevel}${
            risk.isVpnSuspected ? ' · VPN/proxy suspected' : ''
          }`,
          dedupeKey: `inquiry:${messageId}`,
          theme: cleanTheme,
          accent: cleanAccent,
        });
        res.status(200).json({
          ok: true,
          status: 'sent',
          provider: result.provider,
          message: `Email transmitted directly to ${DESTINATION_EMAIL}.`,
          contactSummary,
          telemetryPersistedByServer,
        });
        return;
      }

      const normalizedOtpEmail = `contact:${cleanEmail.toLowerCase()}`;
      if (
        await enforceRateLimit(res, 'otp-email', normalizedOtpEmail, {
          maxRequests: 5,
          error:
            'Too many verification codes sent to this email. Please check your inbox or wait a few minutes.',
        })
      ) {
        return;
      }

      const challenge = await createOtpChallengeAsync(
        contactOtpChallengeStore,
        {
          name: cleanName,
          email: cleanEmail,
          phone: normalizedContactPhone,
          subject: cleanSubject,
          message: cleanMessage,
          theme: cleanTheme,
          accent: cleanAccent,
          clientTimezone,
          referrer,
          userAgent,
          ip: ipIntel,
          risk,
        },
        OTP_SECRET
      );
      bumpMetric('otpIssued');

      await sendVisitorOtpEmail({
        email: cleanEmail,
        name: cleanName,
        code: challenge.code,
        theme: cleanTheme,
        accent: cleanAccent,
        purpose: 'contact',
      });

      const maskedEmail = maskEmailAddress(cleanEmail);
      res.status(200).json({
        ok: true,
        status: 'otp_required',
        challengeId: challenge.challengeId,
        challengeToken: challenge.challengeToken,
        maskedEmail,
        expiresInMinutes: 10,
        message: `Verification code sent to ${maskedEmail}. Enter the 6-digit code to transmit your message.`,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to initiate message verification.';
      console.error('Contact OTP dispatch error:', errMsg);
      res.status(500).json({ error: 'Unable to send your verification code right now. Please try again later.' });
    }
  });

  app.post('/api/contact-verify-otp', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }

      if (rejectDisallowedOrigin(req, res)) return;

      if (!runtimeOwnerPolicy.enableContactForm) {
        res.status(503).json({
          error: 'The contact form is temporarily paused by the portfolio owner. Please reach out directly via email.',
        });
        return;
      }

      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'contact', clientIp, {
          error: 'Too many verification attempts. Please wait a few minutes and try again.',
        })
      ) {
        return;
      }

      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {}) as { challengeId?: unknown; challengeToken?: unknown; code?: unknown };

      const challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim() : '';
      const challengeToken = typeof body.challengeToken === 'string' ? body.challengeToken.trim() : '';
      const code = typeof body.code === 'string' ? body.code.trim() : '';

      if (!challengeId || !challengeToken || !/^\d{6}$/.test(code.replace(/\s+/g, ''))) {
        res.status(400).json({ error: 'Please enter the valid 6-digit verification code sent to your email.' });
        return;
      }

      const verified = await verifyOtpChallengeAsync(
        contactOtpChallengeStore,
        { challengeId, challengeToken, code },
        OTP_SECRET
      );
      if (!verified.ok) {
        res.status(400).json({ error: verified.error });
        return;
      }
      bumpMetric('otpVerified');

      const p = verified.payload;
      const accessCheck = evaluateAccessRules(runtimeOwnerPolicy.rules, {
        email: p.email,
        ipAddress: p.ip.ipAddress || clientIp,
      });
      if (accessCheck.blocked) {
        res.status(403).json({
          error: 'This email domain or network address is restricted from submitting inquiries.',
        });
        return;
      }

      const messageId = `MSG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const geoSummary = [p.ip.city, p.ip.region, p.ip.country].filter(Boolean).join(', ') || 'Unknown';
      const telemetryNote = `Ref: ${messageId} · Email OTP Verified · IP: ${p.ip.ipAddress} · Geo: ${geoSummary} · ${
        p.risk.isVpnSuspected ? `VPN/Proxy Flagged (${p.risk.riskLevel})` : 'Clean Network'
      }`;

      const result = await sendContactEmail({
        name: p.name,
        email: p.email,
        phone: p.phone,
        subject: p.subject,
        message: p.message,
        theme: p.theme,
        accent: p.accent,
        messageId,
        telemetryNote,
      });

      const contactSummary = {
        messageId,
        senderName: p.name.slice(0, 120),
        senderEmail: p.email.slice(0, 254),
        senderPhone: p.phone.slice(0, 40),
        subject: p.subject.slice(0, 200),
        message: p.message.slice(0, 5000),
        theme: p.theme,
        accent: p.accent,
        ipAddress: p.ip.ipAddress.slice(0, 64),
        country: p.ip.country.slice(0, 80),
        region: p.ip.region.slice(0, 80),
        city: p.ip.city.slice(0, 80),
        isp: p.ip.isp.slice(0, 120),
        asn: p.ip.asn.slice(0, 64),
        timezone: p.ip.timezone.slice(0, 64),
        clientTimezone: p.clientTimezone.slice(0, 64),
        isVpnSuspected: p.risk.isVpnSuspected,
        riskLevel: p.risk.riskLevel,
        riskReasons: p.risk.riskReasons.join(', ').slice(0, 240),
        referrer: p.referrer.slice(0, 200),
        userAgent: p.userAgent.slice(0, 220),
      };
      const telemetryPersistedByServer = await tryPersistContactSummary(contactSummary);

      void emitOwnerAlert({
        eventType: 'new_inquiry',
        title: `New inquiry from ${p.name}`,
        detail: `${p.email}${p.subject ? ` · ${p.subject}` : ''} · risk ${p.risk.riskLevel}${
          p.risk.isVpnSuspected ? ' · VPN/proxy suspected' : ''
        }`,
        dedupeKey: `inquiry:${messageId}`,
        theme: p.theme,
        accent: p.accent,
      });

      res.status(200).json({
        ok: true,
        provider: result.provider,
        message: `Email verified & transmitted directly to ${DESTINATION_EMAIL}.`,
        contactSummary,
        telemetryPersistedByServer,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unable to verify message OTP.';
      console.error('Contact OTP verification error:', errMsg);
      res.status(500).json({ error: 'Unable to complete verification right now. Please try again.' });
    }
  });

  app.post('/api/cv-access', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }

      if (rejectDisallowedOrigin(req, res)) return;

      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'cv-access', clientIp, {
          error: 'Too many requests from this connection. Please wait a few minutes and try again.',
        })
      ) {
        return;
      }

      const rawBody = req.body;
      const body = (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {}) as Partial<CvAccessPayload> & {
        website?: unknown;
        turnstileToken?: unknown;
        theme?: unknown;
        accent?: unknown;
        clientTimezone?: unknown;
        clientLanguage?: unknown;
        clientScreen?: unknown;
        referrer?: unknown;
      };

      // Silent honeypot sink for automated spam bots
      if (isHoneypotTriggered(body.website)) {
        res.status(200).json({
          ok: true,
          status: 'verified',
          provider: 'filtered',
          message: 'Access verified. Preparing your CV export.',
        });
        return;
      }

      if (await rejectFailedTurnstile(req, res, body)) return;

      const cleanName = typeof body.name === 'string' ? sanitizeHeaderValue(body.name) : '';
      const cleanEmail = typeof body.email === 'string' ? sanitizeHeaderValue(body.email) : '';
      const cleanPhone = typeof body.phone === 'string' ? sanitizeHeaderValue(body.phone) : '';
      const cleanReason = typeof body.reason === 'string' ? body.reason.trim() : '';
      const cleanAction: CvAccessPayload['action'] =
        body.action === 'print'
          ? 'print'
          : body.action === 'ats'
            ? 'ats'
            : body.action === 'install'
              ? 'install'
              : 'pdf';

      if (cleanAction === 'install' && !runtimeOwnerPolicy.enablePwaInstall) {
        res.status(503).json({
          error: 'App install is temporarily unavailable. Please try again later.',
        });
        return;
      }
      if (!runtimeOwnerPolicy.enableCvDownloads && cleanAction !== 'install') {
        res.status(503).json({
          error: 'CV exports are temporarily paused by the portfolio owner. Please check back shortly or contact directly.',
        });
        return;
      }

      const accessEval = evaluateAccessRules(runtimeOwnerPolicy.rules, {
        email: cleanEmail,
        ipAddress: clientIp,
      });
      if (accessEval.blocked) {
        res.status(403).json({
          error: 'This email domain or network address has been restricted from downloading CV exports.',
        });
        return;
      }

      const cleanFormat =
        typeof body.formatLabel === 'string'
          ? sanitizeHeaderValue(body.formatLabel)
          : cleanAction === 'install'
            ? 'Portfolio PWA'
            : 'Executive Summary';
      const cleanTheme = parseEmailTheme(body.theme);
      const cleanAccent = parseEmailAccent(body.accent);

      if (!cleanEmail) {
        res.status(400).json({
          error:
            cleanAction === 'install'
              ? 'Please enter your Email ID to verify and install.'
              : 'Please enter your Email ID to verify and download.',
        });
        return;
      }

      if (!isValidEmailAddress(cleanEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }

      const phoneCheck = validatePhoneDetails(cleanPhone);
      if (cleanPhone && (!isValidPhoneNumber(cleanPhone) || !phoneCheck.valid)) {
        res.status(400).json({
          error:
            phoneCheck.reason ||
            'Please enter a genuine phone number with country code (dummy or sequential numbers are blocked).',
        });
        return;
      }

      const normalizedCvPhone = phoneCheck.internationalDisplay || cleanPhone;

      if (cleanReason.length < 3) {
        res.status(400).json({
          error:
            cleanAction === 'install'
              ? 'Please share a brief reason (at least 3 characters) why you are installing this app.'
              : 'Please share a brief reason (at least 3 characters) why you are downloading or printing this CV.',
        });
        return;
      }

      if (
        cleanName.length > MAX_FIELD_LENGTHS.name ||
        cleanEmail.length > MAX_FIELD_LENGTHS.email ||
        normalizedCvPhone.length > MAX_FIELD_LENGTHS.phone ||
        cleanReason.length > MAX_FIELD_LENGTHS.message
      ) {
        res.status(400).json({ error: 'One or more fields exceed the allowed character limit.' });
        return;
      }

      if (cleanEmail) {
        const mxCheck = await verifyEmailMxRecord(cleanEmail);
        if (!mxCheck.ok) {
          res.status(400).json({ error: mxCheck.reason || 'Email domain cannot receive mail.' });
          return;
        }
      }

      const clientTimezone = typeof body.clientTimezone === 'string' ? sanitizeHeaderValue(body.clientTimezone).slice(0, 64) : '';
      const clientLanguage = typeof body.clientLanguage === 'string' ? sanitizeHeaderValue(body.clientLanguage).slice(0, 32) : '';
      const clientScreen = typeof body.clientScreen === 'string' ? sanitizeHeaderValue(body.clientScreen).slice(0, 32) : '';
      const referrer =
        typeof body.referrer === 'string'
          ? sanitizeHeaderValue(body.referrer).slice(0, 200)
          : typeof req.headers.referer === 'string'
            ? sanitizeHeaderValue(req.headers.referer).slice(0, 200)
            : '';
      const userAgent = typeof req.headers['user-agent'] === 'string' ? sanitizeHeaderValue(req.headers['user-agent']).slice(0, 220) : 'Unknown';

      const ipIntel = await lookupIpIntelligence(clientIp);
      const risk = assessVisitorRisk(ipIntel, {
        clientTimezone,
        hasEmail: Boolean(cleanEmail),
        phoneCountry: phoneCheck.countryCode || undefined,
      });

      const directTransportReady = isDirectEmailTransportConfigured();
      // requireOtpForCv (or FORCE_CV_OTP) forces OTP; when off, skip adaptive step-up too.
      const shouldStepUpOtp =
        directTransportReady &&
        !accessEval.allowlisted &&
        (FORCE_CV_OTP || otpRequiredFor('cv'));

      if (shouldStepUpOtp) {
        if (!cleanEmail) {
          res.status(400).json({
            requireEmail: true,
            error:
              'VPN, proxy, or unverified network context detected. Please enter a valid Email ID to receive a 6-digit verification code.',
          });
          return;
        }

        const normalizedCvOtpEmail = `cv:${cleanEmail.toLowerCase()}`;
        if (
          await enforceRateLimit(res, 'otp-email', normalizedCvOtpEmail, {
            maxRequests: 5,
            error:
              'Too many verification codes sent to this email. Please wait a few minutes before requesting another code.',
          })
        ) {
          return;
        }

        const challenge = await createOtpChallengeAsync(
          otpChallengeStore,
          {
            name: cleanName,
            email: cleanEmail,
            phone: normalizedCvPhone,
            reason: cleanReason,
            action: cleanAction,
            formatLabel: cleanFormat,
            theme: cleanTheme,
            accent: cleanAccent,
            clientTimezone,
            clientLanguage,
            clientScreen,
            referrer,
            userAgent,
            ip: ipIntel,
            risk,
          },
          OTP_SECRET
        );
        bumpMetric('otpIssued');

        await sendVisitorOtpEmail({
          email: cleanEmail,
          name: cleanName,
          code: challenge.code,
          theme: cleanTheme,
          accent: cleanAccent,
          purpose: 'cv',
        });

        res.status(200).json({
          ok: true,
          status: 'otp_required',
          challengeId: challenge.challengeId,
          challengeToken: challenge.challengeToken,
          maskedEmail: maskEmailAddress(cleanEmail),
          expiresInMinutes: 10,
          riskReasons: risk.riskReasons,
          message: `Security check: we sent a 6-digit verification code to ${maskEmailAddress(cleanEmail)}.`,
        });
        return;
      }

      const downloadId = generateDownloadId();
      const sessionId = generateSessionId();
      const verificationStatus: VerificationStatus = cleanEmail ? 'mx_verified' : 'phone_only';
      const telemetry: VisitorTelemetryReport = {
        downloadId,
        sessionId,
        ip: ipIntel,
        risk,
        clientTimezone,
        clientLanguage,
        clientScreen,
        referrer,
        userAgent,
        verificationStatus,
      };

      const accessPayload: CvAccessPayload = {
        name: cleanName,
        email: cleanEmail,
        phone: normalizedCvPhone,
        reason: cleanReason,
        action: cleanAction,
        formatLabel: cleanFormat,
        theme: cleanTheme,
        accent: cleanAccent,
      };

      const result = await sendCvAccessEmail(accessPayload, telemetry, false);
      const sessionReceipt = signSessionReceipt(
        {
          sessionId,
          name: cleanName,
          email: cleanEmail,
          phone: normalizedCvPhone,
          reason: cleanReason.slice(0, 500),
          verificationStatus,
          issuedAt: Date.now(),
        },
        OTP_SECRET
      );

      const trackingSummary = buildTrackingSummaryForClient(accessPayload, telemetry, false);
      const telemetryPersistedByServer = await tryPersistCvTracking(trackingSummary);

      if (telemetry.risk.isVpnSuspected || telemetry.risk.riskLevel === 'high') {
        void emitOwnerAlert({
          eventType: 'risk_download',
          title: `High-risk CV access from ${cleanName}`,
          detail: `${cleanEmail} · ${telemetry.risk.riskLevel} · IP ${telemetry.ip.ipAddress || 'unknown'}${
            telemetry.risk.isVpnSuspected ? ' · VPN/proxy suspected' : ''
          }`,
          dedupeKey: `cvrisk:${cleanEmail.toLowerCase()}:${Math.floor(Date.now() / 3_600_000)}`,
          theme: cleanTheme,
          accent: cleanAccent,
        });
      }

      res.status(200).json({
        ok: true,
        status: 'verified',
        provider: result.provider,
        verificationStatus,
        sessionReceipt,
        trackingSummary,
        telemetryPersistedByServer,
        message:
          cleanAction === 'install'
            ? 'Access verified. Preparing app install.'
            : 'Access verified. Preparing your CV export.',
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unable to process access request.';
      console.error('CV access dispatch error:', errMsg);
      res.status(500).json({ error: 'Unable to process access request right now. Please try again later.' });
    }
  });

  app.post('/api/cv-verify-otp', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }

      if (rejectDisallowedOrigin(req, res)) return;

      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'cv-access', clientIp, {
          error: 'Too many verification attempts. Please wait a few minutes and try again.',
        })
      ) {
        return;
      }

      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {}) as { challengeId?: unknown; challengeToken?: unknown; code?: unknown };

      const challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim() : '';
      const challengeToken = typeof body.challengeToken === 'string' ? body.challengeToken.trim() : '';
      const code = typeof body.code === 'string' ? body.code.trim() : '';

      if (!challengeId || !challengeToken || !/^\d{6}$/.test(code.replace(/\s+/g, ''))) {
        res.status(400).json({ error: 'Please enter the valid 6-digit verification code sent to your email.' });
        return;
      }

      const verified = await verifyOtpChallengeAsync(
        otpChallengeStore,
        { challengeId, challengeToken, code },
        OTP_SECRET
      );
      if (!verified.ok) {
        res.status(400).json({ error: verified.error });
        return;
      }
      bumpMetric('otpVerified');

      const p = verified.payload;
      if (p.action === 'install' && !runtimeOwnerPolicy.enablePwaInstall) {
        res.status(503).json({
          error: 'App install is temporarily unavailable. Please try again later.',
        });
        return;
      }
      if (!runtimeOwnerPolicy.enableCvDownloads && p.action !== 'install') {
        res.status(503).json({
          error: 'CV exports are temporarily paused by the portfolio owner. Please check back shortly.',
        });
        return;
      }

      const cvVerifyAccess = evaluateAccessRules(runtimeOwnerPolicy.rules, {
        email: p.email,
        ipAddress: p.ip.ipAddress || clientIp,
      });
      if (cvVerifyAccess.blocked) {
        res.status(403).json({
          error: 'This email domain or network address has been restricted from downloading CV exports.',
        });
        return;
      }

      const downloadId = generateDownloadId();
      const sessionId = generateSessionId();
      const verificationStatus: VerificationStatus = 'otp_verified';
      const telemetry: VisitorTelemetryReport = {
        downloadId,
        sessionId,
        ip: p.ip,
        risk: p.risk,
        clientTimezone: p.clientTimezone,
        clientLanguage: p.clientLanguage,
        clientScreen: p.clientScreen,
        referrer: p.referrer,
        userAgent: p.userAgent,
        verificationStatus,
      };

      const accessPayload: CvAccessPayload = {
        name: p.name,
        email: p.email,
        phone: p.phone,
        reason: p.reason,
        action: p.action,
        formatLabel: p.formatLabel,
        theme: p.theme,
        accent: p.accent,
      };

      const result = await sendCvAccessEmail(accessPayload, telemetry, false);
      const sessionReceipt = signSessionReceipt(
        {
          sessionId,
          name: p.name,
          email: p.email,
          phone: p.phone,
          reason: p.reason.slice(0, 500),
          verificationStatus,
          issuedAt: Date.now(),
        },
        OTP_SECRET
      );

      const trackingSummary = buildTrackingSummaryForClient(accessPayload, telemetry, false);
      const telemetryPersistedByServer = await tryPersistCvTracking(trackingSummary);

      res.status(200).json({
        ok: true,
        status: 'verified',
        provider: result.provider,
        verificationStatus,
        sessionReceipt,
        trackingSummary,
        telemetryPersistedByServer,
        message:
          p.action === 'install'
            ? 'Email OTP verified. Preparing app install.'
            : 'Email OTP verified. Preparing your CV export.',
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unable to verify OTP code.';
      console.error('CV OTP verification error:', errMsg);
      res.status(500).json({ error: 'Unable to complete verification right now. Please try again.' });
    }
  });

  app.post('/api/cv-event', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }

      if (rejectDisallowedOrigin(req, res)) return;

      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'cv-event', clientIp, {
          maxRequests: 40,
          error: 'Rate limit exceeded.',
        })
      ) {
        return;
      }

      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {}) as {
        sessionReceipt?: unknown;
        action?: unknown;
        formatLabel?: unknown;
        theme?: unknown;
        accent?: unknown;
        clientTimezone?: unknown;
        clientLanguage?: unknown;
        clientScreen?: unknown;
        referrer?: unknown;
      };

      const receiptToken = typeof body.sessionReceipt === 'string' ? body.sessionReceipt : undefined;
      const verifiedSession = verifySessionReceipt(receiptToken, OTP_SECRET);
      if (!verifiedSession) {
        res.status(401).json({
          error: SESSION_EXPIRED_MESSAGES.cv,
          code: SESSION_EXPIRED_CODE,
        });
        return;
      }

      const cleanAction: CvAccessPayload['action'] =
        body.action === 'print'
          ? 'print'
          : body.action === 'ats'
            ? 'ats'
            : body.action === 'install'
              ? 'install'
              : 'pdf';

      if (cleanAction === 'install' && !runtimeOwnerPolicy.enablePwaInstall) {
        res.status(503).json({
          error: 'App install is temporarily unavailable. Please try again later.',
        });
        return;
      }
      if (!runtimeOwnerPolicy.enableCvDownloads && cleanAction !== 'install') {
        res.status(503).json({
          error: 'CV exports are temporarily paused by the portfolio owner.',
        });
        return;
      }

      const cvEventAccess = evaluateAccessRules(runtimeOwnerPolicy.rules, {
        email: verifiedSession.email,
        ipAddress: clientIp,
      });
      if (cvEventAccess.blocked) {
        res.status(403).json({
          error: 'This email domain or network address has been restricted from CV exports.',
        });
        return;
      }

      const cleanFormat =
        typeof body.formatLabel === 'string'
          ? sanitizeHeaderValue(body.formatLabel).slice(0, 80) || 'Executive Summary'
          : 'Executive Summary';
      const cleanTheme = parseEmailTheme(body.theme);
      const cleanAccent = parseEmailAccent(body.accent);
      const clientTimezone = typeof body.clientTimezone === 'string' ? sanitizeHeaderValue(body.clientTimezone).slice(0, 64) : '';
      const clientLanguage = typeof body.clientLanguage === 'string' ? sanitizeHeaderValue(body.clientLanguage).slice(0, 32) : '';
      const clientScreen = typeof body.clientScreen === 'string' ? sanitizeHeaderValue(body.clientScreen).slice(0, 32) : '';
      const referrer = typeof body.referrer === 'string' ? sanitizeHeaderValue(body.referrer).slice(0, 200) : '';
      const userAgent = typeof req.headers['user-agent'] === 'string' ? sanitizeHeaderValue(req.headers['user-agent']).slice(0, 220) : 'Unknown';

      const ipIntel = await lookupIpIntelligence(clientIp);
      const risk = assessVisitorRisk(ipIntel, {
        clientTimezone,
        hasEmail: Boolean(verifiedSession.email),
      });

      const downloadId = generateDownloadId();
      const telemetry: VisitorTelemetryReport = {
        downloadId,
        sessionId: verifiedSession.sessionId,
        ip: ipIntel,
        risk,
        clientTimezone,
        clientLanguage,
        clientScreen,
        referrer,
        userAgent,
        verificationStatus: 'repeat_session',
      };

      const accessPayload: CvAccessPayload = {
        name: verifiedSession.name,
        email: verifiedSession.email,
        phone: verifiedSession.phone,
        reason: verifiedSession.reason,
        action: cleanAction,
        formatLabel: cleanFormat,
        theme: cleanTheme,
        accent: cleanAccent,
      };

      // Dispatch email alert asynchronously/safely without blocking subsequent download if mail blips
      try {
        await sendCvAccessEmail(accessPayload, telemetry, true);
      } catch (emailErr) {
        console.warn(
          'Subsequent CV event email notification failed:',
          emailErr instanceof Error ? emailErr.message : emailErr
        );
      }

      const trackingSummary = buildTrackingSummaryForClient(accessPayload, telemetry, true);
      const telemetryPersistedByServer = await tryPersistCvTracking(trackingSummary);

      res.status(200).json({
        ok: true,
        trackingSummary,
        telemetryPersistedByServer,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unable to record event.';
      console.error('CV subsequent event error:', errMsg);
      res.status(500).json({ error: 'Unable to record export event.' });
    }
  });

  // ——— Portfolio chatbot + OTP-gated live agent ———
  app.get('/api/chat/status', (_req: Request, res: Response) => {
    const stats = getChatStats();
    const chatEnabled = runtimeOwnerPolicy.enablePortfolioChat && !runtimeOwnerPolicy.incidentMode;
    const liveEnabled =
      chatEnabled &&
      runtimeOwnerPolicy.enableLiveChat &&
      (!otpRequiredFor('chat') || isDirectEmailTransportConfigured());
    const voiceSttConfigured = isVoiceSttConfigured();
    const voiceTtsConfigured = isVoiceTtsConfigured();
    const voiceEnabled =
      chatEnabled && runtimeOwnerPolicy.enableVoiceAgent && voiceSttConfigured;
    res.status(200).json({
      ok: true,
      enabled: chatEnabled,
      ownerOnline: stats.ownerOnline,
      liveChatAvailable: liveEnabled,
      requireOtpForChat: otpRequiredFor('chat'),
      llmConfigured: isGrokLlmConfigured() && runtimeOwnerPolicy.enableChatLlm,
      vectorConfigured: isPortfolioVectorConfigured(),
      voiceAgentAvailable: voiceEnabled,
      voiceSttConfigured,
      voiceTtsConfigured,
      limits: {
        maxQuestionsPerVisitor: runtimeOwnerPolicy.chatMaxQuestionsPerVisitor,
        maxLlmPerVisitor: runtimeOwnerPolicy.chatMaxLlmPerVisitor,
        maxLiveSessionsPerVisitor: runtimeOwnerPolicy.chatMaxLiveSessionsPerVisitor,
        maxVoiceTurnsPerVisitor: runtimeOwnerPolicy.chatMaxVoiceTurnsPerVisitor,
        rateWindowHours: runtimeOwnerPolicy.chatRateWindowHours,
      },
      suggestions: runtimeOwnerPolicy.chatShowSuggestions ? listChatSuggestions() : [],
      offerLiveAgent: runtimeOwnerPolicy.chatOfferLiveAgent,
    });
  });

  app.post('/api/chat/ask', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }
      if (rejectDisallowedOrigin(req, res)) return;
      if (!runtimeOwnerPolicy.enablePortfolioChat || runtimeOwnerPolicy.incidentMode) {
        res.status(503).json({ error: 'Portfolio chat is temporarily unavailable.' });
        return;
      }
      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'chat', clientIp, {
          maxRequests: 40,
          error: 'Too many chat questions from this connection. Please wait a few minutes.',
        })
      ) {
        return;
      }
      const raw = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as {
        question?: unknown;
        visitorId?: unknown;
        sessionId?: unknown;
        receipt?: unknown;
      };
      const question = typeof raw.question === 'string' ? raw.question.trim() : '';
      const visitorId = typeof raw.visitorId === 'string' ? raw.visitorId.trim() : '';
      const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.trim() : '';
      const receipt = extractChatReceipt(req, raw.receipt);
      if (question.length < 3) {
        res.status(400).json({ error: 'Please enter a question (at least 3 characters).' });
        return;
      }

      let sessionEmail = '';
      if (sessionId && receipt) {
        const auth = verifyChatSessionReceipt(receipt, sessionId);
        if (!auth.ok) {
          res.status(401).json(chatSessionAuthError(auth));
          return;
        }
        const session = await getChatSessionAsync(sessionId);
        if (!session || session.visitorEmail !== auth.email || session.status === 'closed') {
          res.status(404).json({ error: 'Chat session not found or closed.' });
          return;
        }
        sessionEmail = auth.email;
      }

      // Never trust client visitorId as a quota boundary — IP for anonymous, email after OTP.
      const visitorKey = buildVisitorKey({
        ipAddress: clientIp,
        email: sessionEmail || undefined,
      });
      void visitorId; // retained for future analytics only
      const limitPolicy = chatLimitPolicyFromRuntime(runtimeOwnerPolicy);
      const questionLimit = await consumeChatLimitAsync(visitorKey, 'question', limitPolicy);
      if (!questionLimit.allowed) {
        void emitOwnerAlert({
          eventType: 'chat_limit',
          title: 'Visitor chat question limit reached',
          detail: `A visitor hit the per-window chat question cap (${runtimeOwnerPolicy.chatMaxQuestionsPerVisitor}).`,
          dedupeKey: `chatlimit:${visitorKey}:${Math.floor(Date.now() / 3_600_000)}`,
        });
        res.status(429).json({
          error: questionLimit.reason,
          remaining: questionLimit.remaining,
          resetAtMs: questionLimit.resetAtMs,
        });
        return;
      }

      bumpBotQuestion();
      bumpMetric('chatQuestions');

      const wantLlm =
        runtimeOwnerPolicy.enableChatLlm &&
        isGrokLlmConfigured() &&
        runtimeOwnerPolicy.chatMaxLlmPerVisitor > 0;
      let provider: 'grok' | 'grounded' = 'grounded';
      let answer = await answerPortfolioQuestionSmart(question);

      if (wantLlm && !shouldSkipGrokEnrichment(question, answer)) {
        const llmCheck = await checkChatLimitAsync(visitorKey, 'llm', limitPolicy);
        if (llmCheck.allowed) {
          const enriched = await enrichAnswerWithGrokLlm(question, {
            apiKey: process.env.GROK_API_KEY || '',
            modelId: runtimeOwnerPolicy.chatLlmModel,
            grounded: answer,
          });
          answer = {
            ...enriched.answer,
            followUps: enriched.answer.followUps?.length
              ? enriched.answer.followUps
              : answer.followUps,
            retrieval: answer.retrieval,
            retrievalContext: answer.retrievalContext,
          };
          provider = enriched.provider;
          // Only spend LLM quota when Grok actually returned an enriched answer.
          if (enriched.provider === 'grok') {
            await consumeChatLimitAsync(visitorKey, 'llm', limitPolicy);
            bumpLlmCall(true);
          } else {
            bumpLlmCall(false);
          }
        }
      }

      if (!runtimeOwnerPolicy.chatOfferLiveAgent) {
        answer = { ...answer, offerLiveAgent: false };
      }

      if (sessionId && sessionEmail) {
        appendChatMessage(sessionId, 'visitor', question);
        appendChatMessage(sessionId, 'bot', answer.answer);
      }

      const llmRemaining = (await checkChatLimitAsync(visitorKey, 'llm', limitPolicy)).remaining;
      const session = sessionId ? await getChatSessionAsync(sessionId) : null;

      res.status(200).json({
        ok: true,
        ...answer,
        provider,
        ownerOnline: isOwnerOnline(),
        remaining: {
          questions: questionLimit.remaining,
          llm: llmRemaining,
        },
        limits: {
          maxQuestionsPerVisitor: runtimeOwnerPolicy.chatMaxQuestionsPerVisitor,
          maxLlmPerVisitor: runtimeOwnerPolicy.chatMaxLlmPerVisitor,
          rateWindowHours: runtimeOwnerPolicy.chatRateWindowHours,
        },
        resetAtMs: questionLimit.resetAtMs,
        session: session ? publicSessionView(session, { threadOnly: true }) : undefined,
      });
    } catch {
      res.status(500).json({ error: 'Unable to answer right now. Please try again.' });
    }
  });


  app.post('/api/chat/voice/turn', async (req: Request, res: Response) => {
    try {
      if (rejectDisallowedOrigin(req, res)) return;
      if (!runtimeOwnerPolicy.enablePortfolioChat || runtimeOwnerPolicy.incidentMode) {
        res.status(503).json({ error: 'Portfolio chat is temporarily unavailable.' });
        return;
      }
      if (!runtimeOwnerPolicy.enableVoiceAgent || !isVoiceSttConfigured()) {
        res.status(503).json({ error: 'Voice agent is temporarily unavailable.' });
        return;
      }

      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'chat', `voice:${clientIp}`, {
          maxRequests: 20,
          error: 'Too many voice turns from this connection. Please wait a few minutes.',
        })
      ) {
        return;
      }

      let parsed;
      try {
        parsed = await parseMultipartAudio(req, { maxBytes: VOICE_AUDIO_MAX_BYTES });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid audio upload.';
        res.status(400).json({ error: message });
        return;
      }

      const sessionId =
        typeof parsed.fields.sessionId === 'string' ? parsed.fields.sessionId.trim() : '';
      const receipt = extractChatReceipt(req, parsed.fields.receipt);
      void parsed.fields.visitorId;

      let sessionEmail = '';
      if (sessionId && receipt) {
        const auth = verifyChatSessionReceipt(receipt, sessionId);
        if (!auth.ok) {
          res.status(401).json(chatSessionAuthError(auth));
          return;
        }
        const session = await getChatSessionAsync(sessionId);
        if (!session || session.visitorEmail !== auth.email || session.status === 'closed') {
          res.status(404).json({ error: 'Chat session not found or closed.' });
          return;
        }
        sessionEmail = auth.email;
      }

      const visitorKey = buildVisitorKey({
        ipAddress: clientIp,
        email: sessionEmail || undefined,
      });
      const limitPolicy = chatLimitPolicyFromRuntime(runtimeOwnerPolicy);

      const voiceLimit = await consumeChatLimitAsync(visitorKey, 'voice', limitPolicy);
      if (!voiceLimit.allowed) {
        void emitOwnerAlert({
          eventType: 'chat_limit',
          title: 'Visitor voice turn limit reached',
          detail: `A visitor hit the per-window voice turn cap (${runtimeOwnerPolicy.chatMaxVoiceTurnsPerVisitor}).`,
          dedupeKey: `voiceLimit:${visitorKey}:${Math.floor(Date.now() / 3_600_000)}`,
        });
        res.status(429).json({
          error: voiceLimit.reason,
          remaining: voiceLimit.remaining,
          resetAtMs: voiceLimit.resetAtMs,
        });
        return;
      }

      const questionLimit = await consumeChatLimitAsync(visitorKey, 'question', limitPolicy);
      if (!questionLimit.allowed) {
        void emitOwnerAlert({
          eventType: 'chat_limit',
          title: 'Visitor chat question limit reached',
          detail: `A visitor hit the per-window chat question cap (${runtimeOwnerPolicy.chatMaxQuestionsPerVisitor}).`,
          dedupeKey: `chatlimit:${visitorKey}:${Math.floor(Date.now() / 3_600_000)}`,
        });
        res.status(429).json({
          error: questionLimit.reason,
          remaining: questionLimit.remaining,
          resetAtMs: questionLimit.resetAtMs,
        });
        return;
      }

      bumpBotQuestion();
      bumpMetric('chatQuestions');

      const wantLlm =
        runtimeOwnerPolicy.enableChatLlm &&
        isGrokLlmConfigured() &&
        runtimeOwnerPolicy.chatMaxLlmPerVisitor > 0;

      let llmAllowed = false;
      if (wantLlm) {
        const llmCheck = await checkChatLimitAsync(visitorKey, 'llm', limitPolicy);
        llmAllowed = llmCheck.allowed;
      }

      const turn = await runVoiceTurn({
        audio: parsed.buffer,
        mimeType: parsed.mimeType,
        filename: parsed.filename,
        enableLlm: llmAllowed,
        grokApiKey: process.env.GROK_API_KEY || '',
        chatLlmModel: runtimeOwnerPolicy.chatLlmModel,
        offerLiveAgent: runtimeOwnerPolicy.chatOfferLiveAgent,
        enableCloudTts: isVoiceTtsConfigured(),
      });

      if (!turn.ok || !turn.answer || !turn.transcript) {
        res.status(400).json({
          error: turn.error || 'Unable to process voice turn.',
          transcript: turn.transcript,
        });
        return;
      }

      if (turn.llmUsed) {
        await consumeChatLimitAsync(visitorKey, 'llm', limitPolicy);
        bumpLlmCall(true);
      } else if (llmAllowed) {
        bumpLlmCall(false);
      }

      if (sessionId && sessionEmail) {
        appendChatMessage(sessionId, 'visitor', turn.transcript);
        appendChatMessage(sessionId, 'bot', turn.answer.answer);
      }

      const llmRemaining = (await checkChatLimitAsync(visitorKey, 'llm', limitPolicy)).remaining;
      const voiceRemaining = (await checkChatLimitAsync(visitorKey, 'voice', limitPolicy)).remaining;
      const session = sessionId ? await getChatSessionAsync(sessionId) : null;

      res.status(200).json({
        ok: true,
        transcript: turn.transcript,
        ...turn.answer,
        provider: turn.provider || 'grounded',
        ttsProvider: turn.ttsProvider || 'none',
        audioBase64: turn.audioBase64,
        audioMimeType: turn.audioMimeType,
        ownerOnline: isOwnerOnline(),
        remaining: {
          questions: questionLimit.remaining,
          llm: llmRemaining,
          voice: voiceRemaining,
        },
        limits: {
          maxQuestionsPerVisitor: runtimeOwnerPolicy.chatMaxQuestionsPerVisitor,
          maxLlmPerVisitor: runtimeOwnerPolicy.chatMaxLlmPerVisitor,
          maxVoiceTurnsPerVisitor: runtimeOwnerPolicy.chatMaxVoiceTurnsPerVisitor,
          rateWindowHours: runtimeOwnerPolicy.chatRateWindowHours,
        },
        resetAtMs: questionLimit.resetAtMs,
        session: session ? publicSessionView(session, { threadOnly: true }) : undefined,
      });
    } catch {
      res.status(500).json({ error: 'Unable to process voice turn right now. Please try again.' });
    }
  });

  app.post('/api/chat/live/start', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }
      if (rejectDisallowedOrigin(req, res)) return;
      if (
        !runtimeOwnerPolicy.enablePortfolioChat ||
        !runtimeOwnerPolicy.enableLiveChat ||
        runtimeOwnerPolicy.incidentMode
      ) {
        res.status(503).json({ error: 'Live chat is temporarily unavailable.' });
        return;
      }
      const requireChatOtp = otpRequiredFor('chat');
      if (requireChatOtp && !isDirectEmailTransportConfigured()) {
        res.status(503).json({
          error: 'Live chat verification is temporarily unavailable. Please use the contact form instead.',
        });
        return;
      }
      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'chat', `live:${clientIp}`, {
          maxRequests: 12,
          error: 'Too many live-chat requests. Please wait a few minutes.',
        })
      ) {
        return;
      }

      const raw = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as {
        name?: unknown;
        email?: unknown;
        company?: unknown;
        interest?: unknown;
        openingMessage?: unknown;
        website?: unknown;
        turnstileToken?: unknown;
        theme?: unknown;
        accent?: unknown;
      };
      if (isHoneypotTriggered(raw.website)) {
        res.status(200).json({
          ok: true,
          status: 'otp_required',
          challengeId: 'filtered',
          challengeToken: 'filtered',
          maskedEmail: 'hidden@example.com',
        });
        return;
      }
      if (await rejectFailedTurnstile(req, res, raw)) return;

      const name = typeof raw.name === 'string' ? sanitizeHeaderValue(raw.name).slice(0, 120) : '';
      const email = typeof raw.email === 'string' ? sanitizeHeaderValue(raw.email).slice(0, 254) : '';
      const company =
        typeof raw.company === 'string' ? sanitizeHeaderValue(raw.company).slice(0, 120) : '';
      const interest =
        typeof raw.interest === 'string' ? sanitizeHeaderValue(raw.interest).slice(0, 160) : '';
      const openingMessage =
        typeof raw.openingMessage === 'string' ? raw.openingMessage.trim().slice(0, 2000) : '';
      const theme = parseEmailTheme(raw.theme);
      const accent = parseEmailAccent(raw.accent);

      if (!name || name.length < 2) {
        res.status(400).json({ error: 'Please enter your name.' });
        return;
      }
      if (!isValidEmailAddress(email)) {
        res.status(400).json({
          error: requireChatOtp
            ? 'Please provide a valid email address for OTP verification.'
            : 'Please provide a valid email address.',
        });
        return;
      }
      const mxCheck = await verifyEmailMxRecord(email);
      if (!mxCheck.ok) {
        res.status(400).json({ error: mxCheck.reason || 'Please provide a valid, active email domain.' });
        return;
      }

      const accessCheck = evaluateAccessRules(runtimeOwnerPolicy.rules, {
        email,
        ipAddress: clientIp,
      });
      if (accessCheck.blocked) {
        res.status(403).json({ error: 'This email or network address is restricted from live chat.' });
        return;
      }

      const liveVisitorKey = buildVisitorKey({ ipAddress: clientIp, email });
      const liveLimit = await checkChatLimitAsync(
        liveVisitorKey,
        'live',
        chatLimitPolicyFromRuntime(runtimeOwnerPolicy)
      );
      if (!liveLimit.allowed) {
        res.status(429).json({
          error: liveLimit.reason,
          remaining: liveLimit.remaining,
          resetAtMs: liveLimit.resetAtMs,
        });
        return;
      }

      bumpLiveRequest();
      const userAgent =
        typeof req.headers['user-agent'] === 'string'
          ? sanitizeHeaderValue(req.headers['user-agent']).slice(0, 220)
          : 'Unknown';

      if (!requireChatOtp) {
        const consumed = await consumeChatLimitAsync(
          liveVisitorKey,
          'live',
          chatLimitPolicyFromRuntime(runtimeOwnerPolicy)
        );
        if (!consumed.allowed) {
          res.status(429).json({
            error: consumed.reason,
            remaining: consumed.remaining,
            resetAtMs: consumed.resetAtMs,
          });
          return;
        }
        bumpMetric('chatLiveStarts');
        const session = createChatSession({
          visitorName: name,
          visitorEmail: email.toLowerCase(),
          ipAddress: clientIp,
          userAgent,
          openingMessage,
          company,
          interest,
        });
        const sessionReceipt = signChatSessionReceipt(session.sessionId, email.toLowerCase());
        void emitOwnerAlert({
          eventType: 'live_chat',
          title: `New chat from ${name} (OTP bypassed)`,
          detail: `${email}${company ? ` · ${company}` : ''}${
            interest ? ` · ${interest}` : ''
          } · session ${session.sessionId} · owner ${isOwnerOnline() ? 'online' : 'offline/queued'}`,
          dedupeKey: `live:${session.sessionId}`,
          theme,
          accent,
        });
        res.status(200).json({
          ok: true,
          status: 'live',
          sessionReceipt,
          session: publicSessionView(session, { threadOnly: true }),
          ownerOnline: isOwnerOnline(),
          suggestions: runtimeOwnerPolicy.chatShowSuggestions ? listChatSuggestions() : [],
          remaining: { live: consumed.remaining },
          resetAtMs: consumed.resetAtMs,
        });
        return;
      }

      const otpKey = `chat:${email.toLowerCase()}`;
      if (
        await enforceRateLimit(res, 'otp-email', otpKey, {
          maxRequests: 5,
          error: 'Too many verification codes sent to this email. Please wait a few minutes.',
        })
      ) {
        return;
      }

      const challenge = await createOtpChallengeAsync(
        chatLiveOtpStore,
        {
          name,
          email: email.toLowerCase(),
          company,
          interest,
          openingMessage,
          theme,
          accent,
          userAgent,
          ipAddress: clientIp,
        },
        OTP_SECRET
      );
      bumpMetric('otpIssued');
      await sendVisitorOtpEmail({
        email,
        name,
        code: challenge.code,
        theme,
        accent,
        purpose: 'chat',
      });
      res.status(200).json({
        ok: true,
        status: 'otp_required',
        challengeId: challenge.challengeId,
        challengeToken: challenge.challengeToken,
        maskedEmail: maskEmailAddress(email),
        expiresInMinutes: 10,
        ownerOnline: isOwnerOnline(),
        message: `Verification code sent to ${maskEmailAddress(email)}.`,
      });
    } catch (error) {
      void captureException(error, { route: '/api/chat/live/start' });
      console.error('Chat live start error:', error instanceof Error ? error.message : error);
      res.status(500).json({ error: 'Unable to start live chat verification right now.' });
    }
  });

  app.post('/api/chat/live/verify', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }
      if (rejectDisallowedOrigin(req, res)) return;
      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'chat', `verify:${clientIp}`, {
          maxRequests: 20,
          error: 'Too many verification attempts. Please wait a few minutes.',
        })
      ) {
        return;
      }

      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {}) as { challengeId?: unknown; challengeToken?: unknown; code?: unknown };
      const challengeId = typeof body.challengeId === 'string' ? body.challengeId.trim() : '';
      const challengeToken = typeof body.challengeToken === 'string' ? body.challengeToken.trim() : '';
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      if (!challengeId || !challengeToken || !/^\d{6}$/.test(code.replace(/\s+/g, ''))) {
        res.status(400).json({ error: 'Please enter the valid 6-digit verification code.' });
        return;
      }

      const verified = await verifyOtpChallengeAsync(
        chatLiveOtpStore,
        { challengeId, challengeToken, code },
        OTP_SECRET
      );
      if (!verified.ok) {
        res.status(400).json({ error: verified.error });
        return;
      }

      const p = verified.payload;
      const liveVisitorKey = buildVisitorKey({
        ipAddress: p.ipAddress || clientIp,
        email: p.email,
      });
      const liveLimit = await consumeChatLimitAsync(
        liveVisitorKey,
        'live',
        chatLimitPolicyFromRuntime(runtimeOwnerPolicy)
      );
      if (!liveLimit.allowed) {
        res.status(429).json({
          error: liveLimit.reason,
          remaining: liveLimit.remaining,
          resetAtMs: liveLimit.resetAtMs,
        });
        return;
      }

      bumpMetric('otpVerified');
      bumpMetric('chatLiveStarts');
      const session = createChatSession({
        visitorName: p.name,
        visitorEmail: p.email,
        ipAddress: p.ipAddress || clientIp,
        userAgent: p.userAgent,
        openingMessage: p.openingMessage,
        company: p.company,
        interest: p.interest,
      });
      const sessionReceipt = signChatSessionReceipt(session.sessionId, p.email);

      void emitOwnerAlert({
        eventType: 'live_chat',
        title: `New verified chat from ${p.name}`,
        detail: `${p.email}${p.company ? ` · ${p.company}` : ''}${
          p.interest ? ` · ${p.interest}` : ''
        } · session ${session.sessionId} · owner ${isOwnerOnline() ? 'online' : 'offline/queued'}`,
        dedupeKey: `live:${session.sessionId}`,
        theme: p.theme,
        accent: p.accent,
      });

      res.status(200).json({
        ok: true,
        status: 'live',
        sessionReceipt,
        session: publicSessionView(session, { threadOnly: true }),
        ownerOnline: isOwnerOnline(),
        suggestions: runtimeOwnerPolicy.chatShowSuggestions ? listChatSuggestions() : [],
        remaining: { live: liveLimit.remaining },
        resetAtMs: liveLimit.resetAtMs,
      });
    } catch (error) {
      console.error('Chat live verify error:', error instanceof Error ? error.message : error);
      res.status(500).json({ error: 'Unable to complete live chat verification.' });
    }
  });

  function extractChatReceipt(req: Request, bodyReceipt?: unknown): string | undefined {
    return extractChatReceiptToken({
      headers: req.headers as Record<string, string | string[] | undefined>,
      bodyReceipt,
      // Never accept query receipts — they leak via access logs and Referer.
      allowQuery: false,
    });
  }

  app.get('/api/chat/live/:sessionId', async (req: Request, res: Response) => {
    const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : '';
    const receipt = extractChatReceipt(req);
    const auth = verifyChatSessionReceipt(receipt, sessionId);
    if (!auth.ok) {
      res.status(401).json(chatSessionAuthError(auth));
      return;
    }
    const session = await getChatSessionAsync(sessionId);
    if (!session || session.visitorEmail !== auth.email) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }
    res.status(200).json({
      ok: true,
      session: publicSessionView(session, { threadOnly: true }),
      ownerOnline: isOwnerOnline(),
    });
  });

  app.post('/api/chat/live/:sessionId/message', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }
      if (rejectDisallowedOrigin(req, res)) return;
      const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : '';
      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {}) as { receipt?: unknown; text?: unknown };
      const receipt = extractChatReceipt(req, body.receipt);
      const auth = verifyChatSessionReceipt(receipt, sessionId);
      if (!auth.ok) {
        res.status(401).json(chatSessionAuthError(auth));
        return;
      }
      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'chat', `msg:${clientIp}`, {
          maxRequests: 60,
          error: 'Too many chat messages. Please slow down.',
        })
      ) {
        return;
      }
      const text = typeof body.text === 'string' ? body.text : '';
      const session = await getChatSessionAsync(sessionId);
      if (!session || session.visitorEmail !== auth.email) {
        res.status(404).json({ error: 'Chat session not found.' });
        return;
      }
      const updated = appendChatMessage(sessionId, 'visitor', text);
      if (!updated) {
        res.status(400).json({ error: 'Unable to send message (session may be closed).' });
        return;
      }
      res.status(200).json({
        ok: true,
        session: publicSessionView(updated, { threadOnly: true }),
        ownerOnline: isOwnerOnline(),
      });
    } catch {
      res.status(500).json({ error: 'Unable to send chat message.' });
    }
  });

  app.post('/api/chat/live/:sessionId/new', async (req: Request, res: Response) => {
    try {
      if (rejectDisallowedOrigin(req, res)) return;
      const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : '';
      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {}) as { receipt?: unknown };
      const receipt = extractChatReceipt(req, body.receipt);
      const auth = verifyChatSessionReceipt(receipt, sessionId);
      if (!auth.ok) {
        res.status(401).json(chatSessionAuthError(auth));
        return;
      }
      const clientIp = extractClientIp(req);
      if (
        await enforceRateLimit(res, 'chat', `new:${clientIp}`, {
          maxRequests: 20,
          error: 'Too many new-chat requests. Please wait a moment.',
        })
      ) {
        return;
      }
      const session = await getChatSessionAsync(sessionId);
      if (!session || session.visitorEmail !== auth.email) {
        res.status(404).json({ error: 'Chat session not found.' });
        return;
      }
      const updated = startNewChatThread(sessionId);
      if (!updated) {
        res.status(400).json({ error: 'Unable to start a new chat (session may be closed).' });
        return;
      }
      res.status(200).json({
        ok: true,
        session: publicSessionView(updated, { threadOnly: true }),
        ownerOnline: isOwnerOnline(),
        suggestions: runtimeOwnerPolicy.chatShowSuggestions ? listChatSuggestions() : [],
      });
    } catch {
      res.status(500).json({ error: 'Unable to start a new chat right now.' });
    }
  });

  app.post('/api/owner/presence', async (req: Request, res: Response) => {
    const authCheck = await verifyConsoleActorToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(401).json({ error: authCheck.error });
      return;
    }
    if (
      await enforceRateLimit(res, 'chat', `owner-presence:${authCheck.uid}`, {
        maxRequests: 120,
        error: 'Owner presence rate limit exceeded.',
      })
    ) {
      return;
    }
    const raw =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as { online?: unknown })
        : {};
    // Default keeps heartbeat behavior; explicit online:false clears on logout.
    if (raw.online === false) {
      clearOwnerPresence();
    } else {
      touchOwnerPresence();
    }
    res.status(200).json({ ok: true, ...getChatStats() });
  });

  app.get('/api/owner/chat/sessions', async (req: Request, res: Response) => {
    const authCheck = await verifyConsoleActorToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(401).json({ error: authCheck.error });
      return;
    }
    if (
      await enforceRateLimit(res, 'chat', `owner-sessions:${authCheck.uid}`, {
        maxRequests: 120,
        error: 'Owner chat sessions rate limit exceeded.',
      })
    ) {
      return;
    }
    touchOwnerPresence();
    // Cloud Run instances start empty; rehydrate from Redis before listing.
    await ensureChatCacheHydrated().catch(() => false);
    res.status(200).json({
      ok: true,
      stats: {
        ...getChatStats(),
        usage: getChatUsageTotals(),
        policy: {
          enablePortfolioChat: runtimeOwnerPolicy.enablePortfolioChat,
          enableLiveChat: runtimeOwnerPolicy.enableLiveChat,
          enableChatLlm: runtimeOwnerPolicy.enableChatLlm,
          chatMaxQuestionsPerVisitor: runtimeOwnerPolicy.chatMaxQuestionsPerVisitor,
          chatMaxLlmPerVisitor: runtimeOwnerPolicy.chatMaxLlmPerVisitor,
          chatMaxLiveSessionsPerVisitor: runtimeOwnerPolicy.chatMaxLiveSessionsPerVisitor,
          chatRateWindowHours: runtimeOwnerPolicy.chatRateWindowHours,
          chatLlmModel: runtimeOwnerPolicy.chatLlmModel,
          chatShowSuggestions: runtimeOwnerPolicy.chatShowSuggestions,
          chatOfferLiveAgent: runtimeOwnerPolicy.chatOfferLiveAgent,
          llmConfigured: isGrokLlmConfigured(),
        },
      },
      sessions: listChatSessions().map((s) => publicSessionView(s)),
    });
  });

  app.post('/api/owner/chat/reply', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }
      if (rejectDisallowedOrigin(req, res)) return;
      const authCheck = await verifyConsoleActorToken(req.headers.authorization);
      if (!authCheck.ok) {
        res.status(401).json({ error: authCheck.error });
        return;
      }
      if (
        await enforceRateLimit(res, 'chat', `owner-reply:${authCheck.uid}`, {
          maxRequests: 60,
          error: 'Owner chat reply rate limit exceeded.',
        })
      ) {
        return;
      }
      touchOwnerPresence();
      const raw = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as {
        sessionId?: unknown;
        text?: unknown;
      };
      const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.trim() : '';
      const text = typeof raw.text === 'string' ? raw.text : '';
      const updated = appendChatMessage(sessionId, 'owner', text);
      if (!updated) {
        res.status(400).json({ error: 'Unable to reply (invalid or closed session).' });
        return;
      }
      res.status(200).json({ ok: true, session: publicSessionView(updated) });
    } catch {
      res.status(500).json({ error: 'Unable to send owner chat reply.' });
    }
  });

  app.post('/api/owner/chat/close', async (req: Request, res: Response) => {
    const authCheck = await verifyConsoleActorToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(401).json({ error: authCheck.error });
      return;
    }
    if (
      await enforceRateLimit(res, 'chat', `owner-close:${authCheck.uid}`, {
        maxRequests: 60,
        error: 'Owner chat close rate limit exceeded.',
      })
    ) {
      return;
    }
    const raw = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as {
      sessionId?: unknown;
    };
    const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.trim() : '';
    const closed = closeChatSession(sessionId);
    if (!closed) {
      res.status(404).json({ error: 'Chat session not found.' });
      return;
    }
    res.status(200).json({ ok: true, session: publicSessionView(closed) });
  });

  // Express 5 / path-to-regexp require named wildcards (bare `/api/*` crashes startup).
  app.all('/api/{*splat}', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  const applyDynamicOgTags = (html: string, req: Request): string => {
    const cvParam = typeof req.query.cv === 'string' ? req.query.cv.toLowerCase() : '';
    const skillParam = typeof req.query.skill === 'string' ? req.query.skill.trim().slice(0, 60) : '';
    const trackParam = typeof req.query.track === 'string' ? req.query.track.toLowerCase() : '';
    const themeParam = req.query.theme === 'light' ? 'light' : 'dark';

    const mappedTrack: ShareTrackId | null =
      trackParam === 'security' || cvParam === 'security'
        ? 'security'
        : trackParam === 'platform' || cvParam === 'platform'
          ? 'platform'
          : trackParam === 'ai'
            ? 'ai'
            : trackParam === 'executive' || Boolean(cvParam)
              ? 'executive'
              : null;

    if (!mappedTrack && !skillParam) return html;

    const baseUrl = resolveSafeBaseUrl(
      {
        appUrl: process.env.APP_URL,
        protoHeader: req.headers['x-forwarded-proto'],
        hostHeader: req.headers['x-forwarded-host'] || req.headers.host,
        protocol: req.protocol,
      },
      ALLOWED_ORIGINS
    );

    const trackMeta =
      SHARE_CARD_TRACKS.find((t) => t.id === (mappedTrack ?? 'executive')) ??
      SHARE_CARD_TRACKS[0];

    const dynamicTitle = skillParam
      ? `Mohammed Sufyan — ${escapeHtml(skillParam)} Architecture`
      : escapeHtml(trackMeta.headline);
    const dynamicDesc = skillParam
      ? `Verified enterprise experience, production systems, and credentials in ${escapeHtml(skillParam)}.`
      : escapeHtml(`${trackMeta.subline} — ${trackMeta.kicker}`);

    const ogImgQuery = new URLSearchParams();
    ogImgQuery.set('track', mappedTrack ?? 'executive');
    ogImgQuery.set('theme', themeParam);
    if (skillParam) ogImgQuery.set('skill', skillParam);
    const dynamicImage = escapeHtml(`${baseUrl}/api/og-card.svg?${ogImgQuery.toString()}`);

    return html
      .replace(/<title>[^<]*<\/title>/, `<title>${dynamicTitle}</title>`)
      .replace(
        /<meta property="og:title" content="[^"]*"\s*\/>/,
        `<meta property="og:title" content="${dynamicTitle}" />`
      )
      .replace(
        /<meta property="og:description" content="[^"]*"\s*\/>/,
        `<meta property="og:description" content="${dynamicDesc}" />`
      )
      .replace(
        /<meta property="og:image" content="[^"]*"\s*\/>/,
        `<meta property="og:image" content="${dynamicImage}" />`
      )
      .replace(
        /<meta property="og:image:type" content="[^"]*"\s*\/>/,
        `<meta property="og:image:type" content="image/svg+xml" />`
      )
      .replace(
        /<meta name="twitter:title" content="[^"]*"\s*\/>/,
        `<meta name="twitter:title" content="${dynamicTitle}" />`
      )
      .replace(
        /<meta name="twitter:description" content="[^"]*"\s*\/>/,
        `<meta name="twitter:description" content="${dynamicDesc}" />`
      )
      .replace(
        /<meta name="twitter:image" content="[^"]*"\s*\/>/,
        `<meta name="twitter:image" content="${dynamicImage}" />`
      );
  };

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.get('/', async (req: Request, res: Response, next: NextFunction) => {
      if (!req.query.cv && !req.query.skill && !req.query.track) {
        return next();
      }
      try {
        const raw = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, applyDynamicOgTags(raw, req));
        res.status(200).setHeader('Content-Type', 'text/html').send(transformed);
      } catch (e) {
        next(e);
      }
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.get('/{*splat}', (req: Request, res: Response) => {
      if (!fs.existsSync(indexPath)) {
        res.status(503).send('Production build not found. Run npm run build first.');
        return;
      }
      const raw = fs.readFileSync(indexPath, 'utf-8');
      res.status(200).setHeader('Content-Type', 'text/html').send(applyDynamicOgTags(raw, req));
    });
  }

  // Rehydrate Owner Chat from Redis before serving traffic (Cloud Run cold start).
  await ensureChatCacheHydrated().catch(() => false);

  const shutdown = (signal: string) => {
    try {
      flushChatCacheSync();
    } catch {
      /* ignore */
    }
    console.log(`Received ${signal}; chat cache flushed.`);
    process.exit(0);
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
