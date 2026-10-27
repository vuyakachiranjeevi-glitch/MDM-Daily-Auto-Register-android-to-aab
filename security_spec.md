# 🔐 PRODUCTION-GRADE SECURITY SPECIFICATION & AUDIT COMPLIANCE

**Applet ID**: `71a44c73-db3d-4a29-87e5-0569d0a93d24`  
**System Architecture**: Multi-Tenant School Midday Meal (MDM) System with Full Data Isolation  
**Database**: Cloud Firestore (`ai-studio-remixmiddaymealm-71a44c73-db3d-4a29-87e5-0569d0a93d24`) + Node.js Server Persistence  
**Date**: September 2026  

---

## 1. Core Security Architecture

### 1.1 Account Lifecycle & State Machine
The application enforces strict state-machine transitions across the full user lifecycle:
```text
SIGN UP
   ↓ (Generates cryptographically random 6-digit OTP, expires in 5m)
UNVERIFIED
   ↓ (Timing-safe OTP verification on server)
OTP_VERIFIED
   ↓ (School profile & baseline allocation)
ACTIVE
   ↓ (Session creation with 32-byte secure bearer token)
AUTHORIZED APPLICATION ACCESS
```
* **Enforcement**: Only `ACTIVE` accounts can access protected data endpoints. Suspended or unverified accounts are blocked server-side by `requireAuth`.
* **Lockout Protection**: Account lockouts after 5 consecutive failed login attempts (15-minute sliding window cooldown).

### 1.2 Multi-Tenant Data Isolation (IDOR / BOLA Defensive Gate)
* **School Scoping**: Every school's data is isolated using immutable keys: `school_data/${schoolId}__${key}` in Firestore and `.data/schools/${schoolId}.json` on the server.
* **Server Verification**: In all `/api/data/*` routes, `schoolId` is derived exclusively from the authenticated session token (`req.userSession.schoolId`). Client-supplied IDs are never trusted as proof of ownership.
* **Firestore Rules Hardening**:
  - `isValidDocId`: Validates document identifiers (1-128 characters, strict alphanumeric + `_.-`).
  - `isSafePayload`: Enforces presence of `data` and `updatedAt`.
  - Immutable `schoolId`: `resource.data.schoolId == request.resource.data.schoolId` prevents hijacking or cross-tenant overwrites.
  - Catch-all default: `allow read, write: if false;`.

### 1.3 OTP & Session Security
* **Cryptographic Randomness**: OTPs generated via `crypto.randomInt(100000, 1000000)`.
* **Zero Plaintext Storage**: All OTPs stored as PBKDF2-SHA-512 hashes with independent cryptographically secure salts.
* **TTL & Cooldown**: 5-minute hard expiration, 60-second resend cooldown, 5 maximum verification attempts.
* **Session Revocation**: Password reset immediately invalidates all active sessions for the school.

---

## 2. Critical Business Logic & Data Invariants

### 2.1 Negative Value Preservation (Requirement 16)
* **Invariant**: Opening Balance (OB) for **Eggs** and **Chikki** CAN legitimately be negative (due to advance indent arrivals / deferred supply credits).
* **Guarantees**:
  - `src/lib/storage.ts`: Explicitly exempts `egg` and `chikki` from non-negative clamping (`isEggOrChikki` check).
  - `src/lib/utils.ts`: Calculates closing balance without `Math.max(0, ...)` clamping on commodity totals.
  - Server `/api/data/commodity-overrides`: Rejects negative values for rice, oil, pulses while strictly permitting negative balances for eggs and chikki.

### 2.2 Idempotency & Race Condition Defense
* **Mechanism**: Server-side idempotency cache (`x-idempotency-key`) with a 15-minute sliding window.
* **Protection**: Double taps, mobile network drops, and retry loops return the cached result rather than duplicating transactions, daily entries, or cash vouchers.

---

## 3. Defense Audit Matrix ("The Dirty Dozen" Payloads)

| # | Threat Vector | Target | Defensive Mitigation | Audit Result |
|---|---------------|--------|----------------------|--------------|
| 1 | BOLA/IDOR Data Hijack | `GET /api/data/records` with spoofed schoolId | `schoolId` derived strictly from `session.schoolId` on server | **BLOCKED (401/Isolated)** |
| 2 | Brute Force Login | `POST /api/auth/login` | Max 5 failed attempts locks account for 15 minutes + IP rate limiter | **MITIGATED** |
| 3 | OTP Enumeration | `POST /api/auth/register-verify-otp` | 5 attempts max, timing-safe equality, rate limiting per IP and mobile | **MITIGATED** |
| 4 | Stored Password Leakage | Storage / DB inspection | PBKDF2-SHA-512 with unique salt, 10,000 iterations; no plaintext in storage | **VERIFIED CLEAN** |
| 5 | Double Tap Duplicate Voucher | `POST /api/data/cash-voucher` | `x-idempotency-key` dedup cache prevents duplicate voucher creation | **BLOCKED (Idempotent)** |
| 6 | Cross-School Password Reset | `POST /api/auth/forgot-password-reset` | Reset token bound to target `schoolId` and single-use invalidation | **BLOCKED** |
| 7 | Negative Rice/Oil Corruption | `POST /api/data/commodity-overrides` | Server validates non-negative for rice, oil, pulses; preserves eggs/chikki | **VALIDATED** |
| 8 | Large Payload DoS | `POST /api/*` | Express JSON body parser strictly capped at 1MB | **BLOCKED (413)** |
| 9 | Clickjacking / Framing | Web client | HTTP Header `X-Frame-Options: SAMEORIGIN` | **ENFORCED** |
| 10 | MIME-Type Sniffing | Static assets & API responses | HTTP Header `X-Content-Type-Options: nosniff` | **ENFORCED** |
| 11 | Plaintext Credential in Logs | Server logs & console | `sanitizeIdentifier` masks mobile/usernames (`98480*****`); no passwords/OTPs logged | **COMPLIANT** |
| 12 | Stale Session After Reset | Session token | `revokeAllSessionsForSchool` called on password reset | **REVOKED** |

---

## 4. Verification Check
- **Zero UI/UX Regressions**: MDM, Daily Auto Register, Cash Voucher, and Reports tabs remain intact and functional.
- **Offline First**: Local storage operations function without active internet connectivity.
- **Rules Synchronization**: Firestore rules aligned with `firebase-blueprint.json`.
