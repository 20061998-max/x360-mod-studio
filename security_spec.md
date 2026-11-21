# Security Specification & TDD Plan — X360 Mod Studio

## 1. Data Invariants
1. **Bootstrapped & Trusted Admin Isolation**: Admin privileges can ONLY come from a verified server email matching the owner (`josuelroque05052020@gmail.com` with `email_verified == true`) or an existing document in `/admins/{uid}`. Regular users can never write to `/admins/{uid}` or set any role/admin field on `/users/{uid}`.
2. **PII Isolation**: `/users/{userId}` contains `email` and `displayName` and is readable (`get`) strictly by the owner (`request.auth.uid == userId`) or an admin (`isAdmin()`). `list` on `/users` is strictly admin-only.
3. **Admin-Only Plan & Billing Pricing Control**: `/plans/{planId}` and `/siteSettings/billing` are publicly readable (`get`, and `list` only on `/plans`) so visitors can inspect subscription options, while all writes (`create`, `update`, `delete`) are strictly `isAdmin()` with strict field allowlists and bounds.
4. **Tamper-Proof Subscription Entitlement**: `/subscriptions/{userId}` is the authoritative record for whether a user has an active subscription. Only `isAdmin()` can create, update, or delete documents in `/subscriptions/{userId}`. A subscriber can only `get` their own document.
5. **Plan-Bound Subscription Requests & Anti-Price-Spoofing**: A signed-in, email-verified user can create a `/subscriptionRequests/{requestId}` ONLY with `userId == request.auth.uid`, `status == 'pending'`, `adminNote == ''`, `createdAt == request.time`, `updatedAt == request.time`, referencing an existing active `/plans/{planId}` whose `priceCents` and `durationDays` strictly match the referenced plan document.
6. **Terminal State Locking**: Once a `/subscriptionRequests/{requestId}` transitions to `'approved'` or `'rejected'`, non-admins cannot modify or delete it. Non-admins cannot transition `'pending'` to `'approved'` or `'rejected'`.
7. **ID Poisoning & Shadow Field Prevention**: Every single-doc path parameter enforces `isValidId(id)` (`^[a-zA-Z0-9_-]+$`, `<= 128` chars), every string enforces `.size()` limits, every array enforces `.size() <= 10`, and every create/update strictly validates `hasAll` + `hasOnly` / `affectedKeys().hasOnly()`.
8. **Product Showcase (`showcaseItems`)**: Only `published == true` items are readable by non-admin visitors (`allow list` requires `existing().published == true || isAdmin()`); unpublished items and all creates/updates/deletes require `isAdmin()`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Self-Grant Admin Role**: Non-admin authenticated user attempts `setDoc('/admins/{myUid}', { uid: myUid, email: 'attacker@x.com', addedBy: myUid, createdAt: serverTimestamp() })` -> **PERMISSION_DENIED**.
2. **Shadow Field Injection on User Profile**: Authenticated user creates `/users/{myUid}` with an extra ghost field `{ ..., isAdmin: true, subscriptionActive: true }` -> **PERMISSION_DENIED** (`hasOnly` rejects ghost keys).
3. **Self-Activate Paid Subscription**: Authenticated user attempts `setDoc('/subscriptions/{myUid}', { userId: myUid, status: 'active', durationDays: 3650, ... })` -> **PERMISSION_DENIED**.
4. **Modify Plan Price Without Admin**: Non-admin user attempts `updateDoc('/plans/mensal', { priceCents: 1, updatedAt: serverTimestamp() })` -> **PERMISSION_DENIED**.
5. **Spoof Request Price/Duration**: Authenticated user creates `/subscriptionRequests/req1` referencing `planId: 'anual'` (real price `7990`), but sets `priceCents: 0, durationDays: 36500` -> **PERMISSION_DENIED** (relational `get()` enforces exact match with `/plans/anual`).
6. **Self-Approve Subscription Request**: Authenticated user creates `/subscriptionRequests/req2` with `status: 'approved'` (skipping `'pending'`) -> **PERMISSION_DENIED**.
7. **Update Request Status to Approved (Non-Admin)**: Authenticated user updates their own pending `/subscriptionRequests/req1` changing `status` to `'approved'` -> **PERMISSION_DENIED**.
8. **Mutate Terminal Approved Request (Non-Admin)**: Authenticated user attempts to update `paymentReference` on an already `'approved'` request -> **PERMISSION_DENIED** (terminal state locked).
9. **Spoof Another User's Request**: User A creates `/subscriptionRequests/req3` with `userId: 'userB'` -> **PERMISSION_DENIED**.
10. **PII Scraping via `/users` List or Cross-Get**: Non-admin User A calls `getDocs('/users')` or `getDoc('/users/userB')` -> **PERMISSION_DENIED**.
11. **Unverified Admin Email Spoof**: User with `request.auth.token.email == 'josuelroque05052020@gmail.com'` and `email_verified == false` attempts admin write on `/plans/mensal` -> **PERMISSION_DENIED**.
12. **Resource Poisoning / Oversized ID & Features Array**: Admin or user attempts write with 500-char `planId` or 25-item `features` array or forged past `createdAt` timestamp -> **PERMISSION_DENIED**.

## 3. Red Team Audit Matrix
- **Identity Spoofing**: Blocked on `/users`, `/subscriptions`, `/subscriptionRequests`, and `/admins` via `request.auth.uid` checks and immutable `userId`/`uid` checks on update.
- **State Shortcutting**: Blocked on `/subscriptionRequests` create (`status == 'pending'`) and update (only `isAdmin()` can set `'approved'`/`'rejected'`).
- **Resource Poisoning**: Blocked via `isValidId()`, `.size()` checks on every string, `.size() <= 10` on `features`, and `request.time` server timestamp checks.
- **Query Trust Test**: `allow list` on `/subscriptionRequests` enforces `isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid)`. `allow list` on `/users`, `/admins`, `/subscriptions` strictly guards PII (`isAdmin()` or `resource.data.userId == request.auth.uid`).
