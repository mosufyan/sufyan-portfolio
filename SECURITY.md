# Security

This portfolio combines a public showcase with hardened lead-capture APIs (`/api/contact*`, `/api/cv-*`), RS256-authenticated owner policy synchronization (`/api/owner/policy-sync`), and Firebase Auth + Firestore Security Rules for owner analytics and governance. Note that CV/PWA "unlock" via `sessionStorage` provides verified **lead telemetry**, not DRM over publicly rendered portfolio text.

## Controls in place

- **Security headers**: Strict CSP, HSTS (HTTPS), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP (`same-origin-allow-popups`), `X-Frame-Options` / `frame-ancestors`, and `X-Robots-Tag: noindex, nofollow, noarchive` on API routes.
- **Validation & sanitization**: Field length caps, strict email syntax + DNS MX check, E.164 phone validation, CR/LF/control header stripping, `escapeHtml()` across HTML emails and dynamic OG tags, and validated `Host` allowlisting in `resolveSafeBaseUrl`.
- **Mandatory Contact OTP & Adaptive CV OTP**: 6-digit single-use HMAC-signed challenges verified before dispatch or export (`10m` TTL, capped attempts).
- **Dual Rate Limiting**: In-memory per-IP buckets (`15 / 15 min` on contact & CV access; `40 / 15 min` on repeat events) plus per-email OTP buckets (`5 / 15 min`) with `Retry-After` headers.
- **Anti-Bot & Anti-Crawler Layers**: Honeypot fields, Cloudflare Turnstile on both Contact and CV gate forms, `Sec-Fetch-Site: cross-site` rejection, `Origin`/`Referer` allowlisting, `robots.txt` + `<meta name="robots" content="noai, noimageai, noarchive" />`, and User-Agent filtering blocking AI dataset scrapers and vulnerability scanners (`GPTBot`, `ClaudeBot`, `CCBot`, `Bytespider`, `PerplexityBot`, `Scrapy`, `sqlmap`, `nikto`, etc.).
- **Firebase Auth & Firestore Security Rules**: Default-deny catch-all, PII collection isolation (`cv_downloads`, `contact_messages`, `admin_audit_logs`, `access_rules`, `admins`), strict field/type/length/timestamp validation, and zero-read owner list rules.
- **Owner Policy Sync**: Allowlist/blocklist (`email`, `domain`, `ip`) and pause/strict-OTP toggles synced with verified Firebase RS256 ID tokens.
- **Secret Hygiene**: Mail credentials, `SESSION_SECRET`, and `TURNSTILE_SECRET_KEY` stay strictly on the server (`.env` gitignored).

## Threat model (summary)

| Threat | Coverage |
|--------|----------|
| Spam / mail-bombing | Per-IP & per-email OTP rate limits + Turnstile + Honeypot |
| Automated AI scraping / scanner probes | `robots.txt` + `X-Robots-Tag` + UA middleware (pair with Edge WAF for headless browser farms) |
| XSS / HTML injection in inbound mail or OG cards | Strong (`escapeHtml` + validated `Host` origin) |
| Email header injection | Strong (`sanitizeHeaderValue` / `sanitizeDisplayName`) |
| Cross-site API forgery | Strong (`Origin`/`Referer` allowlist + `Sec-Fetch-Site: cross-site` block) |
| Unauthorized Firestore PII read | Strong (strict owner-only Firestore rules + RS256 token verification) |
| Scraping public client portfolio copy | Expected for unauthenticated public SPAs (mitigate further with Cloudflare Bot Fight Mode / WAF) |

## Reporting

Email security concerns to **sufyan.net@gmail.com**. Please allow reasonable time for response before public disclosure of non-critical issues.

## Operations & Hardening Recommendations

1. Enable **Cloudflare Bot Fight Mode / Managed Challenge** or **Google Cloud Armor WAF** in front of the live domain so headless browsers (`Playwright`/`Puppeteer` spoofing real Chrome UAs) are challenged at the network edge before hitting Cloud Run.
2. Enable **Firebase App Check** (reCAPTCHA Enterprise) in Firebase Console and tighten client-side Firestore telemetry writes (`cv_downloads`, `contact_messages`) or move telemetry persistence behind server-side Firebase Admin SDK writes so unauthenticated Firestore creates can be disabled entirely.
3. Configure `SESSION_SECRET` and Cloudflare `TURNSTILE_SECRET_KEY` + `VITE_TURNSTILE_SITE_KEY` in production environment variables.
4. When scaling beyond a single Cloud Run instance, replace in-memory rate-limit maps and OTP challenge stores with Redis or Upstash.
