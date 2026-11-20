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

