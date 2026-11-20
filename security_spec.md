# Firestore Security Specification — Announcements & Admin RBAC

## Phase 0: Data Invariants
1. **Owner-Only Mutations**: Only the verified portfolio owner (`sufyan.net@gmail.com` with `email_verified == true` or a trusted UID record in `/admins/{uid}`) may create, update, or delete announcements.
2. **Public Non-PII Read**: `/announcements` stores strictly public portfolio announcements (no emails, phones, or PII) and is readable by visitors without authentication.
3. **Immutable Provenance & Temporal Integrity**: `authorUid` must match `request.auth.uid`, `createdAt == request.time` on creation, `createdAt` and `authorUid` are immutable on updates, and `updatedAt == request.time`.
4. **Strict Field Allowlisting**: Extra/ghost fields (`isVerified`, `role`, etc.) are rejected via `keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update.
5. **Admin Self-Promotion Impossible**: `/admins/{adminId}` denies all client `list`, `create`, `update`, and `delete` operations.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated `create` on `/announcements/ann-x` -> **DENIED** (`!isSignedIn()`).
2. Signed-in non-owner user (`attacker@example.com`, verified) `create` on `/announcements/ann-x` -> **DENIED** (`!isAdmin()`).
3. Spoofed admin email with `email_verified: false` -> **DENIED** (`request.auth.token.email_verified != true`).
4. Owner creates doc with extra ghost field `{ ..., isPinned: true }` -> **DENIED** (`keys().hasOnly(...)`).
5. Owner creates doc missing required field (`linkUrl` omitted) -> **DENIED** (`keys().hasAll(...)`).
6. Owner creates doc with client-forged timestamp (`createdAt: new Date(0)`) -> **DENIED** (`createdAt == request.time`).
7. Owner creates doc with `authorUid` set to someone else's UID -> **DENIED** (`authorUid == request.auth.uid`).
8. Owner updates doc changing `createdAt` or `authorUid` -> **DENIED** (`affectedKeys().hasOnly(...)` + immutability).
9. Owner injects `javascript:alert(1)` or `http://` into `linkUrl` -> **DENIED** (`^$|^https://[^\\s]+$`).
10. Owner injects invalid `badge` value (`"HACKED"`) -> **DENIED** (`badge in [...]`).
11. Oversized `summary` (> 600 chars) or `title` (> 180 chars) or document ID (> 128 chars / invalid chars) -> **DENIED**.
12. Authenticated user attempts `create` or `list` on `/admins/{uid}` -> **DENIED** (`allow list, create, update, delete: if false`).

## CV Download Audit Logs (`/cv_downloads/{downloadId}`) Invariants
6. **Strict PII Isolation**: `/cv_downloads` contains `visitorEmail`, `visitorPhone`, and `ipAddress`. Public visitors and non-owner signed-in users are strictly forbidden from reading (`get` or `list`) any document. Only verified owner `sufyan.net@gmail.com` (or trusted `/admins/{uid}`) may read/list/delete.
7. **Immutable Append-Only Audit Trail**: Updates to `/cv_downloads/{downloadId}` are globally denied (`allow update: if false`).
8. **Strict Schema & Size Bounds on Create**: Every create must provide exact allowlisted keys, valid `downloadId`/`sessionId` IDs matching path, `createdAt == request.time`, valid enum values (`action`, `theme`, `verificationStatus`, `riskLevel`), boolean type checks on risk flags, and capped string lengths.

## Additional Dirty Dozen Checks for `/cv_downloads/{downloadId}`
- Unauthenticated or non-owner signed-in `get` / `list` on `/cv_downloads` -> **DENIED**.
- Spoofed `sufyan.net@gmail.com` with `email_verified: false` attempting `list` or `delete` on `/cv_downloads` -> **DENIED**.
- Public visitor attempting `update` on `/cv_downloads/{id}` -> **DENIED**.
- Public visitor attempting `create` with ghost field (`isVerifiedAdmin: true`) or `downloadId != pathId` or forged `createdAt` -> **DENIED**.
- Public visitor injecting 50KB `reason` or `userAgent` string (Denial-of-Wallet) -> **DENIED**.

## Contact Inquiry Logs (`/contact_messages/{messageId}`) Invariants
9. **Strict PII Isolation**: `/contact_messages` stores sender emails, phones, message bodies, and IP addresses. Public visitors and non-owner signed-in users are strictly forbidden from reading (`get` or `list`) any record. Only verified `sufyan.net@gmail.com` (or trusted `/admins/{uid}`) may read/list/delete/triage.
10. **Immutable Core + Owner-Only Triage Updates**: Core message fields (`messageId`, `senderName`, `senderEmail`, `senderPhone`, `subject`, `message`, `ipAddress`, `createdAt`, etc.) are permanently immutable. Visitors creating a record cannot inject `triageStatus`, `ownerNote`, or `triagedAt`. Only verified admins may update `triageStatus`, `ownerNote`, and `triagedAt` (`triagedAt == request.time`).
11. **Schema & Size Bounds**: Every create/update validates the shared `isValidContactMessageLog` blueprint (`affectedKeys().hasOnly(['triageStatus', 'ownerNote', 'triagedAt'])` on update), preventing Denial-of-Wallet payload bloat.

## Admin Audit Logs (`/admin_audit_logs/{auditId}`) Invariants
12. **Owner-Only Governance Trail**: Strictly restricted to verified `sufyan.net@gmail.com` (or `/admins/{uid}`) for `get`, `list`, `create`, and `delete`; updates are globally denied (`allow update: if false`). `actorUid == request.auth.uid` and `createdAt == request.time` are enforced on create.

## Portfolio Feature & Maintenance Settings (`/portfolio_settings/{settingsId}`) Invariants
13. **Public Non-PII Config + Owner-Only Mutations**: Only document ID `'global'` may be publicly `get`-read (`list` is denied). Create/update requires verified owner/admin, strict key allowlist, `updatedByUid == request.auth.uid`, and `updatedAt == request.time`. Deletes are denied.

## Access Allowlist / Blocklist Rules (`/access_rules/{ruleId}`) Invariants
14. **PII-Isolated Security Policy**: Rule values (emails, domains, IPs) are strictly owner-only for `get`, `list`, `create`, and `delete` (`update` denied). `createdByUid == request.auth.uid` and `createdAt == request.time` are enforced on create.

## Additional Dirty Dozen Checks
- Unauthenticated or non-owner user attempting `get`, `list`, or `update` on `/contact_messages`, `/admin_audit_logs`, or `/access_rules` -> **DENIED**.
- Public visitor attempting `create` on `/contact_messages` with pre-populated `triageStatus` or `ownerNote` -> **DENIED**.
- Owner attempting `update` on `/contact_messages` altering `senderEmail`, `message`, or `createdAt` -> **DENIED**.
- Unauthenticated or non-owner user attempting `create` or `update` on `/portfolio_settings/global`, or `get` on `/portfolio_settings/other` -> **DENIED**.
- Spoofed `actorUid` or `createdByUid` or `updatedByUid` differing from `request.auth.uid` -> **DENIED**.

