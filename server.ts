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
  createRateLimitBucket,
  escapeHtml,
  isAiStudioPreviewHost,
  isAllowedRequestOrigin,
  isFormSubmitFallbackAllowed,
  isHoneypotTriggered,
  isRateLimited,
  isValidEmailAddress,
  isValidPhoneNumber,
  rateLimitRetryAfterSeconds,
  resolveAllowedOrigins,
  sanitizeDisplayName,
  sanitizeHeaderValue,
  shouldAllowPreviewIframe,
  verifyTurnstileToken,
} from './server/security.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DESTINATION_EMAIL = process.env.CONTACT_TO_EMAIL || 'sufyan.net@gmail.com';
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY?.trim() || '';
const ALLOWED_ORIGINS = resolveAllowedOrigins(process.env.APP_URL, PORT);
const contactRateLimitMap = createRateLimitBucket();
const cvAccessRateLimitMap = createRateLimitBucket();

interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

function buildPortfolioEmailHtml(payload: ContactPayload, timestamp: string): string {
  const safeName = escapeHtml(payload.name);
  const safeEmail = escapeHtml(payload.email);
  const safePhone = payload.phone ? escapeHtml(payload.phone) : 'Not provided';
  const safeSubject = payload.subject ? escapeHtml(payload.subject) : 'Portfolio Architecture Inquiry';
  const safeMessage = escapeHtml(payload.message).replace(/\r?\n/g, '<br />');
  const safeTime = escapeHtml(timestamp);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Portfolio Inquiry — ${safeName}</title>
</head>
<body style="margin:0;padding:0;background-color:#06080d;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#06080d;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background-color:#0d121f;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 28px;background-color:#080b13;border-bottom:1px solid #1e293b;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width:38px;height:38px;border-radius:10px;background-color:#083344;border:1px solid #06b6d4;text-align:center;vertical-align:middle;font-weight:700;font-size:14px;color:#38bdf8;font-family:monospace;">
                          MS
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">
                            MOHAMMED SUFYAN
                          </div>
                          <div style="font-size:11px;font-family:monospace;color:#38bdf8;text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">
                            Portfolio Inbound Transmission
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:5px 10px;border-radius:6px;background-color:#083344;border:1px solid #0891b2;color:#38bdf8;font-size:10px;font-family:monospace;font-weight:700;letter-spacing:0.08em;">
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
              <div style="font-size:11px;font-family:monospace;color:#38bdf8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
                NEW MESSAGE RECEIVED
              </div>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                ${safeSubject}
              </h1>
              <p style="margin:8px 0 0 0;font-size:12px;font-family:monospace;color:#94a3b8;">
                Received ${safeTime}
              </p>
            </td>
          </tr>

          <!-- Sender Details Card -->
          <tr>
            <td style="padding:8px 28px 16px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#090d16;border:1px solid #1e293b;border-radius:12px;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #1e293b;width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">
                      Sender Name
                    </div>
                    <div style="font-size:14px;font-weight:600;color:#f8fafc;margin-top:4px;">
                      ${safeName}
                    </div>
                  </td>
                  <td style="padding:14px 18px;border-bottom:1px solid #1e293b;border-left:1px solid #1e293b;width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">
                      Sender Email
                    </div>
                    <div style="font-size:14px;font-weight:600;color:#38bdf8;margin-top:4px;">
                      <a href="mailto:${safeEmail}" style="color:#38bdf8;text-decoration:none;">${safeEmail}</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">
                      Phone Number
                    </div>
                    <div style="font-size:13px;font-family:monospace;color:#cbd5e1;margin-top:4px;">
                      ${safePhone}
                    </div>
                  </td>
                  <td style="padding:14px 18px;border-left:1px solid #1e293b;width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">
                      Subject / Intent
                    </div>
                    <div style="font-size:13px;color:#cbd5e1;margin-top:4px;">
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
              <div style="background-color:#090d16;border:1px solid #1e293b;border-left:3px solid #38bdf8;border-radius:12px;padding:18px 20px;">
                <div style="font-size:10px;font-family:monospace;color:#38bdf8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">
                  Message Details
                </div>
                <div style="font-size:14px;line-height:1.65;color:#e2e8f0;">
                  ${safeMessage}
                </div>
              </div>
            </td>
          </tr>

          <!-- Action CTA -->
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <a href="mailto:${encodeURIComponent(payload.email)}?subject=${encodeURIComponent(`Re: ${payload.subject || 'Portfolio Inquiry'}`)}" style="display:inline-block;padding:11px 20px;background-color:#38bdf8;color:#020617;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">
                Reply to ${safeName}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px;background-color:#05070b;border-top:1px solid #1e293b;font-size:11px;font-family:monospace;color:#64748b;">
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
    `Name:     ${payload.name}`,
    `Email:    ${payload.email}`,
    `Phone:    ${payload.phone || 'Not provided'}`,
    `Subject:  ${payload.subject || 'Portfolio Architecture Inquiry'}`,
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
}

function formatCvActionLabel(action: CvAccessPayload['action']): string {
  if (action === 'print') return 'Browser Print';
  if (action === 'ats') return 'ATS Plain-Text Copy';
  if (action === 'install') return 'App Install';
  return 'PDF Download';
}

function buildCvAccessEmailHtml(payload: CvAccessPayload, timestamp: string, userAgent: string): string {
  const safeName = escapeHtml(payload.name?.trim() || 'Not provided');
  const safeEmail = payload.email?.trim() ? escapeHtml(payload.email.trim()) : '';
  const safePhone = payload.phone?.trim() ? escapeHtml(payload.phone.trim()) : 'Not provided';
  const safeFormat = escapeHtml(payload.formatLabel || 'Executive Summary');
  const safeAction = formatCvActionLabel(payload.action);
  const safeReason = escapeHtml(payload.reason).replace(/\r?\n/g, '<br />');
  const safeTime = escapeHtml(timestamp);
  const safeUa = escapeHtml(userAgent.slice(0, 180) || 'Unknown client');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CV Export Alert — ${safeName}</title>
</head>
<body style="margin:0;padding:0;background-color:#06080d;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#06080d;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background-color:#0d121f;border:1px solid #1e293b;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 28px;background-color:#080b13;border-bottom:1px solid #1e293b;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width:38px;height:38px;border-radius:10px;background-color:#083344;border:1px solid #06b6d4;text-align:center;vertical-align:middle;font-weight:700;font-size:14px;color:#38bdf8;font-family:monospace;">
                          MS
                        </td>
                        <td style="padding-left:12px;">
                          <div style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">
                            MOHAMMED SUFYAN
                          </div>
                          <div style="font-size:11px;font-family:monospace;color:#38bdf8;text-transform:uppercase;letter-spacing:0.08em;margin-top:2px;">
                            CV Export &amp; Access Alert
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;padding:5px 10px;border-radius:6px;background-color:#064e3b;border:1px solid #10b981;color:#6ee7b7;font-size:10px;font-family:monospace;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
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
              <div style="font-size:11px;font-family:monospace;color:#38bdf8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
                RESUME / PORTFOLIO ACCESSED
              </div>
              <h1 style="margin:0;font-size:21px;font-weight:700;color:#ffffff;line-height:1.3;">
                ${safeFormat} (${safeAction})
              </h1>
              <p style="margin:8px 0 0 0;font-size:12px;font-family:monospace;color:#94a3b8;">
                Exported ${safeTime}
              </p>
            </td>
          </tr>

          <!-- Visitor Details Grid -->
          <tr>
            <td style="padding:8px 28px 16px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#090d16;border:1px solid #1e293b;border-radius:12px;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #1e293b;width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">
                      Visitor Name
                    </div>
                    <div style="font-size:14px;font-weight:600;color:#f8fafc;margin-top:4px;">
                      ${safeName}
                    </div>
                  </td>
                  <td style="padding:14px 18px;border-bottom:1px solid #1e293b;border-left:1px solid #1e293b;width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">
                      Email ID
                    </div>
                    <div style="font-size:14px;font-weight:600;color:#38bdf8;margin-top:4px;">
                      ${safeEmail ? `<a href="mailto:${safeEmail}" style="color:#38bdf8;text-decoration:none;">${safeEmail}</a>` : '<span style="color:#94a3b8;font-weight:400;">Not provided</span>'}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">
                      Phone Number
                    </div>
                    <div style="font-size:13px;font-family:monospace;color:#cbd5e1;margin-top:4px;">
                      ${safePhone}
                    </div>
                  </td>
                  <td style="padding:14px 18px;border-left:1px solid #1e293b;width:50%;">
                    <div style="font-size:10px;font-family:monospace;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">
                      Export Format
                    </div>
                    <div style="font-size:13px;color:#cbd5e1;margin-top:4px;">
                      ${safeFormat}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Reason / Purpose -->
          <tr>
            <td style="padding:8px 28px 20px 28px;">
              <div style="background-color:#090d16;border:1px solid #1e293b;border-left:3px solid #10b981;border-radius:12px;padding:18px 20px;">
                <div style="font-size:10px;font-family:monospace;color:#34d399;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">
                  Stated Purpose for Downloading
                </div>
                <div style="font-size:14px;line-height:1.65;color:#e2e8f0;">
                  ${safeReason}
                </div>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          ${safeEmail ? `
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <a href="mailto:${encodeURIComponent(payload.email?.trim() || '')}?subject=${encodeURIComponent('Following up on my CV / Portfolio')}" style="display:inline-block;padding:11px 20px;background-color:#38bdf8;color:#020617;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;">
                Connect with ${safeName === 'Not provided' ? safeEmail : safeName}
              </a>
            </td>
          </tr>` : ''}

          <!-- Client Metadata & Footer -->
          <tr>
            <td style="padding:14px 28px;background-color:#05070b;border-top:1px solid #1e293b;font-size:11px;font-family:monospace;color:#64748b;line-height:1.5;">
              <div>Client: ${safeUa}</div>
              <div style="margin-top:4px;">Mohammed Sufyan Portfolio · Automated CV Access Telemetry</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildCvAccessPlainText(payload: CvAccessPayload, timestamp: string, userAgent: string): string {
  return [
    'MOHAMMED SUFYAN — CV EXPORT & ACCESS ALERT',
    '==========================================',
    `Exported: ${timestamp}`,
    `Action:   ${formatCvActionLabel(payload.action)}`,
    `Format:   ${payload.formatLabel}`,
    `Name:     ${payload.name?.trim() || 'Not provided'}`,
    `Email:    ${payload.email?.trim() || 'Not provided'}`,
    `Phone:    ${payload.phone?.trim() || 'Not provided'}`,
    '',
    'Reason for Downloading:',
    '-----------------------',
    payload.reason,
    '',
    `Client: ${userAgent || 'Unknown'}`,
  ].join('\n');
}

interface DispatchEmailParams {
  fromDisplayName: string;
  replyTo?: string;
  subjectLine: string;
  html: string;
  text: string;
  fallbackFields: Record<string, string>;
}

async function dispatchEmailMessage(params: DispatchEmailParams): Promise<{ provider: string }> {
  const { fromDisplayName, replyTo, subjectLine, html, text, fallbackFields } = params;
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
          to: [DESTINATION_EMAIL],
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
        to: DESTINATION_EMAIL,
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
        to: DESTINATION_EMAIL,
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

  // 4. FormSubmit relay — disabled in production unless ALLOW_FORMSUBMIT_FALLBACK=true
  // (relays lead PII to a third party; prefer Resend/Gmail/SMTP in prod).
  if (isFormSubmitFallbackAllowed()) {
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
  } else {
    transportErrors.push('FormSubmit fallback disabled in production (set ALLOW_FORMSUBMIT_FALLBACK=true to enable)');
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
  const subjectLine = safeHeaderSubject
    ? `[Portfolio Inquiry] ${safeHeaderSubject} — ${safeHeaderName}`
    : `[Portfolio Inquiry] New message from ${safeHeaderName}`;
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

async function sendCvAccessEmail(payload: CvAccessPayload, userAgent: string): Promise<{ provider: string }> {
  const timestamp = new Date().toUTCString();
  const safeHeaderName = sanitizeDisplayName(payload.name || '') || sanitizeHeaderValue(payload.email || payload.phone || 'Visitor');
  const safeHeaderEmail = payload.email ? sanitizeHeaderValue(payload.email) : undefined;
  const actionLabel = formatCvActionLabel(payload.action);
  const subjectPrefix = payload.action === 'install' ? 'App' : 'CV';
  const subjectLine = `[${subjectPrefix} ${actionLabel}] ${safeHeaderName} — ${sanitizeHeaderValue(payload.formatLabel)}`;
  const html = buildCvAccessEmailHtml(payload, timestamp, userAgent);
  const text = buildCvAccessPlainText(payload, timestamp, userAgent);

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
      name: payload.name || 'Not provided',
      email: safeHeaderEmail || 'Not provided',
      phone: payload.phone || 'Not provided',
      action: `${actionLabel} (${payload.formatLabel})`,
      reason: payload.reason,
    },
  });
}

async function startServer() {
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
    next();
  });

  app.use(express.json({ limit: '256kb' }));

  function rejectDisallowedOrigin(req: Request, res: Response): boolean {
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

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON request payload.' });
      return;
    }
    next(err);
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/contact', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }

      if (rejectDisallowedOrigin(req, res)) return;

      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp, contactRateLimitMap)) {
        res.setHeader('Retry-After', String(rateLimitRetryAfterSeconds(clientIp, contactRateLimitMap)));
        res.status(429).json({
          error: 'Too many messages sent from this connection. Please wait a few minutes and try again.',
        });
        return;
      }

      const rawBody = req.body;
      const body = (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {}) as Partial<ContactPayload> & {
        website?: unknown;
        turnstileToken?: unknown;
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

      if (cleanPhone && !isValidPhoneNumber(cleanPhone)) {
        res.status(400).json({ error: 'Please provide a valid phone number or leave it blank.' });
        return;
      }

      const result = await sendContactEmail({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        subject: cleanSubject,
        message: cleanMessage,
      });

      res.status(200).json({
        ok: true,
        provider: result.provider,
        message: `Email transmitted directly to ${DESTINATION_EMAIL}.`,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to send message.';
      console.error('Contact dispatch error:', errMsg);
      res.status(500).json({ error: 'Unable to send your message right now. Please try again later.' });
    }
  });

  app.post('/api/cv-access', async (req: Request, res: Response) => {
    try {
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }

      if (rejectDisallowedOrigin(req, res)) return;

      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (isRateLimited(clientIp, cvAccessRateLimitMap)) {
        res.setHeader('Retry-After', String(rateLimitRetryAfterSeconds(clientIp, cvAccessRateLimitMap)));
        res.status(429).json({
          error: 'Too many requests from this connection. Please wait a few minutes and try again.',
        });
        return;
      }

      const rawBody = req.body;
      const body = (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {}) as Partial<CvAccessPayload> & {
        website?: unknown;
        turnstileToken?: unknown;
      };

      // Silent honeypot sink for automated spam bots
      if (isHoneypotTriggered(body.website)) {
        res.status(200).json({
          ok: true,
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
      const cleanFormat =
        typeof body.formatLabel === 'string'
          ? sanitizeHeaderValue(body.formatLabel)
          : cleanAction === 'install'
            ? 'Portfolio PWA'
            : 'Executive Summary';

      if (!cleanEmail && !cleanPhone) {
        res.status(400).json({
          error:
            cleanAction === 'install'
              ? 'Please provide either your Email ID or Phone Number to install.'
              : 'Please provide either your Email ID or Phone Number to download.',
        });
        return;
      }

      if (cleanEmail && !isValidEmailAddress(cleanEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }

      if (cleanPhone && !isValidPhoneNumber(cleanPhone)) {
        res.status(400).json({ error: 'Please enter a valid phone number (at least 7 digits).' });
        return;
      }

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
        cleanPhone.length > MAX_FIELD_LENGTHS.phone ||
        cleanReason.length > MAX_FIELD_LENGTHS.message
      ) {
        res.status(400).json({ error: 'One or more fields exceed the allowed character limit.' });
        return;
      }

      const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : 'Unknown';
      const result = await sendCvAccessEmail(
        {
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          reason: cleanReason,
          action: cleanAction,
          formatLabel: cleanFormat,
        },
        userAgent
      );

      res.status(200).json({
        ok: true,
        provider: result.provider,
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

  // Express 5 / path-to-regexp require named wildcards (bare `/api/*` crashes startup).
  app.all('/api/{*splat}', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.get('/{*splat}', (_req: Request, res: Response) => {
      if (!fs.existsSync(indexPath)) {
        res.status(503).send('Production build not found. Run npm run build first.');
        return;
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
