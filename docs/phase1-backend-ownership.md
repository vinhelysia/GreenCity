# Phase 1 Backend — Task Graph & File Ownership

**Branch:** `grok/phase1-backend`
**Base:** `3acf9e20bfbab3443024569293a7b3cdec31229d`
**Integration lead:** exclusive owner of integration-critical paths

## Task graph

```text
[Integration] schema.prisma + migration + packages/shared + root deps
        │
        ├─► [Platform] cookies, validation, errors, request-id, CORS  (main/platform/*)
        │
        ├─► [Auth] register/login/logout/me sessions                 (auth/**)
        │         depends on: schema, shared, platform helpers
        │
        ├─► [RBAC] guards, roles, ownership, authz matrix, audit     (authz/**, audit/**)
        │         depends on: schema, shared, auth session types
        │
        ├─► [Media] upload pipeline, streaming, MediaAsset           (media/**)
        │         depends on: schema, shared, storage port, authz
        │
        └─► [Location] exact/public, redaction, policies             (location/**)
                  depends on: schema, shared, authz

[Testing] unit + Nest/supertest + PG integration tests
        depends on: all modules

[Security Reviewer] independent review (read-only)
        depends on: implementation complete

[Integration] app.module.ts wire-up + full verification + lockfile
```

## Exclusive integration-lead ownership

| Path | Notes |
|------|-------|
| `apps/api/prisma/schema.prisma` | Schema SoT |
| `apps/api/src/app.module.ts` | Final module graph |
| `packages/shared/**` | Cross-boundary contracts |
| `package.json` (root) | Root scripts/deps |
| `pnpm-lock.yaml` | Lockfile |
| Final integration & verification | Drift, full suite, health |

## Subagent ownership (non-overlapping)

### 1. Prisma and Migration Agent
| Owns | Does not touch |
|------|----------------|
| `apps/api/prisma/migrations/**` (new Phase 1 migration SQL only) | `schema.prisma` (lead writes), app source |

### 2. Authentication and Session Agent
| Owns | Does not touch |
|------|----------------|
| `apps/api/src/auth/**` | `schema.prisma`, `shared/**`, media/location/authz |

### 3. RBAC and Authorization Agent
| Owns | Does not touch |
|------|----------------|
| `apps/api/src/authz/**` | auth business endpoints, media/location domain |
| `apps/api/src/audit/**` | |

### 4. Media Security Agent
| Owns | Does not touch |
|------|----------------|
| `apps/api/src/media/**` | auth, location domain |
| May extend `apps/api/src/storage/**` with `getObject` only | |

### 5. Location Privacy Agent
| Owns | Does not touch |
|------|----------------|
| `apps/api/src/location/**` | auth, media |

### 6. Backend Testing Agent
| Owns | Does not touch |
|------|----------------|
| `apps/api/test/**` | production module internals except via public API |
| `apps/api/jest.config.*`, test scripts coordination | |

### 7. Independent Security Reviewer
| Owns | Does not touch |
|------|----------------|
| Review findings only (no code edits unless lead assigns) | Implementation writes |

## Shared contracts (lead-owned)

Published in `@greencity/shared` before module agents land:

- `UserRole`, `UserStatus` enums
- Auth request/response Zod schemas
- API error contract
- Public location DTO shape
- Media asset public DTO shape (no filesystem paths)

## Out of scope (all agents)

- Marketplace, cleanup, subscription, payment, rewards entities/APIs
- Production frontend
- S3 implementation
- Password reset / email verification (deferred)
- Docker-mandatory local workflow
- Merging integration branches / reopening Phase 0 without regression
