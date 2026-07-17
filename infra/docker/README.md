# Optional Docker stack (not required for local development)

The project owner’s **default local workflow is native Windows PostgreSQL + PostGIS**.

This directory is retained only as an **optional** convenience for CI or teammates who prefer containers.

## Do not use this for mandatory Phase 0 setup

Use instead:

- `pnpm db:setup`
- `pnpm db:postgis`
- `pnpm db:migrate`
- `pnpm db:verify`

See the root [README.md](../../README.md).

If you still choose Compose on a machine that has Docker:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Object storage and mail for local Phase 0 use **filesystem/console adapters**, not MinIO/MailHog.
