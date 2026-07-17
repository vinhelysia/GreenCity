# GreenCity — Project Context

**Document status:** Phase 0 scaffold (Docker-free local workflow)  
**Date:** 2026-07-17  
**Mode:** Implementation Phase 0 only

---

## 1. What GreenCity is

GreenCity is a **responsive web platform** with two business domains:

| Domain | Vietnamese | Purpose |
|--------|------------|---------|
| **A. Marketplace** | Chợ online | Users submit recyclable scrap; GreenCity quotes; accepted items become fixed-price listings; subscribed buyers purchase; platform-mediated payment; seller reward after settlement |
| **B. Cleanup contribution** | Đóng góp | Users report illegal dumping; GreenCity verifies/dedupes; cleanup partners complete work with evidence; reporter reward after verified completion |

Currency is **VND** (integer đồng). There is **no bidding** in the MVP.

---

## 2. Local development policy

| Policy | Detail |
|--------|--------|
| **Docker** | **Not required** for the project owner’s local workflow |
| **Database** | Native **PostgreSQL + PostGIS** on Windows |
| **Object storage (Phase 0)** | Local filesystem adapter under `.local/storage` |
| **Mail (Phase 0)** | Console (or file) adapter — no MailHog |
| **Production later** | S3-compatible storage + real SMTP via the same ports/interfaces |

Docker Compose under `infra/docker/` may remain as an **optional** CI/deploy convenience, never as a mandatory local prerequisite.

---

## 3. Preferred technical direction

| Layer | Choice |
|-------|--------|
| Architecture | Modular monolith |
| Monorepo | pnpm workspaces (**no Turborepo**) |
| Frontend | Next.js App Router + TypeScript |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL + PostGIS (native local) |
| ORM | Prisma (+ raw SQL for PostGIS) |
| UI | Tailwind CSS (+ shadcn/ui later) |
| Object storage | Port: local FS now → S3-compatible later |
| Mail | Port: console/file now → SMTP later |
| Tests | Unit, integration, Playwright E2E (later phases) |

### Explicitly out of MVP scope

- Microservices, Kubernetes (local)
- Blockchain, custom wallets
- AI image recognition
- Real-time chat
- Bidding / auctions
- Invented payment-provider features

---

## 4. Hard product constraints

1. Frontend does not control status transitions.
2. At most one accepted reservation/order per listing.
3. Rewards use an append-only ledger (not `users.balance` as SoT).
4. Exact addresses not public before authorization.
5. Buyer actions require active subscription (50,000 VND/month).
6. Final amount = unit price × confirmed weight.
7. Payment integration only after domain/state machines stable.
8. Do not invent provider capabilities.

---

## 5. Phase 0 scope confirmation

**Implemented:** monorepo, Nest health + env validation, Next shell, Prisma User/Session, PostGIS migration, local storage + mail ports, Windows DB scripts.

**Not implemented:** marketplace, cleanup, payment, subscription, rewards, completed authentication.

---

## 6. Related documents

| Document | Contents |
|----------|----------|
| [domain-model.md](./domain-model.md) | Actors, aggregates, invariants |
| [state-machines.md](./state-machines.md) | Marketplace, cleanup, payment, reward machines |
| [architecture.md](./architecture.md) | Modules, layout, storage/mail ports |
| [security-risks.md](./security-risks.md) | Risk register |
| [testing-strategy.md](./testing-strategy.md) | Test pyramid |
| [implementation-roadmap.md](./implementation-roadmap.md) | Phased plan |
