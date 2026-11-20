# Portfolio Architecture

Living documentation for the Mohammed Sufyan portfolio — React/Vite client, Express API, Firebase Auth/Firestore, and owner governance.

Related: [SECURITY.md](../SECURITY.md) · [SECURITY_CONFIGURATION.md](./SECURITY_CONFIGURATION.md) · [EXTERNAL_TOOLS_AND_COSTS.md](./EXTERNAL_TOOLS_AND_COSTS.md) · [README](../README.md)

---

## System overview

```mermaid
flowchart TB
  subgraph Client["Browser client"]
    UI[Portfolio UI]
    Chat[ChatWidget]
    Owner[Owner Console]
    TS[Turnstile]
  end

  subgraph Edge["Express API — server.ts"]
    Sec[Security middleware<br/>CSP · origin · bots]
    RL[Distributed rate limits<br/>memory / Upstash fail-closed]
    OTP[OTP + MX checks]
    ChatAPI["/api/chat/*"]
    Contact["/api/contact*"]
    CV["/api/cv-*"]
    OwnerAPI["/api/owner/*"]
  end

  subgraph Data["Persistence"]
    FS[(Firestore)]
    Redis[(Upstash Redis)]
    Disk[(.owner-chat-cache.json)]
  end

  subgraph External["External services"]
    FB[Firebase Auth]
    Mail[Resend / SMTP]
    Cursor[Cursor Cloud Agents]
    CF[Cloudflare Turnstile]
  end

  UI --> Sec
  Chat --> ChatAPI
  Chat --> TS --> CF
  Owner --> FB
  Owner --> OwnerAPI
  Owner --> FS
  Sec --> RL
  RL --> Redis
  ChatAPI --> OTP
  ChatAPI --> Cursor
  ChatAPI --> Disk
  Contact --> OTP
  Contact --> Mail
  Contact --> FS
  CV --> OTP
  CV --> FS
  OwnerAPI --> Mail
  OwnerAPI --> Redis
```

---

## Chat & live agent flow

```mermaid
sequenceDiagram
  actor V as Visitor
  participant W as ChatWidget
  participant API as Express /api/chat
  participant TS as Turnstile
  participant Mail as Email OTP
  participant LLM as Cursor LLM
  participant Own as Owner Console

  V->>W: Open widget
  W->>API: GET /status
  V->>W: Register (name/email)
  W->>TS: Challenge
  W->>API: POST /live/start + turnstileToken
  API->>Mail: Send 6-digit OTP
  V->>W: Enter OTP
  W->>API: POST /live/verify
  API-->>W: sessionId + receipt
  Note over W,API: Receipt via X-Chat-Receipt header only
  V->>W: Ask question
  W->>API: POST /ask + X-Chat-Receipt
  API->>API: Quota by IP or verified email
  opt enableChatLlm
    API->>LLM: Enrich grounded answer
    Note over API: LLM quota consumed only on Cursor success
  end
  API-->>W: Concise answer + follow-ups
  Own->>API: Presence + reply to live session
```

### Quota keys (anti-spoof)

| Visitor state | Quota key material |
|---------------|--------------------|
| Anonymous | `sha256(ip:…)` |
| OTP-verified | `sha256(email:…)` |
| Client `visitorId` | **Ignored** for quotas (spoofable) |

---

## Owner alert routing

```mermaid
flowchart LR
  E[Event<br/>live_chat / new_inquiry / …] --> C{Map to class<br/>urgent / warning / digest / off}
  C -->|urgent| Imm[Immediate email]
  C -->|warning| Imm
  C -->|digest| Q[Digest queue]
  C -->|off| X[Drop]
  Imm --> Dedupe[Dedupe window]
  Q --> Digest[Periodic digest email]
```

Configured in Owner Profile → Alert notify prefs (`alertClass*`, `alertEmail*`).

---

## Announcements visibility

```mermaid
flowchart TD
  Q[Firestore query] --> Own{Caller is admin?}
  Own -->|yes| All[orderBy createdAt<br/>all statuses]
  Own -->|no| Pub["where status == published<br/>orderBy createdAt"]
  Pub --> Rules[Rules: list only published]
  All --> RulesAdmin[Rules: isAdmin]
```

Composite index: `announcements` — `status` ASC + `createdAt` DESC (`firestore.indexes.json`).

---

## Module map

| Path | Responsibility |
|------|----------------|
| `server.ts` | HTTP routes, OTP, chat, owner reply binding |
| `server/security.ts` | Headers, Turnstile, honeypot, origin checks |
| `server/distributedStore.ts` | Upstash rate limits (fail-closed) + policy |
| `server/chatLimits.ts` | Per-visitor question / LLM / live caps |
| `server/chatKnowledge.ts` | Grounded Q&A + concise answers |
| `server/cursorLlm.ts` | Optional Cursor Cloud Agents enrichment |
| `server/chatSessions.ts` | Live session store + disk cache |
| `server/chatReceipt.ts` | Header-based session receipt extraction |
| `server/ownerNotify.ts` | Urgent / warning / digest router |
| `server/firebaseAdmin.ts` | Admin SDK writes + inquiry reply binding |
| `src/components/ChatWidget.tsx` | Visitor chat UI + Turnstile |
| `src/utils/ownerGovernance.ts` | Settings sanitize + access rules |
| `firestore.rules` | Deny-by-default collection rules |

---

## Security control summary

```mermaid
mindmap
  root((Defense in depth))
    Edge
      CSP / HSTS
      Origin + Sec-Fetch-Site
      Bot UA blocklist
      Fail-closed Redis RL
    Identity
      Firebase Google owner
      HMAC OTP challenges
      Chat receipts in headers
      Turnstile on forms + live start
    Data
      Firestore field schemas
      PII collections owner-only
      Public announcements filter
      Reply bound to inquiry email
    Abuse
      Honeypot
      Per-IP + per-email buckets
      Chat caps by IP/email
      Incident mode kill-switch
```

---

## Test layout

| Suite | Covers |
|-------|--------|
| `server/*.test.ts` | Security, chat limits/receipts/sessions/knowledge, Cursor LLM, notify, Redis |
| `src/utils/*.test.ts` | Governance, announcements, CV/ATS, phone, skills, tracking, routing |
| `src/utils/portfolioFeatures.test.ts` | Cross-feature matrix smoke |

Run: `npm test` · Lint: `npm run lint` · Audit: `npm run security:audit`
