# GreenCity — Domain Model

**Status:** Planning  
**Sources:** Product brief + Domain Analyst + Database/Security cross-checks

---

## 1. Actors and roles

| Actor | Role key | Capabilities |
|-------|----------|--------------|
| **Seller** | recyclable submitter | Submit scrap; accept/reject quote; track listings/orders; receive seller reward after settlement |
| **Buyer** | marketplace purchaser | Browse public listings; reserve/purchase **only with active** 50,000 VND/month subscription; pay final amount via GreenCity |
| **Reporter** | cleanup tipster | Submit illegal-dump reports; track status; receive reporter reward after verified completion |
| **Admin / Operator** | platform authority | Review scrap; issue quotes within category range; verify/reject/dedupe reports; assign partners; verify cleanup; confirm operational steps; configure price ranges and reward rules |
| **Cleanup partner** | field executor | Work assigned jobs; submit before/after evidence; cannot self-approve completion rewards |
| **System** | policy enforcer | Owns transitions; subscription gates; single-reservation locks; payment confirmation; append-only reward ledger; deterministic reward calc |

**Notes**

- One **User** account may act as seller, buyer, and/or reporter over time.
- **Buyer** is a capability gated by **active subscription**, not a permanent separate user type.
- **Partner** is an operational role (may later map to partner org accounts).

---

## 2. Bounded contexts (modular monolith)

| Context | Responsibility |
|---------|----------------|
| **Identity** | Users, sessions, roles |
| **Catalog / Pricing** | Scrap categories, public min–max unit price ranges |
| **Marketplace** | Submission → quote → listing → reservation → weight confirm → settle |
| **Subscriptions** | Buyer monthly access window |
| **Payments** | Thin payment lifecycle for orders (and later subscriptions) |
| **Cleanup** | Dump report → verify/dedupe → assign → evidence → complete |
| **Rewards** | Deterministic rules + append-only ledger |
| **Media** | Upload metadata; S3 keys; attach to submissions/reports/evidence |
| **Location** | Exact vs public geo; privacy gates |

Cross-context calls go through **exported application services** (or in-process events). No HTTP between modules.

---

## 3. Marketplace workflow (Chợ online)

### Happy path

```
Submit scrap → Admin review → Issue quote (price in range)
  → Seller accept → Listing live
  → Buyer reserves (subscription required)
  → Confirm actual weight → final_amount = unit_price × confirmed_weight
  → Buyer pays via GreenCity
  → Settlement → Seller reward 2,000–5,000 VND (ledger)
```

### Steps

| # | Step | Actor | Outcome |
|---|------|-------|---------|
| 1 | Submit scrap | Seller | Photos, category, estimated qty/weight, location → submitted |
| 2 | Review | Admin | Accept into quote flow or reject |
| 3 | Quote | Admin | Specific unit price ∈ public category range |
| 4 | Respond | Seller | Accept → listing; reject → terminal |
| 5 | Discover | Buyer | Fixed listed unit price (no bidding) |
| 6 | Reserve | Buyer | Requires active subscription; **one** active hold per listing |
| 7 | Confirm measure | TBD (see open Q1) | Confirmed weight/qty for billing |
| 8 | Invoice | System | `final_amount = agreed_unit_price × confirmed_actual_weight` |
| 9 | Pay | Buyer → GreenCity | Provider-mediated; server confirms success |
| 10 | Settle + reward | System | Commercial close; seller reward via rules |

### Pricing

- **CategoryPriceRange** (public, admin-configurable): `min_unit_price`, `max_unit_price`, unit (e.g. VND/kg).
- **Quote/listing unit price**: fixed value in range at quote time; **snapshot** range + price so later config edits do not rewrite history.
- **Commercial settlement**: uses **confirmed** measure, never estimate alone.
- **Seller reward**: separate from scrap sale economics; 2,000–5,000 VND; deterministic; ledgered.

---

## 4. Cleanup workflow (Đóng góp)

### Happy path

```
Report dump → Admin verify + dedupe → Assign partner
  → Partner before/after evidence → Completion submitted
  → Admin verifies completion → Reporter reward 2,000–10,000 VND (ledger)
```

### Steps

| # | Step | Actor | Outcome |
|---|------|-------|---------|
| 1 | Report | Reporter | Images, description, waste type, GPS, address |
| 2 | Triage | Admin | Valid / reject / duplicate |
| 3 | Assign | Admin | Cleanup partner selected |
| 4 | Execute | Partner | Evidence; optional in-progress |
| 5 | Partner complete | Partner | Completion package (not yet rewarded) |
| 6 | Verify completion | Admin | Accept → completed; rework or cancel |
| 7 | Reward | System | Deterministic grant; ledger append |

### Dedup intent

- Same physical dump must not create multiple independent paid completions.
- Duplicates link to a **canonical** report; reward policy controlled (see open Q11).

---

## 5. Core aggregates (conceptual)

| Aggregate | Responsibility |
|-----------|----------------|
| **User** | Identity, roles, status |
| **BuyerSubscription** | Active validity window for reserve/pay gates |
| **CategoryPricePolicy** | Public min–max per category |
| **ScrapSubmission** | Pre-list intake and quote |
| **Listing** | Public fixed-price offer; reservation lock |
| **Reservation** | Buyer hold with TTL (policy TBD) |
| **Order** | Commercial claim for a listing |
| **Payment** | Amount, status, provider refs (when chosen) |
| **DumpReport** | Report lifecycle |
| **CleanupAssignment** | Partner job + evidence |
| **RewardRule** | Versioned deterministic parameters |
| **RewardLedgerEntry** | Append-only credits/debits |
| **MediaAsset** | Storage keys + ownership |
| **LocationExact / LocationPublic** | Privacy split |

---

## 6. Domain invariants

### Cross-cutting

1. Server owns state; clients send **commands**, never raw terminal statuses as truth.
2. Prices, weights, “I paid”, and reward amounts from the client are **never trusted**.
3. Money is **integer VND**.
4. Admin/system actions that change money or status are **auditable** (who/when/why).

### Marketplace

5. Quote unit price ∈ [category.min, category.max] at quote time; store price + range snapshot.
6. Listed unit price fixed for MVP buyers (no auction, no buyer counter-offer).
7. `final_amount = unit_price × confirmed_actual_measure`.
8. **At most one** accepted/live reservation or non-terminal order per listing.
9. Reserve requires **active subscription** at command time (re-check at payment start recommended).
10. Buyer pays **GreenCity**, not the seller directly.
11. Seller reward only after settlement eligibility; 2,000–5,000 VND; `rule_version` recorded.
12. No double seller reward for one settled listing (idempotency key).

### Cleanup

13. Reporter reward only after admin-verified **COMPLETED**, not partner self-complete.
14. Reporter reward 2,000–10,000 VND; deterministic + `rule_version`.
15. Duplicate/canonical policy prevents independent full rewards without explicit product rule.
16. No double reporter reward for one completed cleanup case.

### Rewards and payments

17. Reward **ledger is append-only**; derived balance = sum of entries. No `users.balance` SoT.
18. Payment success only from **provider confirmation** processed server-side (once provider exists).
19. Idempotent reserve, payment webhook, and reward post.
20. Do not invent provider features (escrow split, wallet top-up, etc.) until documented by a real provider.

---

## 7. Suggested command surface (domain language)

### Marketplace

`SubmitScrap`, `ReviewScrap`, `IssueQuote`, `AcceptQuote`, `RejectQuote`,  
`ReserveListing`, `ReleaseReservation`, `ConfirmActualWeight`,  
`StartPayment`, `HandlePaymentProviderEvent`, `CompleteSettlement`, `PostSellerReward`

### Cleanup

`SubmitReport`, `VerifyReport`, `MarkDuplicate`, `AssignPartner`,  
`SubmitCleanupEvidence`, `VerifyCleanupCompletion`, `PostReporterReward`

### Config

`SetCategoryPriceRange`, `PublishRewardRuleVersion`

---

## 8. Unresolved questions

| ID | Topic | Why it matters |
|----|--------|----------------|
| Q1 | Who confirms actual weight? | Gates payment amount and disputes |
| Q2 | Logistics: who picks up scrap? | Extra states vs thin MVP |
| Q3 | Reservation TTL and cancel rights | Reopen listing fairness |
| Q4 | Quote TTL if seller silent | Expired vs admin nudge |
| Q5 | Seller commercial proceeds vs reward-only | Payment/payout model |
| Q6 | Subscription renew, grace, mid-reservation expiry | Gate at reserve vs pay |
| Q7 | Mixed materials in one submission? | One listing vs line items |
| Q8 | Units: always kg vs pcs | Pricing model |
| Q9 | Reward rule inputs (weight band, category, first-time, geo)? | Determinism requires explicit factors |
| Q10 | Reward payout channel for MVP | Ledger-only vs cash-out |
| Q11 | Duplicate report reward policy | Primary only / split / none |
| Q12 | Partner SLA / reassignment | Extra ops states |
| Q13 | Service area / city scope | Validation on submit |
| Q14 | KYC before money movement | Fraud and compliance |
| Q15 | Tax / e-invoice | Legal documents |
| Q16 | Re-submit after reject | New entity vs reopen |
| Q17 | Listing visibility when reserved | UX and double-intent pressure |
| Q18 | Partial fulfill / large weight delta | Cancel vs adjust policy |
| Q19 | Self-dealing (buy own listing) | Abuse surface |
| Q20 | Payment provider choice | Integration design — **blocked until chosen** |

---

## 9. Explicit non-goals (domain)

- Bidding or dynamic buyer pricing
- Peer-to-peer chat as a domain object
- AI auto-classification of scrap/photos
- On-chain tokens or user crypto wallets
- Microservices per domain
