# GreenCity — Implementation Roadmap

**Status:** Phase 0 revised for **Docker-free** local development (native PostgreSQL + PostGIS).  
**Repo state:** pnpm monorepo; Nest API; Next web; Prisma User/Session; local storage/mail ports.

---

## 0. How to read this plan

- Phases are **sequential** unless noted parallel-safe.
- **Payment provider integration is blocked** until domain model + state machines are stable.
- No fake test results: acceptance means commands actually executed successfully.
- **Docker is not required for local development.** Optional for CI/deploy only.

### Document baseline

| Deliverable | Path |
|-------------|------|
| Project context | `docs/project-context.md` |
| Domain model | `docs/domain-model.md` |
| State machines | `docs/state-machines.md` |
| Architecture | `docs/architecture.md` |
| Security risks | `docs/security-risks.md` |
| Testing strategy | `docs/testing-strategy.md` |
| This roadmap | `docs/implementation-roadmap.md` |

---

## Phase 0 — Repository foundation (revised)

**Goal:** Runnable modular monolith skeleton on **native Windows PostgreSQL + PostGIS**.

**Dependencies:** None.

### Work

1. Initialize git repository and `.gitignore` (including `.local/` runtime data).
2. pnpm workspaces: `apps/web`, `apps/api`, `packages/shared` (no Turborepo).
3. NestJS API: env validation, health (+ PostGIS check); Next.js App Router shell.
4. **Native DB tooling** (not Docker): scripts for create DB, enable PostGIS, migrate, verify.
5. Prisma init + migrations: User/Session + `CREATE EXTENSION postgis`.
6. Object storage port: **local filesystem** (S3 interface stub for later).
7. Mail port: **console/file** (SMTP interface stub for later).
8. Shared Zod health/error shapes; root scripts: `lint`, `typecheck`, `test`, `build`.
9. `.env.example`; README with **Windows-native** install/dev commands.
10. CI skeleton (lint + typecheck + unit placeholder). Docker Compose optional only.

### Acceptance criteria (revised)

- [x] `pnpm install --frozen-lockfile` succeeds.
- [x] `pnpm lint` and `pnpm typecheck` succeed.
- [x] `pnpm test` succeeds.
- [x] `pnpm --filter api build` and `pnpm --filter web build` succeed.
- [x] Prisma migrations apply on native local PostgreSQL.
- [x] Database connectivity verification succeeds.
- [x] `SELECT PostGIS_Version()` succeeds.
- [x] API `/health` returns OK with database + postgis up.
- [x] Web application starts and serves the Phase 0 shell.
- [x] Git history exists; README documents Windows-native commands.
- [x] Docker / MinIO / MailHog are **not** required for the above.

### Exit checkpoint

Scaffold exists on native Postgres+PostGIS; still no domain features. **Phase 1 not started.**

---

## Phase 1 — Identity, RBAC, media, location privacy primitives

**Goal:** Secure base for all later features.

**Dependencies:** Phase 0.

### Work

1. Register/login/logout; Postgres sessions; HttpOnly cookies; password hashing.
2. Roles: `user`, `admin`, `cleanup_partner`; never client-settable.
3. Authz helpers + deny-by-default; audit log table.
4. MediaModule using storage port (local or S3 when configured).
5. LocationExact / LocationPublic + DTO redaction.
6. Unit tests for redaction and authz matrix.

### Acceptance criteria

- [ ] Unauthenticated users cannot access protected routes.
- [ ] Role elevation via API body fails.
- [ ] Media objects private per storage driver.
- [ ] Public DTOs never emit exact coordinates.
- [ ] Unit tests for authz + geo redaction pass.
- [ ] Lint/typecheck/build still pass.

---

## Phases 2–6

Unchanged in intent from prior plan (marketplace → reserve → pay → cleanup → harden).  
**Do not** reintroduce Docker/MinIO/MailHog as local requirements.

Payment integration remains blocked until domain model + state machines are stable and a provider is chosen.

---

## Explicit non-goals until post-MVP

- Microservices, Kubernetes, blockchain, AI image recognition, realtime chat
- Bidding
- Mandatory Docker for local development
