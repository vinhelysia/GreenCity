# GreenCity

GreenCity is a pnpm monorepo for a recycling marketplace + cleanup platform (API + web).

**Phase 0 only — no marketplace features yet.** Scaffold: NestJS API, Next.js web, Prisma (`User` / `Session`), native local PostgreSQL + PostGIS, local filesystem storage, console mail.

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
pnpm install
copy .env.example .env

# Create role + database (default admin: postgres / postgres)
# Override: $env:PGPASSWORD = "your-admin-password"
pnpm db:setup

# Enable PostGIS (after PostGIS binaries are installed into PostgreSQL)
pnpm db:postgis

# Prisma client + migrations
pnpm db:generate
pnpm db:migrate

# Verify connectivity + SELECT PostGIS_Version()
pnpm db:verify
```

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

### Health

```powershell
Invoke-RestMethod http://localhost:3001/health
# expect: status "ok", checks.database "up", checks.postgis "up"
```

API **refuses to start** if `DATABASE_URL` is missing/invalid or PostgreSQL is unreachable (clear error message — no silent empty boot).

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
DATABASE_URL=postgresql://greencity:greencity@localhost:5432/greencity?schema=public
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
