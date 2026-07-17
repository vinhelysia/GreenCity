# GreenCity — Project Context

**Document status:** Planning (no production implementation yet)  
**Date:** 2026-07-17  
**Mode:** Repository discovery + implementation planning

---

## 1. What GreenCity is

GreenCity is a **responsive web platform** with two business domains:

| Domain | Vietnamese | Purpose |
|--------|------------|---------|
| **A. Marketplace** | Chợ online | Users submit recyclable scrap; GreenCity quotes; accepted items become fixed-price listings; subscribed buyers purchase; platform-mediated payment; seller reward after settlement |
| **B. Cleanup contribution** | Đóng góp | Users report illegal dumping; GreenCity verifies/dedupes; cleanup partners complete work with evidence; reporter reward after verified completion |

Currency is **VND** (integer đồng). There is **no bidding** in the MVP.

---

## 2. Confirmed repository facts

| Fact | Evidence |
|------|----------|
| Workspace is effectively **greenfield** | Only `skills-lock.json`, `.claude/skills/**`, `.grok/skills/**` |
| **No application source** | No `apps/`, `src/`, `package.json`, Prisma, Next, Nest |
| **No package manager / monorepo** | No pnpm/npm/yarn lockfiles or workspace config |
| **No git repository** | `git status` → not a git repository |
| **No CI, Docker, lint, test, or build** | No configs or scripts present |
| **No documented install commands** | No README |
| Agent skill scaffolding only | 22 skills locked in `skills-lock.json` (process/design/test guidance, not product code) |

### Build / test status (executed)

| Command category | Result |
|------------------|--------|
| Install | **N/A** — no package manifest |
| Lint | **N/A** — no linter config |
| Type-check | **N/A** — no TypeScript project |
| Unit/integration tests | **N/A** — no test runner |
| Build | **N/A** — no build system |
| Git | **Fail** — not a git repository |

**Verdict:** greenfield / no build system. Nothing was claimed to pass; nothing product-related exists to run.

---

## 3. Preferred technical direction (accepted for planning)

| Layer | Choice |
|-------|--------|
| Architecture | **Modular monolith** (not microservices) |
| Monorepo | pnpm workspaces |
| Frontend | Next.js App Router + TypeScript |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL + PostGIS |
| ORM | Prisma (+ raw SQL for PostGIS) |
| UI | Tailwind CSS + shadcn/ui |
| Object storage | S3-compatible adapter (MinIO local) |
| Tests | Unit, integration, Playwright E2E |
| Local infra | Docker Compose |

### Explicitly out of MVP scope

- Microservices, Kubernetes
- Blockchain, custom wallets
- AI image recognition
- Real-time chat
- Bidding / auctions
- Invented payment-provider features not documented by a chosen provider

---

## 4. Hard product constraints

1. **Frontend does not control status transitions** — clients send commands; server validates and transitions.
2. **At most one accepted reservation/order per listing** — enforced in domain + DB.
3. **Rewards use an append-only ledger** — not a single mutable `users.balance` as source of truth.
4. **Exact seller/report addresses are not public** — coarse location until authorized.
5. **Buyer marketplace actions require an active subscription** (50,000 VND/month).
6. **Final commercial amount** = agreed unit price × confirmed actual weight (not estimate).
7. **Payment integration starts only after** domain model and state machines are stable.
8. **Do not invent** APIs or payment-provider capabilities.

---

## 5. Assumptions (not yet product-confirmed)

| ID | Assumption | Impact if wrong |
|----|------------|-----------------|
| A1 | Single deployable API + one Next.js web app | Multi-app would change monorepo layout |
| A2 | One account can be seller, buyer, and reporter | Self-dealing rules needed if allowed |
| A3 | Admin is a role on User (not separate admin app) | Separate admin SPA if compliance requires |
| A4 | Human review for scrap quotes and cleanup verification (no AI) | Throughput/ops cost |
| A5 | Email/phone identity sufficient for MVP; KYC later for payouts | Fraud and payout compliance |
| A6 | Subscription is flat monthly buyer access (not per-category) | Schema of `BuyerSubscription` |
| A7 | VND amounts stored as integers (đồng) | All money math |
| A8 | English+Vietnamese UI may come later; domain docs in English for engineering | i18n timing |

---

## 6. Recommendations (planning)

1. Scaffold monorepo in **Phase 0** before any domain features.
2. Stabilize **domain model + state machines + schema** before payment provider integration.
3. Keep modules modular but **one Nest process** — in-process events only.
4. Use **partial unique indexes + row locks** for reservation/order races.
5. Implement **reward ledger first** as a small pure module with strong tests.
6. Defer Redis/BullMQ/workers until a concrete reliability need appears.

---

## 7. Unresolved decisions (summary)

Full list lives in `domain-model.md` and `implementation-roadmap.md`. Highest priority:

1. Who confirms actual weight (admin, partner, co-confirm)?
2. Logistics model (pickup who/how)?
3. What commercial proceeds does the seller receive vs platform reward only?
4. Payment provider (MoMo / ZaloPay / VNPay / other) — **do not integrate until chosen with real docs**.
5. Reward payout channel (ledger credit only vs e-wallet/bank cash-out).
6. Quote/reservation TTLs and cancel policies.
7. Duplicate cleanup report reward policy (primary only?).
8. Self-dealing: can buyer purchase own listing?

---

## 8. Related documents

| Document | Contents |
|----------|----------|
| [domain-model.md](./domain-model.md) | Actors, aggregates, invariants, open questions |
| [state-machines.md](./state-machines.md) | Marketplace, cleanup, payment, reward machines |
| [architecture.md](./architecture.md) | Monorepo layout, modules, Mermaid deps, ERD |
| [security-risks.md](./security-risks.md) | Risk register, anti-patterns |
| [testing-strategy.md](./testing-strategy.md) | Pyramid, concurrency, DoD |
| [implementation-roadmap.md](./implementation-roadmap.md) | Phased plan with acceptance criteria |

---

## 9. Process notes

Six specialized agents ran **in parallel** (inspect/report only):

1. Repository Auditor  
2. Domain Analyst  
3. Architecture Agent  
4. Database Agent  
5. Security Agent  
6. Testing Agent  

Architecture agent initially framed a generic map/reports product; **this set of docs is aligned to the actual Chợ online + Đóng góp domains** from the product brief.

**Stop line:** Planning deliverables only. Phase 1 feature implementation has not started.
