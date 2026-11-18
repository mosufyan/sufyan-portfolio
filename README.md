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
  <a href="./SECURITY.md">Security</a>
</p>

<p align="center">
  <img alt="CI" src="https://github.com/mosufyan/sufyan-portfolio/actions/workflows/ci.yml/badge.svg" />
</p>

---

Interactive personal portfolio built with **React**, **Vite**, **Express**, and **Motion**.  
It includes multi-skill filtering, a command palette, dark/light themes, announcements, a digital business card, and a gated CV export studio.

## Features

| Area | What you get |
|------|----------------|
| **Experience & skills** | Multi-select skill filters, saved presets, proof metrics, deep links via `?skill=` |
| **Navigation** | Sticky nav, mobile TOC, ⌘K / Ctrl+K command palette |
| **Themes** | Site dark/light mode + independent CV Light Paper / Dark Theme export |
| **Contact** | Intent presets, honeypot + rate-limited `/api/contact` |
| **CV / PWA** | Live preview, role-track presets, PDF/ATS export, optional install gate |
| **Ops** | Vitest unit tests, CI (lint / test / audit / build) |

## Tech stack

- **Frontend:** React 19, Vite 8, Tailwind CSS 4, Motion
- **Backend:** Express (contact + CV access APIs, production static hosting)
- **Tooling:** TypeScript, Vitest, GitHub Actions
- **Hosting:** Google Cloud Run (+ Artifact Registry when CI deploy is enabled)

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

Copy the example env file if you want real email delivery from the contact / CV gate forms:

```bash
cp .env.example .env
```

Minimum useful vars:

```bash
CONTACT_TO_EMAIL="you@example.com"
APP_URL="http://localhost:3000"

# Pick one mail transport:
GMAIL_USER="you@example.com"
GMAIL_APP_PASSWORD="your-app-password"
# or
RESEND_API_KEY="re_xxx"
RESEND_FROM_EMAIL="Portfolio <onboarding@resend.dev>"
```

Without mail credentials, the UI still runs; contact/CV notification emails will fail until a transport is configured.

### 3. Run the app

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

This starts Express + Vite middleware together (API routes + hot reload).

### Common scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development server |
| `npm run build` | Production Vite build → `dist/` |
| `npm start` | Serve production build + APIs (`NODE_ENV=production`) |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm test` | Unit tests (Vitest) |
| `npm run security:audit` | Production dependency audit |

### Production-like local check

```bash
npm run build
npm start
```

Then visit `http://localhost:3000`.

## Project layout

```text
src/                 React UI (Hero, Experience, Skills, Resume modal, …)
server.ts            Express app (APIs + static hosting in production)
server/security.ts   Shared validation, CSP, rate limits, Turnstile hook
public/              Static assets (icons, OG image, PWA)
.github/workflows/   CI (lint / test / audit / build)
```

## CI notes

- **CI on every PR & `main` push:** typecheck → tests → prod audit → build
- Production hosting is on Google Cloud Run via AI Studio; redeploy there after merging to `main` (CI does not deploy)

## Security

Lead-capture APIs use validation, honeypots, rate limits, and security headers.  
CV “unlock” is **lead telemetry**, not DRM — see [SECURITY.md](./SECURITY.md).

## License

Private portfolio repository. All rights reserved © Mohammed Sufyan.
