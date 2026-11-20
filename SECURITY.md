# Security

This portfolio combines a public showcase with hardened lead-capture APIs (`/api/contact*`, `/api/cv-*`), RS256-authenticated owner policy synchronization (`/api/owner/policy-sync`), and Firebase Auth + Firestore Security Rules for owner analytics and governance. Note that CV/PWA "unlock" via `sessionStorage` provides verified **lead telemetry**, not DRM over publicly rendered portfolio text.

## Controls in place

- **Security headers**: Strict CSP, HSTS (HTTPS), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP (`same-origin-allow-popups`), `X-Frame-Options` / `frame-ancestors`, and `X-Robots-Tag: noindex, nofollow, noarchive` on API routes.
- **Validation & sanitization**: Field length caps, strict email syntax + DNS MX check, E.164 phone validation, CR/LF/control header stripping, `escapeHtml()` across HTML emails and dynamic OG tags, and validated `Host` allowlisting in `resolveSafeBaseUrl`.
- **Mandatory Contact OTP & Adaptive CV OTP**: 6-digit single-use HMAC-signed challenges verified before dispatch or export (`10m` TTL, capped attempts).
- **Dual Rate Limiting**: Shared Upstash Redis counters when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set; otherwise in-memory per-IP buckets (`15 / 15 min` on contact & CV access; `40 / 15 min` on repeat events) plus per-email OTP buckets (`5 / 15 min`) with `Retry-After` headers.
- **Anti-Bot & Anti-Crawler Layers**: Honeypot fields, Cloudflare Turnstile on both Contact and CV gate forms, `Sec-Fetch-Site: cross-site` rejection, `Origin`/`Referer` allowlisting, `robots.txt` + `<meta name="robots" content="noai, noimageai, noarchive" />`, and User-Agent filtering blocking AI dataset scrapers and vulnerability scanners (`GPTBot`, `ClaudeBot`, `CCBot`, `Bytespider`, `PerplexityBot`, `Scrapy`, `sqlmap`, `nikto`, etc.).
- **Production builds**: Vite `build.sourcemap` is disabled so public JS bundles do not ship original TypeScript sources.
- **Firebase Auth & Firestore Security Rules**: Default-deny catch-all, PII collection isolation (`cv_downloads`, `contact_messages`, `admin_audit_logs`, `access_rules`, `admins`), strict field/type/length/timestamp validation, and zero-read owner list rules.
- **Optional App Check**: Client initializes Firebase App Check (reCAPTCHA Enterprise) when `recaptchaSiteKey` / `VITE_RECAPTCHA_SITE_KEY` is set.
- **Optional Admin telemetry writes**: When `FIREBASE_SERVICE_ACCOUNT_JSON` (or `GOOGLE_APPLICATION_CREDENTIALS`) is configured, Express persists `cv_downloads` / `contact_messages` via the Admin SDK after OTP verification and sets `telemetryPersistedByServer: true` so the browser skips the public Firestore create path.
- **Owner Policy Sync**: Allowlist/blocklist (`email`, `domain`, `ip`) and pause/strict-OTP toggles synced with verified Firebase RS256 ID tokens; mirrored to Redis when Upstash is configured.
- **Secret Hygiene**: Mail credentials, `SESSION_SECRET`, Turnstile keys, Redis tokens, and Firebase service-account JSON stay strictly on the server (`.env` gitignored).

## Threat model (summary)

| Threat | Coverage |
|--------|----------|
| Spam / mail-bombing | Per-IP & per-email OTP rate limits + Turnstile + Honeypot |
| Automated AI scraping / scanner probes | `robots.txt` + `X-Robots-Tag` + UA middleware (pair with Edge WAF for headless browser farms) |
| XSS / HTML injection in inbound mail or OG cards | Strong (`escapeHtml` + validated `Host` origin) |
| Email header injection | Strong (`sanitizeHeaderValue` / `sanitizeDisplayName`) |
| Cross-site API forgery | Strong (`Origin`/`Referer` allowlist + `Sec-Fetch-Site: cross-site` block) |
| Unauthorized Firestore PII read | Strong (strict owner-only Firestore rules + RS256 token verification) |
| Unauthenticated Firestore create abuse | Mitigated via App Check +/or Admin SDK server writes (see below) |
| Scraping public client portfolio copy | Expected for unauthenticated public SPAs (mitigate further with Cloudflare Bot Fight Mode / WAF) |
| Multi-instance rate-limit bypass | Mitigated when Upstash Redis is configured |

## Reporting

Email security concerns to **sufyan.net@gmail.com**. Please allow reasonable time for response before public disclosure of non-critical issues.

## Operations & Hardening — how to implement each recommendation

### 1. Edge WAF + no production source maps (scraper bar)

**In-repo (done):** Vite production builds set `build.sourcemap: false`.

**Cloudflare (recommended for the live domain):**

1. Add the production hostname to Cloudflare DNS and set the orange-cloud **Proxy** status.
2. Security → Bots → enable **Bot Fight Mode** (or Super Bot Fight Mode on paid plans).
3. Security → WAF → Managed rules → enable the Cloudflare Managed ruleset; add a custom rule that **Managed Challenge**s suspicious ASNs / empty `Accept-Language` / known automation paths if needed.
4. Keep `TRUST_PROXY=1` (or the hop count to Cloudflare) so Express sees the real visitor IP for rate limits.

**Google Cloud Armor (if staying on Cloud Run / GCP LB only):**

1. Attach a Cloud Armor security policy to the HTTPS load balancer backend service.
2. Enable Google’s preconfigured WAF rules + adaptive protection; challenge or deny obvious bot signatures.
3. Forward `X-Forwarded-For` and set Express `TRUST_PROXY` accordingly.

### 2. Firebase App Check and/or Admin SDK telemetry writes

**Path A — App Check (attest browser sessions):**

1. Firebase Console → App Check → Register the web app with **reCAPTCHA Enterprise**.
2. Copy the site key into `firebase-applet-config.json` → `recaptchaSiteKey` **or** set `VITE_RECAPTCHA_SITE_KEY` and rebuild.
3. Enable App Check **enforcement** for Cloud Firestore once metrics look healthy.
4. Optionally tighten `firestore.rules` creates for `cv_downloads` / `contact_messages` to require `request.app != null`.

**Path B — Server-only writes (done in code; enable with credentials):**

1. Create a Firebase service account with Firestore write access.
2. Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the stringified JSON key (Cloud Run secret) **or** mount the key and set `GOOGLE_APPLICATION_CREDENTIALS`.
3. Redeploy. `/api/health` reports `serverTelemetryWrites: true`; verify/OTP responses include `telemetryPersistedByServer: true`.
4. After confirming owner console still receives logs, change Firestore create rules for those collections to deny public creates (`allow create: if false`) so only Admin SDK can insert.

### 3. Redis / Upstash for shared rate limits & owner policy

**In-repo (done):** `server/distributedStore.ts` uses Upstash REST when configured; otherwise falls back to process memory.

1. Create an Upstash Redis database and copy the REST URL + token.
2. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on every Cloud Run / container replica.
3. Redeploy. `/api/health` reports `distributedStore: "redis"`.
4. Owner policy sync (`/api/owner/policy-sync`) now mirrors to Redis so all replicas share pause/allow/block flags.
5. OTP challenge maps remain in-process; keep sticky sessions or migrate OTP stores to Redis before scaling OTP heavily across many replicas.

### Portfolio chatbot & live agent

- **Bot answers** are grounded retrieval over `portfolioData` by default. Optional **Cursor Cloud Agents API** enrichment when `CURSOR_API_KEY` is set and Owner Profile / Site Controls enable `enableChatLlm` (no-repo agent + grounded context; times out to retrieval).
- **Per-visitor caps** (default 10 questions / window, plus LLM + live-session caps) are owner-configurable and enforced server-side; tracking KPIs appear on the Owner Profile.
- **Live agent** requires email OTP (same mail transport as contact/CV). Sessions live in Express memory + `.owner-chat-cache.json`; owner console `#owner/chat` replies in near-real-time while presence heartbeats mark you online.
- Rate-limited under the `chat` bucket; allow/block rules still apply to live-chat emails.

### Quick env checklist

```bash
# Edge / Express
TRUST_PROXY=1
SESSION_SECRET=...
TURNSTILE_SECRET_KEY=...
VITE_TURNSTILE_SITE_KEY=...

# App Check (client)
VITE_RECAPTCHA_SITE_KEY=...   # or firebase-applet-config.json recaptchaSiteKey

# Server telemetry (Admin SDK)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Shared rate limits + policy (multi-instance)
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Optional Cursor LLM enrichment for portfolio chat
CURSOR_API_KEY=...
# CURSOR_API_BASE_URL=https://api.cursor.com
# CHAT_LLM_TIMEOUT_MS=12000
```
