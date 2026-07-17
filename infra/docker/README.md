# GreenCity local Docker infra (Phase 0)

Postgres (PostGIS), MinIO, and MailHog for local development. App processes (API/web) run on the host.

## Start

From the repo root:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Stop:

```bash
docker compose -f infra/docker/docker-compose.yml down
```

Data volumes are kept on `down`. Use `down -v` to wipe Postgres and MinIO data.

## Services

| Service     | Port(s)       | Notes                                      |
|-------------|---------------|--------------------------------------------|
| `db`        | 5432          | PostGIS 16. User/db/password: `greencity`  |
| `minio`     | 9000, 9001    | API + console. Root: `minioadmin` / `minioadmin` |
| `minio-init`| —             | Creates bucket `greencity`, then exits     |
| `mailhog`   | 1025, 8025    | SMTP + UI at http://localhost:8025         |

## Connection snippets

```text
DATABASE_URL=postgresql://greencity:greencity@localhost:5432/greencity
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=greencity
SMTP_HOST=localhost
SMTP_PORT=1025
```

Local-dev credentials only — do not reuse in production.
