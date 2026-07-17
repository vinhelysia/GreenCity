# GreenCity

GreenCity is a monorepo scaffold for a local marketplace platform (API + web).

**Phase 0 only — no marketplace features yet.** This repo currently provides workspace layout, tooling, CI, local infra hooks, and planning docs. Product features come in later phases.

## Prerequisites

- Node.js 20+
- pnpm 9
- Docker

## Setup

```bash
pnpm install
cp .env.example .env
```

## Local infrastructure

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

## Database

```bash
pnpm db:migrate:dev
# or (deploy-style): pnpm db:migrate
```

Generate the Prisma client:

```bash
pnpm db:generate
```

## Development

```bash
pnpm dev:api   # API on http://localhost:3001
pnpm dev:web   # Next.js web app
```

### Health check

```bash
curl http://localhost:3001/health
```

`GET /health` should return a successful response when the API is up.

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm lint` | Lint all packages that define a lint script |
| `pnpm typecheck` | Typecheck all packages that define a typecheck script |
| `pnpm test` | Run tests across the monorepo |
| `pnpm build` | Build all packages/apps |
| `pnpm dev:api` | Start the API in watch/dev mode |
| `pnpm dev:web` | Start the web app in dev mode |
| `pnpm db:generate` | Prisma generate |
| `pnpm db:migrate:dev` | Prisma migrate (dev) |
| `pnpm db:migrate` | Prisma migrate deploy |

## CI

Pushes and pull requests to `main` run install → lint → typecheck → test → build via [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Docs

Domain planning, architecture, roadmap, and related notes live under [`docs/`](docs/). Start with:

- [`docs/project-context.md`](docs/project-context.md)
- [`docs/implementation-roadmap.md`](docs/implementation-roadmap.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/domain-model.md`](docs/domain-model.md)
