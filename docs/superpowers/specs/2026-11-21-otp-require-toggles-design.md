# Per-surface OTP require toggles

**Date:** 2026-11-21  
**Status:** Approved for planning  
**Branch context:** Owner console site controls (can ship with or after voice-agent work)

## Problem

Local (and intentional prod) testing of chat, contact, and CV flows always hits email OTP. Today only **Strict OTP for All CV Exports** (`strictOtpForAll`) exists; it *forces* CV OTP and cannot disable chat/contact OTP.

## Goals

- Separate owner toggles to **require or skip OTP** for:
  - Portfolio chat (live session start)
  - Contact form verification step-up
  - CV download step-up
- Defaults remain **secure** (OTP required / current behavior).
- Toggles take effect wherever the owner saves them (**including production**), per product decision.
- Incident mode still wins: lockdown keeps OTP required.

## Non-goals

- Removing email collection where the product still needs an address for delivery/CRM.
- Changing Turnstile, rate limits, allowlist/blocklist, or App Check.
- Env-only bypass as the primary UX (optional `FORCE_CV_OTP` may remain as an extra CV force).

## Approach

Three portfolio settings booleans (defaults **true**):

| Field | Meaning when true | Meaning when false |
| --- | --- | --- |
| `requireOtpForChat` | Live chat start requires email OTP (current) | Skip OTP; still collect identity as today’s register step allows, then open session without code verify |
| `requireOtpForContact` | Contact flow may require OTP when transport is ready (current step-up path) | Never require contact OTP; proceed with existing non-OTP verification path |
| `requireOtpForCv` | Force CV OTP for every export (same as today’s `strictOtpForAll`) | Do not force OTP; adaptive risk step-up also skipped so local testing never prompts CV OTP |

**Migration:** Treat `strictOtpForAll` as deprecated alias of `requireOtpForCv`.

- Read: `requireOtpForCv ?? strictOtpForAll ?? false` then default true for the new field in `DEFAULT_PORTFOLIO_SETTINGS`.
- Write: persist `requireOtpForCv`; keep writing `strictOtpForAll = requireOtpForCv` for one release so older servers/rules don’t break mid-deploy.
- UI: replace “Strict OTP for All CV Exports” label with “Require OTP for CV exports”.

## Owner console UX

In Site Controls (same card as contact/CV toggles):

1. **Require OTP for portfolio chat**
2. **Require OTP for contact submissions**
3. **Require OTP for CV exports**

Show a short warning when any is off: visitor email OTP verification is disabled for that surface.

## Server behavior

Policy sync includes the three flags (and mirrored `strictOtpForAll`).

| Surface | Gate |
| --- | --- |
| Chat `/api/chat/live/start` (and verify path) | If `!requireOtpForChat` (and not incident): issue session without OTP challenge; keep rate limits / enableLiveChat checks |
| Contact OTP issue/verify | If `!requireOtpForContact`: skip issuing OTP; use existing non-OTP success path when applicable |
| CV download | `shouldStepUpOtp` becomes false when `!requireOtpForCv`; `FORCE_CV_OTP` env still forces OTP if set |

`/api/access-config` (or equivalent) should expose effective flags so the client can skip OTP UI steps instead of sending codes that the server will ignore inconsistently.

## Client behavior

- **ChatWidget:** If chat OTP not required, after register details go straight to chat (no OTP mode), calling the relaxed start endpoint.
- **Contact / CV modals:** Honor `forceOtp` / new flags from access-config so they don’t show OTP UI when disabled.

## Data & rules

- Extend `PortfolioSettings`, sanitize, defaults, tests, Redis policy shape, `policy-sync` body.
- Update `firestore.rules` `isValidPortfolioSettings` `hasAll` / `hasOnly` + bool checks for the three fields; keep `strictOtpForAll` during migration window (both present and equal on write).
- Deploy rules before or with the client that always writes the new keys.

## Security notes

- Owner-only writes (existing primary-owner gate).
- Disabling OTP in production is intentional and powerful; console copy must state that clearly.
- Incident mode overrides: effective require flags forced true while incident is on (same pattern as other lockdown fields).

## Testing

- Unit: sanitize defaults; incident forces requires true; migration read from legacy `strictOtpForAll`.
- Server: chat start without OTP when flag false; CV step-up skipped; contact path skipped; incident still requires.
- Manual: owner toggles off → chat/contact/CV complete without OTP locally; toggle on → OTP returns.

## Rollout

1. Rules deploy (accept new keys + legacy).
2. Ship server + client.
3. Later cleanup PR: drop `strictOtpForAll` after one production release.
