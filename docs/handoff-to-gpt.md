# GreenCity — Full Handoff Report for GPT / Next Agent

**Date:** 2026-07-17
**Workspace:** `C:\Stuff\GreenCity`
**OS:** Windows
**Branch:** `master`
**HEAD:** `1010d161f626add499ca0af8ca5777310f8f7846`
**Phase 0 status:** **HARDENED & MERGED**
**Tag (after handoff commit):** `phase-0-hardened`
**Git status:** clean after handoff update

**Hardening note:** Codex findings were independently reimplemented, reviewed, and verified on `integration/phase0-hardening` (not cherry-picked). Source tip at merge: `113f566` (includes `f12054c` + docs hygiene).

---

## 1. Mission summary

GreenCity is a **responsive web platform** with two domains:

### A. Chợ online (Marketplace)
1. User submits recyclable materials (photos, category, estimated qty/weight, location).
2. GreenCity reviews and quotes; public configurable price range per category (e.g. 1,000–1,500 VND/kg).
3. Admin picks specific price within range; user accepts/rejects.
4. On accept → marketplace listing (fixed price, **no bidding**).
5. Buyers need **active subscription 50,000 VND/month**.
6. Buyers reserve/purchase at fixed price.
7. Final amount = agreed unit price × **confirmed actual weight**.
8. Buyer pays through GreenCity.
9. After settlement, seller reward **2,000–5,000 VND** via deterministic rules + append-only ledger.

### B. Đóng góp (Cleanup contribution)
1. User reports illegal dumping (images, description, waste type, GPS, address).
2. GreenCity verifies + dedupes.
3. Assign cleanup partner → partner before/after evidence.
4. GreenCity verifies completion.
5. Reporter reward **2,000–10,000 VND** via deterministic rules + ledger.

### Hard constraints (never violate)
- Modular monolith only (no microservices, K8s, blockchain, custom wallets, AI vision, realtime chat for MVP).
- Frontend **must not** control status transitions (command API + server state machines).
- No double accepted reservation/order per listing (DB partial unique + transactions).
- **No** `users.balance` as reward source of truth — append-only ledger.
- Do not expose exact seller/report addresses before authorization.
- Do not invent payment-provider capabilities; **no payment integration until domain + state machines stable**.
- **Docker is NOT required for local development** (project owner mandate). Native Windows PostgreSQL + PostGIS.

---

## 2. Current completion status

| Phase | Status |
|-------|--------|
| **Planning docs** | Complete under `docs/` |
| **Phase 0** (scaffold + hardening) | **COMPLETE, VERIFIED, MERGED TO MASTER** (Docker-free) |
| **Phase 1+** | **NOT STARTED** |

### Explicitly NOT implemented yet
- Authentication (login/register/cookies/guards) — only User/Session **schema**
- RBAC enforcement, media upload flows, location privacy layers
- Marketplace, cleanup, payment, subscription, rewards
- Any domain state machines in code

---

## 3. Git history (relevant)

```
8e4aa36 merge: Phase 0 hardening
113f566 docs: remove concrete admin password example from handoff.
… (hardening on integration/phase0-hardening)
f12054c fix prepare.mjs spawn on Windows
b7fe42d Phase 0 hardening (main fixes)
ea81fd0 docs: full Phase 0 handoff report for next agent (GPT).
9ed7bb5 Phase 0: Docker-free local stack (native Postgres/PostGIS, local storage/mail).
```

**Merge:** `8e4aa36` ← `integration/phase0-hardening` @ `113f566` (hardening core through `f12054c` + docs).

---

## 4. Repository layout

```text
GreenCity/
├── apps/
│   ├── api/          # NestJS modular monolith + Prisma
│   └── web/          # Next.js 15 App Router + Tailwind
├── packages/
│   ├── shared/       # @greencity/shared — Zod HealthStatus, ApiError, APP_NAME
│   └── tsconfig/     # shared TS base
├── scripts/          # Windows-native DB: setup, postgis, verify
├── infra/docker/     # OPTIONAL only — not required for local owner workflow
├── docs/             # planning + this handoff
├── package.json      # pnpm workspace root scripts
├── pnpm-workspace.yaml
├── .env.example
└── README.md
```

**Package manager:** pnpm 9 (`packageManager: pnpm@9.15.0`)
**No Turborepo.**

---

## 5. Stack (as implemented)

| Layer | Choice |
|-------|--------|
| Monorepo | pnpm workspaces |
| API | NestJS 11 + TypeScript (CJS) |
| Web | Next.js 15 App Router + React 19 + Tailwind |
| Shared | Zod contracts in `@greencity/shared` (CommonJS dist) |
| DB | PostgreSQL 16 + PostGIS 3.6 **native Windows** |
| ORM | Prisma 6 |
| Storage | Port `ObjectStorage`: `local` default; `s3` stub |
| Mail | Port `MailSender`: `console`/`file` default; `smtp` stub |
| CI | `.github/workflows/ci.yml` (install → lint → typecheck → test → build) |

---

## 6. Phase 0 API surface (what exists)

### Modules wired in `apps/api/src/app.module.ts`
- `ConfigModule` (global)
- `PrismaModule` / `PrismaService`
- `StorageModule` (global) — inject `OBJECT_STORAGE`
- `MailModule` (global) — inject `MAIL_SENDER`
- `HealthModule` — `GET /health`

### Bootstrap (`main.ts`)
1. Loads `.env` from cwd and `../../.env` via dotenv.
2. `loadEnv()` validates with Zod — fails clearly if bad/missing env.
3. `assertPostgresReachable()` — **process exits** if `SELECT 1` fails (clear Windows setup instructions in error).
4. Listens on `API_PORT` (default 3001); CORS for `http://localhost:3000`.

### Health response shape (`@greencity/shared`)
```json
{
  "status": "ok" | "degraded" | "error",
  "service": "api",
  "timestamp": "<ISO>",
  "checks": { "database": "up"|"down", "postgis": "up"|"down" }
}
```
- `ok` only if both database and postgis are up.
- `degraded` if DB up but PostGIS down.
- `error` if DB down.

### Prisma models (only)
- `User` — id, email?, phone?, displayName?, passwordHash?, roles[], status, timestamps, sessions
- `Session` — id, userId, tokenHash (unique), expiresAt, revokedAt?, userAgent?, ipAddress?
- Migrations:
  - `20260717000001_init_user_session`
  - `20260717120000_enable_postgis` (`CREATE EXTENSION IF NOT EXISTS postgis`)

### Storage / mail interfaces
- `apps/api/src/storage/storage.types.ts` + `local-object-storage.ts` + `s3-object-storage.stub.ts`
- `apps/api/src/mail/mail.types.ts` + console/file + smtp stub
- Local data dirs: `.local/storage`, `.local/mail` (gitignored)

### Web
- Placeholder page: title GreenCity, “Phase 0 shell — no marketplace features”
- Optional rewrite: `/api/*` → `http://localhost:3001/*`
- Port 3000

---

## 7. Environment

Copy `.env.example` → `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public
API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=.local/storage
MAIL_DRIVER=console
MAIL_FILE_DIR=.local/mail
```

Setup scripts require `PGPASSWORD` and `GREENCITY_DB_PASSWORD` (no insecure defaults).

---

## 8. Commands (Windows)

```powershell
cd C:\Stuff\GreenCity

pnpm install --frozen-lockfile
copy .env.example .env

# One-time machine: PostgreSQL 16+ + PostGIS bundle installed into PG
# (Stack Builder Spatial Extensions OR OSGeo installer for pg16)

$env:PGPASSWORD = '<postgres-admin-password>'
$env:GREENCITY_DB_PASSWORD = '<app-role-password>'
pnpm db:setup
pnpm db:postgis
pnpm db:generate
pnpm db:migrate
pnpm db:verify                 # SELECT 1 + PostGIS_Version()

pnpm --filter @greencity/shared build
pnpm dev:api                   # :3001
pnpm dev:web                   # :3000

# Quality
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter api build
pnpm --filter web build
```

**Do not require:** `docker compose`, MinIO, MailHog for local owner workflow.

---

## 9. Phase 0 verification evidence (already executed)

| Check | Result |
|-------|--------|
| `pnpm install --frozen-lockfile` | Pass |
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass (placeholders only) |
| `pnpm --filter api build` | Pass |
| `pnpm --filter web build` | Pass |
| Prisma migrate (native PG) | Pass |
| `pnpm db:verify` / `PostGIS_Version()` | Pass — `3.6 USE_GEOS=1 USE_PROJ=1 USE_STATS=1` |
| `GET /health` | Pass — `database:up`, `postgis:up`, `status:ok` |
| Web homepage | Pass — HTTP 200, GreenCity Phase 0 |

---

## 10. Planning documents (read before Phase 1+)

| Doc | Purpose |
|------|---------|
| `docs/project-context.md` | Product + local policy |
| `docs/domain-model.md` | Actors, invariants, open questions Q1–Q20 |
| `docs/state-machines.md` | Marketplace, cleanup, payment, reward machines |
| `docs/architecture.md` | Module boundaries, ERD, storage/mail ports |
| `docs/security-risks.md` | P0 risks: fraud, double-reserve, payment spoof, location leak, IDOR |
| `docs/testing-strategy.md` | Pyramid, concurrency tests, DoD |
| `docs/implementation-roadmap.md` | Phases 0–6 |

### Phase order (next)
1. **Phase 1** — Auth sessions/cookies, RBAC, media via storage port, location privacy, unit tests
2. **Phase 2** — Catalog + scrap → quote → LISTED (no payment)
3. **Phase 3** — Subscriptions + reservation concurrency
4. **Phase 4** — Weight, payment adapter (provider TBD), settle, seller reward ledger
5. **Phase 5** — Cleanup contribution + reporter reward
6. **Phase 6** — Hardening, observability, launch

### Open product questions that block later design
- **Q1** Who confirms actual weight?
- **Q5** Seller commercial proceeds vs reward-only?
- **Q20** Payment provider (MoMo/ZaloPay/VNPay/…) — **blocks Phase 4**
- **Q9–Q11** Reward rule inputs; payout channel; duplicate-report policy
- Full list in `docs/domain-model.md`

---

## 11. Engineering conventions / ponytail

- Prefer **shortest correct diff**; no speculative abstractions.
- Reuse existing modules/ports; do not reintroduce Docker as mandatory.
- Money: integer VND only.
- Status: command handlers only; never accept client `status` fields as truth.
- Rewards: ledger append-only + idempotency keys.
- Tests: placeholders today; Phase 1+ must add real unit/integration/concurrency per `docs/testing-strategy.md`.
- Windows note: `prisma generate` can EPERM if API process locks query engine DLL — stop API first.

---

## 12. What the next agent should do

### If continuing product work → **Phase 1 only**
1. Read `docs/implementation-roadmap.md` Phase 1 + `docs/security-risks.md` auth sections.
2. Implement register/login/logout with **Postgres Session** (schema exists); HttpOnly cookies; argon2id/bcrypt.
3. Roles on User; never client-settable.
4. Authz helpers + deny-by-default.
5. MediaModule on `OBJECT_STORAGE` (local).
6. LocationExact/LocationPublic + redaction DTOs.
7. Unit tests for authz + geo redaction.
8. Do **not** implement marketplace/cleanup/payment/subscription/reward yet.
9. Re-run lint/typecheck/build; keep health green.

### If only verifying environment
```powershell
pnpm db:verify
pnpm --filter api start   # or dev:api
# GET http://localhost:3001/health
```

---

## 13. Known environment facts (this machine)

- PostgreSQL 16 installed under `C:\Program Files\PostgreSQL\16`
- PostGIS 3.6.2 bundle installed into that prefix (OSGeo Windows setup)
- DB/user: `greencity` / `greencity` on `localhost:5432`
- Docker CLI **not** used / not required for local owner workflow
- Node 20+ / pnpm 9.15.0
- See branch `integration/phase0-hardening` for Phase 0 hardening integration

---

## 14. Confirmation for next agent

1. **Phase 0 is closed** under Docker-free criteria.
2. **Do not rebuild Phase 0** unless something is broken.
3. **Do not implement domain commerce** until Phase 1 foundations land.
4. **Do not make Docker mandatory** again.
5. Authoritative planning lives in `docs/*`; this handoff summarizes state for session transfer.

---

*End of handoff. Paste this file or its contents into the next GPT/agent session with instruction: “Continue from Phase 1 using docs/handoff-to-gpt.md and docs/implementation-roadmap.md.”*
