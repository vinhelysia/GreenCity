# GreenCity

GreenCity is a pnpm monorepo for a recycling marketplace + cleanup platform (API + web).

Working today: email/password auth (Argon2id, opaque DB-backed sessions), and a scrap-marketplace vertical slice — sellers submit scrap with a photo, admins quote within a published price band, sellers accept, listings go live, and subscribed buyers reserve (one winner per listing, enforced transactionally). Stack: NestJS API, Next.js web, Prisma, native local PostgreSQL + PostGIS, local filesystem storage, console mail.

Not implemented, and not faked: real payment, buyer subscription billing, seller reward payout, and the cleanup-report workflow.

**Docker is not required for local development.**

## Prerequisites (Windows)

| Tool | Notes |
|------|--------|
| Node.js 20+ | |
| pnpm 9 | `npm i -g pnpm@9` |
| PostgreSQL 16+ | [EnterpriseDB Windows installer](https://www.postgresql.org/download/windows/) |
| PostGIS | Stack Builder → Spatial Extensions → PostGIS Bundle, **or** [OSGeo Windows bundles](https://download.osgeo.org/postgis/windows/) matching your PG major version |

Optional later: Docker only for CI/deploy — not for the owner’s local workflow.

## Setup (native PostgreSQL)

```powershell
# From repo root
pnpm install --frozen-lockfile
copy .env.example .env
# Edit .env: set real DATABASE_URL (placeholders only in .env.example)

# Credentials for setup scripts (required — no insecure defaults)
$env:PGPASSWORD = '<postgres-admin-password>'
$env:GREENCITY_DB_PASSWORD = '<app-role-password>'
# optional: $env:GREENCITY_DB_USER / $env:GREENCITY_DB_NAME (default greencity)

pnpm db:setup
pnpm db:postgis   # after PostGIS binaries are installed into PostgreSQL
pnpm db:generate  # no live DB required
pnpm db:migrate
pnpm db:verify    # SELECT 1 + PostGIS_Version()

pnpm --filter api db:seed   # demo accounts, categories, sample listings
```

### Demo accounts (local only)

`pnpm --filter api db:seed` is idempotent and creates three accounts, all with
password `GreenCity-Demo-2026`:

| Email | Role | For |
|-------|------|-----|
| `admin@greencity.demo` | ADMIN | Quoting queue at `/admin/bao-gia` |
| `seller@greencity.demo` | USER | Submitting scrap at `/ban-phe-lieu` |
| `buyer@greencity.demo` | USER + demo subscription | Reserving at `/cho-online` |

Local demo only. On any shared or deployed database, set a `DEMO_PASSWORD`
env var before seeding — the default above is public.

### Install PostGIS on Windows (once per machine)

1. Open **Application Stack Builder** (ships with EnterpriseDB PostgreSQL), select your PostgreSQL install, install **Spatial Extensions → PostGIS Bundle**, **or**
2. Download the matching installer/zip from [download.osgeo.org/postgis/windows](https://download.osgeo.org/postgis/windows/) (e.g. `pg16` for PostgreSQL 16) and install into the same PostgreSQL prefix.
3. Confirm control file exists, e.g.  
   `C:\Program Files\PostgreSQL\16\share\extension\postgis.control`
4. Run `pnpm db:postgis` then `pnpm db:verify`.

## Development

```powershell
pnpm --filter @greencity/shared build
pnpm dev:api   # http://localhost:3001
pnpm dev:web   # http://localhost:3000
```

### Health (readiness only)

`GET /health` is a **readiness** probe, not liveness.

| Condition | Result |
|-----------|--------|
| DB + PostGIS up | HTTP **200**, `status: ok` |
| DB unreachable | API **stays running**, HTTP **503**, `database`/`postgis` down |
| Missing/invalid env | **Startup fails** (clear error; only monorepo-root `.env` is loaded) |

```powershell
# HTTP status matters — use Invoke-WebRequest for 503 cases
(Invoke-WebRequest http://localhost:3001/health).StatusCode
```

## Storage & mail (Phase 0)

| Concern | Local default | Production interface (later) |
|---------|---------------|------------------------------|
| Objects | `STORAGE_DRIVER=local` → `.local/storage` | `STORAGE_DRIVER=s3` (S3-compatible adapter stub) |
| Email | `MAIL_DRIVER=console` (or `file` → `.local/mail`) | `MAIL_DRIVER=smtp` (stub until Phase 1+) |

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm lint` / `typecheck` / `test` / `build` | Monorepo quality gates |
| `pnpm dev:api` / `dev:web` | Dev servers |
| `pnpm db:setup` | Create `greencity` role + database |
| `pnpm db:postgis` | `CREATE EXTENSION postgis` |
| `pnpm db:generate` | Prisma generate |
| `pnpm db:migrate` | Prisma migrate deploy |
| `pnpm db:migrate:dev` | Prisma migrate dev |
| `pnpm db:verify` | Connectivity + `PostGIS_Version()` |

## Environment

See [`.env.example`](.env.example). Minimum:

```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public
API_PORT=3001
STORAGE_DRIVER=local
MAIL_DRIVER=console
```

## CI

GitHub Actions runs install → lint → typecheck → test → build. Local Postgres/PostGIS remains the primary developer path.

## Docs

Planning and domain notes: [`docs/`](docs/). Start with:

- [`docs/project-context.md`](docs/project-context.md)
- [`docs/implementation-roadmap.md`](docs/implementation-roadmap.md)
- [`docs/architecture.md`](docs/architecture.md)
