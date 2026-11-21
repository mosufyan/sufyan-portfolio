# Mohammed Sufyan — Portfolio

<p align="center">
  <strong>Software Engineer · Cisco Systems Inc. STO</strong><br/>
  Security data platforms · multi-cloud systems · applied AI workflows
</p>

<p align="center">
  <a href="https://www.mohammedsufyan.com/">Live site</a>
  ·
  <a href="https://www.linkedin.com/in/mohammed-sufyan">LinkedIn</a>
  ·
  <a href="./docs/SECURITY.md">Security</a>
</p>

<p align="center">
  <img alt="CI" src="https://github.com/mosufyan/sufyan-portfolio/actions/workflows/ci.yml/badge.svg" />
</p>

---

Interactive personal portfolio built with **React**, **Vite**, **Express**, **Tailwind CSS**, **Firebase Auth & Firestore**, and **Motion**.
It includes multi-skill filtering, a command palette (`⌘K`/`Ctrl+K`), an interactive CLI (`sufyanctl`), dark/light themes, real-time announcements, a digital business card, an OTP-verified inquiry & CV export studio, OTP-gated portfolio chat (Upstash Vector RAG + optional Grok LLM), and a full-page Owner Security & Governance Console accessible directly from the navbar.

Docs: **[Architecture](./docs/ARCHITECTURE.md)** · **[Security configuration](./docs/SECURITY_CONFIGURATION.md)** · **[External tools & costs](./docs/EXTERNAL_TOOLS_AND_COSTS.md)** · **[Portfolio assessment](./docs/PORTFOLIO_ASSESSMENT.md)** · **[SECURITY.md](./docs/SECURITY.md)**.

## Features

| Area | What you get |
|------|----------------|
| **Experience & skills** | Multi-select skill filters, saved presets, proof metrics, deep links via `?skill=` |
| **Navigation** | Sticky single-line navbar, mobile drawer, `⌘K` / `Ctrl+K` command palette, `sufyanctl` terminal |
| **Themes** | Site Dark / Light Paper mode + independent CV & Analytics PDF Light/Dark export |
| **Contact (`Transmit Message`)** | Quick-intent presets, mandatory 6-digit email OTP verification, Cloudflare Turnstile, honeypot, inquiry triage |
| **CV / PWA studio** | Live preview, custom presets, A4 print layout, ATS plain-text export, OTP-gated lead telemetry |
| **Owner Console (Full-Page)** | Navbar Google Sign-In, `#owner/<tab>` deep links, CV & Message analytics, funnel/CRM/alerts, Light/Dark PDF export, triage + inbox replies, announcements (draft/schedule/publish), delegates, feature switches, incident mode, audit log |
| **Portfolio chat** | OTP-gated welcome, Turnstile on live start, Upstash Vector RAG (+ keyword fallback), optional Grok enrichment with per-visitor caps, header-bound session receipts, owner live-agent console |
| **Ops** | Vitest unit tests, GitHub Actions CI/CD (PR verify + Docker; `main` → Cloud Run), `/api/health` · `/api/status` · `/api/uptime`, architecture + security docs |

## Tech stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4, Motion, Recharts (`CvAnalyticsCharts`), `html2canvas-pro` + `jspdf`
- **Backend:** Express (OTP verification, telemetry, policy sync, dynamic OG cards, production static hosting)
- **Database & Auth:** Firebase Authentication (Google Sign-In) + Cloud Firestore with strict Security Rules
- **Tooling:** TypeScript, Vitest, ESLint (`firestore.rules`), GitHub Actions
- **Hosting:** Google Cloud Run
- **CI/CD:** GitHub Actions — PRs run lint/tests/audit/build + Docker image build; merges to `main` deploy to Cloud Run (Workload Identity)

---

## Security Architecture & Hardening

This codebase applies layered defense-in-depth across the Express API server, React client, Cloud Firestore Security Rules, and crawler/bot boundary:

### 1. Authentication, RBAC & Owner Governance
- **Verified Owner Sign-In (`Firebase Auth`)**: Owner console authentication uses Google Sign-In directly from the main navbar, verifying `request.auth.token.email == 'sufyan.net@gmail.com'` and `email_verified == true`.
- **Cryptographic Backend Policy Sync (`/api/owner/policy-sync`)**: When the owner updates access rules or maintenance/pause toggles in Firestore, the client forwards a fresh Firebase ID Token (`Authorization: Bearer <token>`). The Express server verifies the **RS256 signature** against Google’s official `securetoken@system.gserviceaccount.com` X.509 certificates and checks `aud`, `iss`, `exp`, and verified owner email before persisting runtime enforcement rules.
- **Immutable Admin Audit Trail (`admin_audit_logs`)**: Every owner sign-in, sign-out, settings toggle, rule mutation, announcement change, and inquiry triage update logs an immutable timestamped audit record.

### 2. Cloud Firestore Security Rules (`firestore.rules`)
- **Global Default Deny**: `match /{document=**}` denies all reads/writes by default.
- **PII Collection Isolation**: `cv_downloads`, `contact_messages`, `admin_audit_logs`, `access_rules`, and `admins` block all public reads/lists (`isVerifiedOwnerEmail()` / `isAdmin()` required).
- **Strict Field-Level Validation**: Every collection validates exact required/allowed key sets (`hasAll`/`hasOnly`), data types, string min/max bounds, enum allowlists, `https://` URL constraints, `request.time` server timestamp equality, and immutable field preservation on updates.
- **Denial-of-Wallet List Guard**: List rules check JWT claims (`isVerifiedOwnerEmail()`) without extra Firestore `get()`/`exists()` reads per document.

### 3. Lead Verification, Mandatory Email OTP & Anti-Abuse
- **Mandatory Contact Email OTP**: `/api/contact` never delivers unverified web form emails directly. Submissions first trigger a 6-digit single-use HMAC-signed challenge email (`/api/contact-verify-otp`, max attempts capped, 10-minute expiry).
- **Adaptive CV / PWA Gate (`/api/cv-access` & `/api/cv-verify-otp`)**: Validates mandatory email + DNS MX/A domain deliverability checks (`dns.resolveMx`) and E.164 phone validation (blocking fake/sequential numbers). Triggers mandatory 6-digit email OTP verification automatically on VPN/proxy/hosting ASNs, timezone mismatches, or whenever global `Strict OTP` is enabled.
- **Real-Time Allowlist & Blocklist Enforcement**: Owner rules (`email`, `domain`, `ip`) and emergency pause toggles (`enableContactForm`, `enableCvDownloads`) are enforced across `/api/contact`, `/api/contact-verify-otp`, `/api/cv-access`, `/api/cv-verify-otp`, and `/api/cv-event`.
- **Dual Rate Limiting**: Per-IP rate limiting (`15 requests / 15 min` on contact/CV access, `40 / 15 min` on repeat events, with `Retry-After` headers) paired with **per-email OTP cooldown buckets** (`5 OTP dispatches / 15 min` per normalized address) to prevent proxy-rotated inbox flooding.

### 4. Bot, Crawler & Scraper Protection
- **Cloudflare Turnstile**: Both `/api/contact` and `/api/cv-access` verify Cloudflare Turnstile challenge tokens server-side (`challenges.cloudflare.com/turnstile/v0/siteverify`) whenever `TURNSTILE_SECRET_KEY` is configured.
- **Silent Honeypot Trap**: Hidden off-screen `website` field absorbs dumb form bots (returns deceptive `200 OK` `{ provider: 'filtered' }` without triggering mail or Firestore writes).
- **Automated Scraper & AI-Crawler Filtering**:
  - Express middleware (`isBlockedBotUserAgent`) returns `403` to AI training crawlers and security scanners (`GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `Google-Extended`, `CCBot`, `ClaudeBot`, `anthropic-ai`, `Bytespider`, `PerplexityBot`, `Amazonbot`, `Scrapy`, `sqlmap`, `nikto`, `nuclei`, etc.), and rejects headless automation / empty-UA scripted POST mutations to `/api/contact*` and `/api/cv-*`.
  - `public/robots.txt` disallows `/api/` globally and blocks major AI dataset scrapers while allowing legitimate search engines and social preview bots (`Googlebot`, `Bingbot`, `LinkedInBot`, `Twitterbot`).
  - `index.html` includes `<meta name="robots" content="noai, noimageai, noarchive" />` and API routes emit `X-Robots-Tag: noindex, nofollow, noarchive`.

### 5. HTTP Security Headers, Injection & CSRF Defenses
- **Security Headers (`server/security.ts`)**: Strict `Content-Security-Policy` (no `unsafe-eval` in production), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()`, `Cross-Origin-Opener-Policy: same-origin-allow-popups` (required for Firebase Google Auth popups), and `X-Frame-Options: DENY` / `frame-ancestors 'none'` in custom-domain production.
- **Cross-Origin & Fetch Metadata Enforcement**: Mutation POST endpoints enforce both `Origin`/`Referer` allowlisting (`ALLOWED_ORIGINS`) and Fetch Metadata rejection (`Sec-Fetch-Site: cross-site` -> `403`).
- **Sanitization & Injection Prevention**: Strict email character allowlisting, `sanitizeHeaderValue` / `sanitizeDisplayName` stripping CR/LF/control bytes to eliminate SMTP header injection, `escapeHtml` across all email templates and dynamic OG meta tags, plus validated `resolveSafeBaseUrl()` to prevent HTTP `Host` header injection.
- **Zero Client Secrets**: All mail credentials, OTP HMAC secrets, Firebase public key verification, and Turnstile secrets stay strictly server-side (`.env` gitignored).

For threat model notes and operational recommendations (WAF, Redis rate limits, Firebase App Check), see [SECURITY.md](./docs/SECURITY.md).

---

## Quick start (local)

### Requirements

- **Node.js 22+** (recommended)
- npm 10+ (comes with Node)

### 1. Clone & install

```bash
git clone https://github.com/mosufyan/sufyan-portfolio.git
cd sufyan-portfolio
npm install
```

### 2. Environment (optional for local UI)

Copy `.env.example` to `.env` if you want live email OTP verification and Cloudflare Turnstile locally:

```bash
cp .env.example .env
```

Minimum useful vars:

```bash
CONTACT_TO_EMAIL="you@example.com"
APP_URL="http://localhost:3000"
SESSION_SECRET="replace-with-long-random-secret"

# Pick one mail transport:
GMAIL_USER="you@example.com"
GMAIL_APP_PASSWORD="your-app-password"
# or
RESEND_API_KEY="re_xxx"
RESEND_FROM_EMAIL="Portfolio <onboarding@resend.dev>"

# Optional Cloudflare Turnstile:
VITE_TURNSTILE_SITE_KEY="0x..."
TURNSTILE_SECRET_KEY="0x..."
```

### 3. Run the app

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

### Common scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local Express + Vite dev server |
| `npm run build` | Production Vite build → `dist/` |
| `npm start` | Serve production build + APIs (`NODE_ENV=production`) |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm run precommit` | Local pre-commit gate (Gitleaks + typecheck + rules lint) |
| `npm run release -- 1.0.1` | Bump `package.json`, commit, create annotated `v*` tag (add `--push` to publish) |
| `npm test` | Unit tests (Vitest) |
| `npm run security:audit` | Production dependency audit |

### Production-like local check

```bash
npm run build
npm start
```

## Project layout

```text
src/                 React UI, Owner Console, ChatWidget, Resume Studio, contexts & utilities
server.ts            Express APIs (OTP, chat, owner, telemetry, OG, SPA serving)
server/              security, telemetry, distributedStore, chat*, grokLlm, portfolioVector, observability
docs/                Architecture, security, security config, costs, portfolio assessment
scripts/             wire-*-secrets.sh, setup-github-actions-deploy.sh
firestore.rules      Strict schema-validated Firebase Security Rules (Admin-only PII creates)
firestore.indexes.json  Composite indexes for announcements / analytics queries
public/              Static assets, robots.txt, .well-known/security.txt, OG cards
.github/workflows/   CI/CD (PR verify + Docker; main → Cloud Run)
```

## License

Private portfolio repository. All rights reserved © Mohammed Sufyan.
