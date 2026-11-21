# Per-surface OTP Require Toggles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner toggles `requireOtpForChat`, `requireOtpForContact`, `requireOtpForCv` (defaults on) so each surface can skip email OTP, including in production, with incident mode forcing OTP back on.

**Architecture:** Settings live in `PortfolioSettings` + Firestore + Redis policy sync. Server gates chat start, contact submit, and CV step-up. `/api/access-config` exposes effective flags for client UI. `strictOtpForAll` mirrors `requireOtpForCv` during migration.

**Tech Stack:** TypeScript, Express, Firestore rules, React owner console / ChatWidget / Contact / AccessGateModal.

## Global Constraints

- Defaults secure: new installs require OTP on all three surfaces.
- Incident mode forces require flags true (and keeps existing lockdown).
- `FORCE_CV_OTP` env still forces CV OTP even when `requireOtpForCv` is false.
- Deploy updated `firestore.rules` before clients that always write the new keys.

---

### Task 1: Settings model + tests + rules

**Files:** `src/utils/ownerGovernance.ts`, `src/utils/ownerGovernance.test.ts`, `firestore.rules`

- [x] Add three booleans; sanitize with migration from `strictOtpForAll` → `requireOtpForCv`; write both; incident sets all require* true + `strictOtpForAll` true
- [x] Unit tests for defaults, migration, incident
- [x] Extend `isValidPortfolioSettings` hasAll/hasOnly + bool checks

### Task 2: Server policy + gates + access-config

**Files:** `server.ts`, `server/distributedStore.ts` (+ tests if needed)

- [x] Runtime policy + policy-sync fields
- [x] `/api/access-config`: `requireOtpForChat|Contact|Cv`, `forceOtp` = FORCE_CV_OTP || requireOtpForCv
- [x] Chat live start: if !requireOtpForChat, create session (no OTP); allow without mail transport
- [x] Contact: if !requireOtpForContact, finalize send without OTP (reuse verify success path)
- [x] CV: `shouldStepUpOtp` = transport && !allowlisted && (FORCE_CV_OTP || requireOtpForCv)

### Task 3: Owner + visitor UI

**Files:** `OwnerGovernancePanels.tsx`, `FirebaseContext.tsx`, `ChatWidget.tsx`, `Contact.tsx`, `AccessGateModal.tsx`, `OwnerConsolePage.tsx`

- [x] Three checkboxes + warning when any off; replace strict OTP label
- [x] Policy sync payload includes new fields
- [x] Clients honor access-config flags (skip OTP UI)

### Task 4: Verify + deploy rules

- [x] `npm test`, `npm run lint`, `npm run lint:rules`
- [x] Deploy firestore rules
