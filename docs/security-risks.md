# GreenCity — Security Risks

**Status:** Planning (greenfield threat model, not a code audit)  
**Scope:** Recycling marketplace + illegal dumping reports (Vietnam, VND)

---

## 1. Security design principles (MVP)

1. **Server is the authority** — status, money, rewards, roles, subscription, location precision are never client truth.
2. **Deny by default** — authenticate → authorize → validate → state machine → audit.
3. **Money and inventory as ledgers/events** — reservations, payments, rewards: unique keys + idempotency.
4. **Least privilege by role** — partner cannot self-approve rewards; buyer needs active subscription.
5. **Public vs privileged DTOs** — coarse location by default; exact only after authorization.
6. **State machines in code** — no free-form status PATCH.
7. **Idempotency on money paths** — payment webhooks, reward grants, reservation confirms.
8. **Privacy by design for location** — exact coords access-controlled; EXIF stripped on public images.
9. **Uploads are untrusted** — allowlist, size limits, private storage, signed URLs.
10. **Assume fraud until verified for rewards** — admin gates; velocity limits; delayed first payouts optional.
11. **Boring auth** — established hashing, TLS, no custom crypto.

---

## 2. Prioritized risk register

| ID | Risk | Severity | Likelihood | Priority | Mitigation |
|----|------|----------|------------|----------|------------|
| R1 | **Reward / cleanup fraud** — fake reports, staged photos, GPS spoof, farming | Critical | High | **P0** | Admin verification before reward; append-only ledger; rate limits; velocity checks; immutable evidence; void path |
| R2 | **Double reservation / double order** on one listing | Critical | High | **P0** | `FOR UPDATE` + partial unique indexes; map conflicts to 409; concurrency tests |
| R3 | **Payment spoof / webhook forgery** | Critical | Med–High | **P0** | Never trust client “paid”; verify provider signatures; amount match; unique provider event ids (**after provider chosen**) |
| R4 | **Location leakage** of exact seller/dump addresses | High | High | **P0** | Public vs exact tables/DTOs; reveal only post-authorization; strip EXIF |
| R5 | **IDOR** on listings, orders, reports, media | Critical | High | **P0** | Resource-level authz on every read/write; deny-by-default tests |
| R6 | **Weak auth / session hijack** | High | Med–High | **P0** | HttpOnly Secure cookies; session revoke; argon2id/bcrypt; login rate limits |
| R7 | **Subscription bypass** | High | High | **P0** | Server gate on reserve/pay; subscription only advanced by verified payment |
| R8 | **Malicious uploads** | High | Med–High | **P1** | MIME allowlist; re-encode/strip metadata; size limits; private bucket; signed GET |
| R9 | **Privilege escalation** (self-assign admin/partner) | Critical | Medium | **P0** | Roles only via admin/ops paths; never from client body |
| R10 | **Illegal status transitions** from client | High | High | **P0** | Command API + state machines only |
| R11 | **PII over-collection / log leakage** | High | Medium | **P1** | Minimize fields; mask GPS/phone in logs; retention policy |
| R12 | **Account farming for rewards** | Med–High | High | **P1** | Unique phone; velocity; review queues; first-payout delay |
| R13 | **Payment disputes / inconsistent inventory** | High | Medium | **P1** | Clear order states; refund only via backend; freeze listing on dispute |
| R14 | **CSRF on cookie sessions** | Medium | Medium | **P1** | SameSite; CSRF if needed; rotate session on login |
| R15 | **Admin panel compromise** | Critical | Low–Med | **P1** | MFA for admin; audit force-transitions; no shared passwords |
| R16 | **Map enumeration / scraping** | Medium | High | **P2** | Auth + rate limits on geo queries; coarse public tiles |
| R17 | **Deep-link token leakage** | Medium | Medium | **P2** | Short-lived signed links; no secrets in URLs |
| R18 | **Regulatory / privacy (VN PDPD-style) and payment licensing** | High | Medium | **P1** | Privacy notice/consent; no card PAN storage; counsel review before public launch — **not legal advice** |

**P0 for first money-adjacent paths:** R1–R7, R9–R10.  
**P1 before public launch with real money:** R8, R11–R15, R18.

---

## 3. Role capability matrix (intent)

| Capability | User (seller/reporter) | Buyer (active sub) | Partner | Admin |
|------------|------------------------|--------------------|---------|-------|
| Submit scrap / report | Yes | Yes | — | Yes |
| Issue quote / verify report | No | No | No | Yes |
| Browse public listings (coarse geo) | Yes | Yes | Yes | Yes |
| Reserve / buy | No | **Yes** | No | Ops only |
| See exact listing location | Owner; after authorized deal | After authorized gate | N/A | Yes |
| See exact dump location | Own report (policy) | No | **Assigned only** | Yes |
| Submit cleanup evidence | No | No | Assigned | Yes |
| Mark cleanup completed | No | No | No | Yes |
| Post rewards | No | No | No | System after rules |
| Change roles | No | No | No | Yes |

---

## 4. Domain-specific controls

### Authentication

- Phone OTP and/or email+password; rate-limit OTP (cost + abuse).
- Sessions: revoke on password change; logout-all optional.
- MFA for `admin` before production.

### Payments (provider-agnostic — do not invent capabilities)

Safe MVP model once a real provider is chosen:

1. Create order server-side (`amount_vnd`, listing, buyer, idempotency key).  
2. Start provider checkout; store provider session/ref.  
3. Webhook: verify signature → load order → assert amount/status → `PENDING → SUCCEEDED` once.  
4. Only then unlock fulfillment/exact location per policy.  
5. Refunds only via backend + provider API if supported.

**Do not start payment integration until domain model and state machines are stable.**

### Location privacy

| Audience | Data |
|----------|------|
| Anonymous / browsing | District/ward or grid centroid; no street/exact pin |
| Active buyer browsing | Same coarse (optional slightly tighter grid) |
| After authorized reservation/payment | Exact pin + pickup instructions |
| Assigned partner | Exact dump pin for assigned job only |
| Admin | Full, audited |

### Uploads

- Allowlist `image/jpeg|png|webp`; max size/dimensions.
- Re-encode; strip EXIF GPS.
- Random object keys; private ACL; signed GET.

### Fraud (lightweight but real)

| Vector | Control |
|--------|---------|
| Fake dump for reward | Admin verify; dual evidence; delay payout |
| Double reservation | Partial unique + row lock |
| Double reward | Unique idempotency / `(source_type, source_id, reason)` |
| Subscription bypass | DB-backed active window checked in service |
| GPS spoof | Photo required; partner/admin gates; optional rate-of-travel later |

### Status transitions

- Single transition module per aggregate.
- Append-only audit: actor, from, to, reason, request_id.
- **No** generic `PATCH` that sets status.

---

## 5. Explicit anti-patterns (reject in design/PRs)

| Anti-pattern | Why |
|--------------|-----|
| Client sends `status: paid/rewarded/completed` | Fraud |
| Client sends `role` or `subscriptionActive` | Privilege escalation |
| Exact lat/lng on public list/map APIs | Safety / doxxing |
| Filter sensitive fields only in UI | API still leaks |
| Trust `Content-Type` alone on uploads | Polyglots |
| Payment success only via return URL | Spoofable |
| Webhooks without signature + idempotency | Double credit |
| Mass-assignment of protected fields | Status/price bypass |
| Reward on upload alone | Farming |
| Mutable `users.balance` as ledger SoT | Lost audit / races |
| Multiple concurrent accepted reservations per listing | Double-sell |
| Client-computed reward amount | Inflation |
| Invented PSP escrow/split features | False security |

---

## 6. Open security questions

1. Identity primary: phone OTP, email, or both? SIM recycle recovery?
2. Payment provider and real webhook/refund guarantees?
3. Does GreenCity hold funds and pay sellers, or match only with separate settlement?
4. Who funds rewards (company vs municipal)? Caps per user/day?
5. Partner trust model (employees vs freelancers)?
6. Exact location unlock: at reserve, pay, or seller accept?
7. Public dump map vs login-gated?
8. Data residency / legal entity / counsel on PDPD-style duties?
9. Admin MFA and who holds prod admin?
10. Cash-out of rewards: bank/e-wallet KYC thresholds?
11. Self-dealing rules (buy own listing)?
12. Retention of GPS + photos after case closed?
13. Subscription grace after expiry?
14. Dispute ownership for no-show / no-pay?

---

## 7. Security delivery order (when building)

| Phase | Deliver |
|-------|---------|
| Foundations | Authn, sessions, RBAC helpers, audit log, secrets hygiene |
| Data isolation | Coarse vs exact DTOs; private media; mass-assignment hard rules |
| Commerce integrity | Reservation/order machines; (later) payment webhooks; subscription gate |
| Trust & safety | Cleanup machine; reward ledger; admin verify; velocity limits |
| Privacy & ops | Privacy notice/consent; PII redaction; admin MFA |
| Hardening | Abuse analytics; duplicate image detect |

---

## 8. Stance

GreenCity’s highest risks are **authorization mistakes, location exposure, forged payment success, racey reservations, and reward fraud** — not exotic crypto. MVP security should be boring, centralized, and money-safe.

No payment-provider capabilities are assumed beyond what a chosen provider documents. This document is **not legal advice**.
