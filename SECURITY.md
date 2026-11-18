# Security

This portfolio is a public marketing site with lead-capture APIs (`/api/contact`, `/api/cv-access`). It is **not** an authenticated product. CV/PWA “unlock” via `sessionStorage` is **lead telemetry**, not access control — portfolio content is already delivered to the browser.

## Controls in place

- Security headers: CSP, HSTS (HTTPS), `nosniff`, Referrer-Policy, Permissions-Policy, COOP, `X-Frame-Options`
- Input validation, field length limits, email/phone checks
- HTML escaping and header sanitization for outbound mail (XSS / header injection)
- Honeypot field on contact and CV gate forms
- In-memory per-IP rate limits (15 / 15 min) with `Retry-After`
- Soft Origin/Referer allowlist for browser POSTs
- Optional Cloudflare Turnstile when `TURNSTILE_SECRET_KEY` is set
- FormSubmit third-party fallback **disabled in production** unless `ALLOW_FORMSUBMIT_FALLBACK=true`
- Secrets only on the server (`.env` gitignored); no `VITE_*` secrets for mail

## Threat model (summary)

| Threat | Coverage |
|--------|----------|
| Spam / mail-bomb | Rate limit + honeypot; enable Turnstile for stronger bot friction |
| XSS in inbound HTML email | Strong (`escapeHtml`) |
| Email header injection | Strong |
| Bypassing CV lead gate | Expected / trivial (public client content) |
| Secret leak via frontend | Low with current layout |

## Reporting

Email security concerns to **sufyan.net@gmail.com**. Please allow reasonable time for a response before public disclosure of non-critical issues.

## Operations checklist

1. Configure Resend or Gmail SMTP in production (do not rely on FormSubmit).
2. Optionally set `TURNSTILE_SECRET_KEY` (+ public site key in the client when you wire the widget).
3. Keep `npm audit` / Dependabot green in CI.
4. If you scale to multiple instances, replace in-memory rate limits with Redis/edge limits.
