# Security

This portfolio combines a public showcase with hardened lead-capture APIs (`/api/contact*`, `/api/cv-*`), RS256-authenticated owner policy synchronization (`/api/owner/policy-sync`), and Firebase Auth + Firestore Security Rules for owner analytics and governance. Note that CV/PWA "unlock" via `sessionStorage` provides verified **lead telemetry**, not DRM over publicly rendered portfolio text.

## Controls in place

- **Security headers**: Strict CSP, HSTS (HTTPS), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP (`same-origin-allow-popups`), `X-Frame-Options` / `frame-ancestors`, and `X-Robots-Tag: noindex, nofollow, noarchive` on API routes. Production `script-src` uses a sha256 hash for the theme-boot inline script (no `'unsafe-inline'`). Styles default to compatible `style-src 'unsafe-inline'`; set `CSP_STRICT_STYLES=true` to enforce `style-src-elem`/`style-src-attr` split (attrs still allowed). `Content-Security-Policy-Report-Only` always reports a stricter style policy to `/api/csp-report` so you can measure impact before flipping the flag. Production `connect-src` allows `wss://api.x.ai` for Live S2S (dev still allows broad `ws:`/`wss:` for Vite HMR). CI **CSP headers smoke** starts the prod server and asserts these headers on every PR.
- **CI security gates (separate checks):** SemVer tag, typecheck, unit tests, coverage, npm audit, CSP smoke, bundle size, Firestore rules lint + emulator tests, Gitleaks, Bandit, Semgrep, CodeQL, Docker build, Trivy — see [CI.md](./CI.md).
- **Observability export:** `GET /api/metrics` exposes Prometheus counters (OTP, chat RAG hits/misses, voice, CSP reports, HTTP). Optional `METRICS_TOKEN` bearer/query gate. `/api/status` includes an `observability` snapshot for the architecture map.
- **Portfolio CMS hardening:** Public CMS docs exclude soft-deleted bodies (`portfolio_seed_hides` markers + `deleted == false` queries); writes require `cms_mutated` admin audit; experience roles validated in Firestore rules; Mermaid SVG sanitized with DOMPurify before DOM insert.
- **Validation & sanitization**: Field length caps, strict email syntax + DNS MX check, E.164 phone validation, CR/LF/control header stripping, `escapeHtml()` across HTML emails and dynamic OG tags, and validated `Host` allowlisting in `resolveSafeBaseUrl`.
- **Mandatory Contact OTP & Adaptive CV OTP**: 6-digit single-use HMAC-signed challenges verified before dispatch or export (`10m` TTL, capped attempts).
- **Dual Rate Limiting + shared OTP/sessions**: Shared Upstash Redis counters when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set (rate limits, owner policy, OTP challenges, chat quotas/sessions); otherwise in-memory per-IP buckets (`15 / 15 min` on contact & CV access; `40 / 15 min` on repeat events) plus per-email OTP buckets (`5 / 15 min`) with `Retry-After` headers.
- **Anti-Bot & Anti-Crawler Layers**: Honeypot fields, Cloudflare Turnstile on Contact / CV / chat forms, `Sec-Fetch-Site: cross-site` rejection, `Origin`/`Referer` allowlisting, `robots.txt` + `<meta name="robots" content="noai, noimageai, noarchive" />`, and User-Agent filtering that always blocks AI dataset scrapers (`GPTBot`, `ClaudeBot`, `CCBot`, `Bytespider`, `AI2Bot`, `PetalBot`, …) plus scanners (`sqlmap`, `nikto`, …). On sensitive `POST` mutations, headless browsers and agent frameworks (`Playwright`, `Puppeteer`, `browser-use`, `curl`, `python-requests`, …) are also rejected. Live readiness is exposed as `botProtection` on `/api/status` and `/api/health` (including whether the request arrived via Cloudflare edge headers).
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
| Automated AI scraping / scanner probes | `robots.txt` + `X-Robots-Tag` + expanded UA middleware (pair with Cloudflare Bot Fight / Block AI Bots for headless farms) |
| Agentic browser form abuse | Turnstile + honeypot + POST-only script/agent UA block + Redis rate limits |
| XSS / HTML injection in inbound mail or OG cards | Strong (`escapeHtml` + validated `Host` origin) |
| Email header injection | Strong (`sanitizeHeaderValue` / `sanitizeDisplayName`) |
| Cross-site API forgery | Strong (`Origin`/`Referer` allowlist + `Sec-Fetch-Site: cross-site` block) |
| Unauthorized Firestore PII read | Strong (strict owner-only Firestore rules + RS256 token verification) |
| Unauthenticated Firestore create abuse | Mitigated via App Check +/or Admin SDK server writes (see below) |
| Scraping public client portfolio copy | Expected for unauthenticated public SPAs (mitigate further with Cloudflare Bot Fight Mode / WAF) |
| Multi-instance rate-limit bypass | Mitigated when Upstash Redis is configured |

## Reporting

Email security concerns to **sufyan.net@gmail.com**. Please allow reasonable time for response before public disclosure of non-critical issues.

Full Cloudflare / Cloud Run / Firebase / Resend checklists, upgrade paths, and **cost/limit tables** live in:

- [SECURITY_CONFIGURATION.md](./SECURITY_CONFIGURATION.md)
- [EXTERNAL_TOOLS_AND_COSTS.md](./EXTERNAL_TOOLS_AND_COSTS.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [security_spec.md](./security_spec.md)

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
4. Owner policy sync (`/api/owner/policy-sync`) mirrors to Redis so all replicas share pause/allow/block flags.
5. OTP challenges and live-chat sessions also write-through to Redis when configured (memory/disk remain the local cache / single-replica fallback). Set an explicit `SESSION_SECRET` so HMAC OTP / chat receipts stay stable across restarts.

### Portfolio chatbot & live agent

- **Retrieval:** Curated chunks from `portfolioData`. With `UPSTASH_VECTOR_REST_URL` + `UPSTASH_VECTOR_REST_TOKEN`, semantic search via **Upstash Vector** (BGE embeddings) + keyword hybrid; otherwise keyword ranking only.
- **LLM (optional):** **Grok (xAI)** enrichment when `GROK_API_KEY` is set and Owner Profile / Site Controls enable `enableChatLlm`.
- **Voice agent (optional):** Dual paths — **push-to-talk** (STT → answer → TTS) and **Live S2S** (browser WebSocket to Grok realtime with ephemeral client secrets from `/api/chat/voice/realtime-session`). PTT uses **Groq Whisper** (`GROQ_API_KEY`) + optional **ElevenLabs** / Grok TTS; browser `speechSynthesis` / blob playback fallback. Owner toggles `enableVoiceAgent` / `enableVoiceRealtime`. Keys stay server-side; audio is not stored. Live Call requires production CSP `wss://api.x.ai`. With LLM off, visitors still get Vector/keyword answers (no `api.x.ai` LLM calls).
- **Per-visitor caps** (default 10 questions / window, plus LLM + live-session caps) are owner-configurable and enforced server-side (Redis-shared when Upstash Redis is set; fail-closed on Redis errors); tracking KPIs appear on the Owner Profile.
- **Live agent** requires email OTP (same mail transport as contact/CV). Sessions use in-process memory + `.owner-chat-cache.json` with optional Redis write-through for multi-replica; owner console `#owner/chat` replies in near-real-time while presence heartbeats mark you online.
- Rate-limited under the `chat` bucket; allow/block rules still apply to live-chat emails.
- **Owner alert router** — classify events (live chat, risk CV, inquiry, chat limits, etc.) as `urgent` / `warning` / `digest` / `off` in Owner Profile; urgent/warning email immediately when enabled; digest-class items flush with “Email digest now”.

### Agent / AI bot hardening (owner actions)

**In-repo (done):** expanded UA denylist, honeypot + Turnstile on forms, PII Firestore creates denied, `botProtection` signals on `/api/status`.

**You still need to flip these in dashboards (cannot be done from this repo alone):**

1. Cloudflare → DNS: confirm **Proxied** (orange cloud) for apex + `www`.
2. Cloudflare → Security → Bots → **Bot Fight Mode On**; enable **Block AI Bots** if shown.
3. Cloudflare → SSL/TLS → **Full (strict)** + Always Use HTTPS.
4. Cloud Run → set `TRUST_PROXY=1`, `TURNSTILE_*`, `SESSION_SECRET`, optional Upstash Redis + `FIREBASE_SERVICE_ACCOUNT_JSON`.
5. Firebase → App Check (reCAPTCHA Enterprise) → set `VITE_RECAPTCHA_SITE_KEY` → rebuild → enforce App Check for Firestore when metrics look healthy.

After deploy, open Security Architecture on the site (or `GET /api/status`) and confirm `cloudflareEdge`, `turnstile`, and `redis` pills are green when those pieces are live.

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

# Optional Upstash Vector RAG for portfolio chat
UPSTASH_VECTOR_REST_URL=https://....upstash.io
UPSTASH_VECTOR_REST_TOKEN=...

# Optional Grok LLM enrichment (owner toggle enableChatLlm)
GROK_API_KEY=...
# GROK_API_BASE_URL=https://api.x.ai/v1
# CHAT_LLM_TIMEOUT_MS=12000
```

Wire chat secrets to Cloud Run: `./scripts/wire-chat-llm-secrets.sh` (reads `.env`).
