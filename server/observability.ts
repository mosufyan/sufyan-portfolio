/**
 * Request IDs, structured JSON logs, in-process metrics, optional Sentry + Slack.
 */
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface RequestLogContext {
  requestId: string;
  method: string;
  path: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  route?: string;
}

const metrics = {
  httpRequests: 0,
  httpErrors: 0,
  rateLimitDenials: 0,
  otpIssued: 0,
  otpVerified: 0,
  chatQuestions: 0,
  chatLiveStarts: 0,
  alertsDispatched: 0,
  sentryEvents: 0,
  slackEvents: 0,
  startedAtMs: Date.now(),
};

export function bumpMetric(name: keyof typeof metrics, by = 1): void {
  if (name === 'startedAtMs') return;
  metrics[name] += by;
}

export function getObservabilitySnapshot() {
  return {
    ...metrics,
    uptimeSec: Math.floor((Date.now() - metrics.startedAtMs) / 1000),
    sentryConfigured: Boolean((process.env.SENTRY_DSN || '').trim()),
    slackWebhookConfigured: Boolean((process.env.SLACK_ALERT_WEBHOOK_URL || '').trim()),
  };
}

export function structuredLog(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {}
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    service: 'sufyan-portfolio',
    ...fields,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming =
    (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].trim()) ||
    (typeof req.headers['cf-ray'] === 'string' && req.headers['cf-ray'].trim()) ||
    '';
  const requestId = (incoming.slice(0, 64) || crypto.randomBytes(8).toString('hex')).replace(
    /[^\w\-.:]/g,
    ''
  );
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const started = Date.now();
  bumpMetric('httpRequests');

  res.on('finish', () => {
    const durationMs = Date.now() - started;
    const statusCode = res.statusCode;
    if (statusCode >= 500) bumpMetric('httpErrors');
    if (statusCode === 429) bumpMetric('rateLimitDenials');

    // Skip noisy static/health chatter at info; always log API + errors.
    const isApi = req.path.startsWith('/api/');
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    if (isApi || statusCode >= 400) {
      structuredLog(level, 'http_request', {
        requestId,
        method: req.method,
        path: req.path.slice(0, 200),
        statusCode,
        durationMs,
        ip: typeof req.ip === 'string' ? req.ip.slice(0, 64) : undefined,
      });
    }
  });

  next();
}

/** Optional Sentry via envelope HTTP (no SDK dependency). */
export async function captureException(
  error: unknown,
  context: Record<string, unknown> = {}
): Promise<void> {
  const dsn = (process.env.SENTRY_DSN || '').trim();
  if (!dsn) return;

  try {
    const parsed = new URL(dsn);
    // DSN: https://<key>@<host>/<projectId>
    const publicKey = parsed.username;
    const projectId = parsed.pathname.replace(/^\//, '');
    if (!publicKey || !projectId) return;

    const ingestHost = parsed.host;
    const eventId = crypto.randomBytes(16).toString('hex');
    const err = error instanceof Error ? error : new Error(String(error));
    const payload = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: 'node',
      level: 'error',
      server_name: 'sufyan-portfolio',
      environment: process.env.NODE_ENV || 'development',
      message: err.message.slice(0, 500),
      exception: {
        values: [
          {
            type: err.name || 'Error',
            value: err.message.slice(0, 1000),
            stacktrace: err.stack
              ? {
                  frames: err.stack
                    .split('\n')
                    .slice(1, 12)
                    .map((line) => ({ filename: line.trim().slice(0, 260) })),
                }
              : undefined,
          },
        ],
      },
      tags: { service: 'sufyan-portfolio' },
      extra: context,
    };

    const url = `https://${ingestHost}/api/${projectId}/store/`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      bumpMetric('sentryEvents');
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    structuredLog('warn', 'sentry_capture_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function postSlackAlert(input: {
  title: string;
  detail: string;
  alertClass: string;
  requestId?: string;
}): Promise<boolean> {
  const webhook = (process.env.SLACK_ALERT_WEBHOOK_URL || '').trim();
  if (!webhook) return false;

  const color =
    input.alertClass === 'urgent' ? '#e11d48' : input.alertClass === 'warning' ? '#d97706' : '#64748b';
  const body = {
    text: `[${input.alertClass.toUpperCase()}] ${input.title}`,
    attachments: [
      {
        color,
        text: input.detail.slice(0, 2000),
        footer: input.requestId ? `requestId=${input.requestId}` : 'sufyan-portfolio',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        structuredLog('warn', 'slack_webhook_non_ok', { status: res.status });
        return false;
      }
      bumpMetric('slackEvents');
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    structuredLog('warn', 'slack_webhook_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Boolean readiness map for agent/bot abuse controls (no secrets).
 * `cloudflareEdge` is request-derived when a headers object is supplied.
 */
export function evaluateBotProtection(options?: {
  cloudflareEdge?: boolean;
}): {
  uaBlocklist: true;
  honeypot: true;
  fetchMetadata: true;
  originAllowlist: true;
  robotsNoAi: true;
  turnstile: boolean;
  redisSharedLimits: boolean;
  adminSdkWrites: boolean;
  appCheck: boolean;
  sessionSecret: boolean;
  trustProxy: boolean;
  cloudflareEdge: boolean | null;
} {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    uaBlocklist: true,
    honeypot: true,
    fetchMetadata: true,
    originAllowlist: true,
    robotsNoAi: true,
    turnstile: Boolean(
      (process.env.TURNSTILE_SECRET_KEY || '').trim() &&
        ((process.env.VITE_TURNSTILE_SITE_KEY || '').trim() ||
          (process.env.TURNSTILE_SITE_KEY || '').trim())
    ),
    redisSharedLimits: Boolean(
      (process.env.UPSTASH_REDIS_REST_URL || '').trim() &&
        (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim()
    ),
    adminSdkWrites: Boolean(
      (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim() ||
        (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()
    ),
    appCheck: Boolean(
      (process.env.VITE_RECAPTCHA_SITE_KEY || '').trim() ||
        (process.env.RECAPTCHA_SITE_KEY || '').trim()
    ),
    sessionSecret: Boolean(process.env.SESSION_SECRET?.trim()),
    trustProxy: !isProd || process.env.TRUST_PROXY !== '0',
    cloudflareEdge:
      typeof options?.cloudflareEdge === 'boolean' ? options.cloudflareEdge : null,
  };
}

export function evaluateGoldPathHardening(): {
  score: number;
  max: number;
  items: Array<{ id: string; ok: boolean; label: string }>;
  productionReady: boolean;
} {
  const isProd = process.env.NODE_ENV === 'production';
  const items = [
    {
      id: 'session_secret',
      ok: Boolean(process.env.SESSION_SECRET?.trim()),
      label: 'SESSION_SECRET explicitly set',
    },
    {
      id: 'turnstile',
      ok: Boolean(
        (process.env.TURNSTILE_SECRET_KEY || '').trim() &&
          ((process.env.VITE_TURNSTILE_SITE_KEY || '').trim() ||
            (process.env.TURNSTILE_SITE_KEY || '').trim())
      ),
      label: 'Cloudflare Turnstile configured',
    },
    {
      id: 'redis',
      ok: Boolean(
        (process.env.UPSTASH_REDIS_REST_URL || '').trim() &&
          (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim()
      ),
      label: 'Upstash Redis configured',
    },
    {
      id: 'admin_sdk',
      ok: Boolean(
        (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim() ||
          (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()
      ),
      label: 'Firebase Admin SDK configured',
    },
    {
      id: 'mail',
      ok: Boolean(
        (process.env.RESEND_API_KEY || '').trim() ||
          ((process.env.GMAIL_USER || '').trim() && (process.env.GMAIL_APP_PASSWORD || '').trim()) ||
          ((process.env.SMTP_HOST || '').trim() && (process.env.SMTP_USER || '').trim())
      ),
      label: 'Outbound email transport configured',
    },
    {
      id: 'sentry',
      ok: Boolean((process.env.SENTRY_DSN || '').trim()),
      label: 'Sentry DSN configured',
    },
    {
      id: 'slack',
      ok: Boolean((process.env.SLACK_ALERT_WEBHOOK_URL || '').trim()),
      label: 'Slack alert webhook configured',
    },
    {
      id: 'trust_proxy',
      ok: !isProd || process.env.TRUST_PROXY !== '0',
      label: 'Trust proxy enabled for production edge',
    },
    {
      id: 'app_check',
      ok: Boolean(
        (process.env.VITE_RECAPTCHA_SITE_KEY || '').trim() ||
          (process.env.RECAPTCHA_SITE_KEY || '').trim()
      ),
      label: 'Firebase App Check site key configured',
    },
  ];
  const okCount = items.filter((i) => i.ok).length;
  const strict = (process.env.STRICT_PROD_HARDENING || '').toLowerCase() === 'true';
  return {
    score: okCount,
    max: items.length,
    items,
    productionReady: !strict || !isProd || okCount === items.length,
  };
}
