# GreenCity — Testing Strategy

**Status:** Planning  
**Stack target:** NestJS, Next.js, PostgreSQL + PostGIS, Prisma, Playwright, Docker Compose

---

## 1. Test pyramid

```
        /\
       /E2E\          few: Playwright journeys
      /------\
     /Integr.\       many: API + DB + races
    /----------\
   /   Unit     \    most: pure domain rules
  /--------------\
```

### Unit (no DB, no HTTP)

| What | Examples |
|------|----------|
| Reward calculation | Deterministic function of inputs + `rule_version` |
| Final amount | `unitPrice × confirmedWeight` (integer VND rules) |
| Status machines | Legal vs illegal edges |
| Quote in range | min/max inclusive boundaries |
| Geo redaction helpers | Strip exact coords by role |
| DTO/Zod validation | Shape only |

**Tool:** Jest or Vitest. Prefer pure functions.

### Integration (real Postgres/PostGIS)

| What | Examples |
|------|----------|
| One accepted reservation/order per listing | Unique constraint + service |
| Subscription gate | 403 without active sub |
| Reward ledger append-only | No `users.balance` write; sum integrity |
| Status via commands only | Free-form status rejected |
| Cleanup workflow | Transitions + single reward |
| Location authorization | Response matrix by actor |
| Payment amount lock | Client amount ignored |
| Concurrency | Parallel reserve/accept/pay/reward |

**Tool:** Nest testing module / supertest + real PostGIS (Testcontainers or Compose test DB).

### E2E (Playwright)

| What | Examples |
|------|----------|
| Marketplace happy path | Submit → quote → accept → reserve → weight → pay → reward |
| Subscription UX gate | Unsubscribed buyer blocked |
| Cleanup happy path | Report → verify → assign → evidence → complete → reward |
| Location privacy | Network response has no exact coords for unauthorized |

**Avoid:** Exhaustive validation matrices in E2E (keep in unit/integration).

---

## 2. Critical integration scenarios

### I1 — Backend-only status transitions

- Client attempt to set terminal status directly → `4xx`; DB unchanged.
- Legitimate command → only allowed next state.

### I2 — One accepted reservation/order per listing

- Buyer A accepted; buyer B fails with conflict.
- DB: `count(accepted) === 1` for listing.

### I3 — Final amount = price × confirmed weight

- `finalAmount === P * W` (integer policy documented).
- Client-supplied amount rejected.
- Weight change after payment blocked (or compensating flow only).

### I4 — Subscription required for buyers

- No/expired sub → reserve fails; no row created.
- Active sub → succeeds.

### I5 — Append-only reward ledger

- New credit row; prior rows immutable.
- Balance = sum(entries).
- Assert no mutable balance SoT write.

### I6 — Deterministic rewards

- Same inputs + rule version → same amount every time.
- `rule_version` stored on entry.

### I7 — Cleanup workflow integrity

- Illegal skips fail.
- Double approve / double reward: one reward max.
- Rejected reports never mint rewards.
- Partner cannot complete to rewarded.

### I8 — Location not leaked

- Unauthorized GET listing/report/search: no exact lat/lng/address.
- Authorized actors per policy see exact.

### I9 — Quote within category range

- Outside range rejected; boundaries per product rule.
- Historical quotes keep snapshot after range change.

### I10 — Payment only after weight locked

- Pay without confirmed weight blocked.
- After confirm, amount locked for payment.

---

## 3. Concurrency tests

Run true parallel requests against real Postgres.

| ID | Race | Accept |
|----|------|--------|
| C1 | Two buyers reserve/accept same listing | Exactly one winner; other 409/domain error |
| C2 | Parallel payments / webhook retries | One success payment; idempotent |
| C3 | confirmWeight ∥ cancel; complete ∥ complete | Coherent terminal state |
| C4 | Double reward mint workers | Exactly one ledger row per source key |

**Harness notes**

- Prefer unique constraints + transactions over check-then-act alone.
- Tag `@concurrency`; do not flake-retry concurrency failures.
- Catch Prisma `P2002` as expected conflict path.

---

## 4. E2E happy and failure paths

### Happy

| ID | Flow | Pass criteria |
|----|------|---------------|
| E1 | Marketplace end-to-end | Amount and reward match rules |
| E2 | Location privacy in UI + network | Coarse before gate; exact after |
| E3 | Cleanup end-to-end | Reward once after admin complete |
| E4 | Subscribe then reserve | Pre-block; post-success |
| E5 | In-range quote/list | Listing searchable |

### Failure

| ID | Flow | Pass criteria |
|----|------|---------------|
| F1 | Unsubscribed reserve | Clear error; no reservation |
| F2 | Second buyer after lock | Error; first remains sole |
| F3 | Out-of-range price | Validation; no create |
| F4 | Tampered status from client | Server rejects; refresh consistent |
| F5 | Double-click pay | Single charge/success |
| F6 | Unauthorized location in network | Keys absent in JSON |
| F7 | Cleanup reject | No reward |

### Practice

- Seed via API/DB; `storageState` per role.
- Assert network for privacy, not only DOM.
- Keep suite small (~10–20 specs); edges in integration.

---

## 5. Fixtures strategy

| Persona | Traits |
|---------|--------|
| `seller_active` | Can submit/list |
| `buyer_subscribed` | Active sub |
| `buyer_expired` | Sub ended |
| `buyer_none` | Never subscribed |
| `partner_assigned` | Cleanup role |
| `admin` | Ops |
| `stranger` | Unrelated third party |

Factories: User, Subscription, Category+Range, Submission, Listing, Reservation, Order, Payment, RewardLedger, DumpReport, Assignment.

Principles: deterministic seeds; per-test isolation (truncate or transaction); worker-scoped DB if parallel.

External: **mock** payment provider; never real PSP in CI.

---

## 6. CI gates (when CI exists)

```
lint/typecheck → unit → integration (+concurrency) → build → e2e smoke → full e2e on main
```

| Gate | Blocking |
|------|----------|
| ESLint + `tsc --noEmit` | Yes |
| Unit | Yes |
| Integration I1–I10 | Yes |
| Concurrency C1–C4 | Yes for money/status PRs |
| Docker build | Yes |
| Playwright smoke (E1, F1, F6) | Yes on PR |
| Full Playwright | Yes on `main` |

Coverage: hard thresholds on domain packages (rewards, orders, reservations, cleanup) first; avoid vanity global %.

Any PR touching reservations, payments, rewards, status, location DTOs, or cleanup **must** update/add matching tests.

---

## 7. Definition of done for domain features

- [ ] Behavior documented (states, actors, formulas).
- [ ] API rejects client-authored `status` / `finalAmount` / `rewardAmount` / balance.
- [ ] DB constraints match invariants.
- [ ] Required tests per table below green.
- [ ] Migration included.
- [ ] Idempotency for payment/reward side effects.
- [ ] No secrets in fixtures.

| Rule | Required tests |
|------|----------------|
| Status transitions | Unit machine + integration illegal transition |
| One accepted per listing | Integration + **concurrency** |
| finalAmount formula | Unit + integration |
| Buyer subscription | Integration + E2E F1 |
| Append-only ledger | Integration + concurrency double-mint |
| Deterministic rewards | Unit table-driven + integration |
| Cleanup workflow | Integration matrix + reward once |
| Location privacy | Integration by role + E2E network |
| Quote in range | Unit boundaries + integration |

### Explicit “not done”

- Works in Swagger only.
- App-level check without unique constraint for dual-writer races.
- Balance on user without ledger SoT.
- Location hidden in UI but present in JSON.

---

## 8. Suggested suite layout (when code exists)

```text
apps/api/src/**/*.spec.ts
apps/api/test/integration/**
apps/api/test/concurrency/**
apps/api/test/fixtures/**
e2e/**/*.spec.ts
```

### Implementation priority for tests

1. Unit: amount, reward, status graph, price range  
2. Integration: I2, I3, I4, I5, I8  
3. Concurrency: C1, C2, C4  
4. E2E smoke: E1, F1, F6  
5. Remaining matrix  

---

## 9. Current repo status

**No tests exist and none were run.** Greenfield — this document is the target strategy only.
