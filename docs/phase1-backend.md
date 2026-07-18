# Phase 1 Backend — Identity, RBAC, Media, Location

**Branch:** `grok/phase1-backend`  
**Scope:** Backend only (no production frontend)

## API contracts

### Auth

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | No | Body: `{ email, password, displayName?, phone? }`. Sets `gc_session` cookie. Always assigns `USER` role. |
| POST | `/auth/login` | No | Body: `{ email, password }`. Generic `INVALID_CREDENTIALS` on failure. Rate limited. |
| POST | `/auth/logout` | Yes | Revokes current session; clears cookie. |
| POST | `/auth/logout-all` | Yes | Revokes all user sessions; clears cookie. |
| GET | `/auth/me` | Yes | Returns public user (no passwordHash). |

**Cookie:** `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `NODE_ENV=production`.

**Session:** Opaque random token; only SHA-256 hash stored in `Session.tokenHash`.

### Media

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/media/upload` | Yes | multipart field `file`. JPEG/PNG/WebP only. |
| GET | `/media/:id` | Yes | Metadata + `downloadPath` (no FS paths). |
| GET | `/media/:id/content` | Yes | Streams bytes (owner or admin). |
| DELETE | `/media/:id` | Yes | Soft-delete + storage delete. |

### Location

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/locations` | Yes | Creates exact + derived public row. |
| GET | `/locations/:id/exact` | Yes | Owner or admin only. |
| GET | `/locations/:id/public` | Yes | Coarse coords + admin areas; no street/exact. |

### Health (unchanged)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Readiness: 200 DB+PostGIS up; 503 otherwise; process stays alive. |

### Error shape

```json
{
  "error": {
    "code": "STRING",
    "message": "human message",
    "details": {},
    "requestId": "uuid-or-client-id"
  }
}
```

Header: `x-request-id` echoed/generated on every response.

## Security decisions

1. Email+password MVP; phone optional; Argon2id hashing.
2. Opaque session tokens; hash-only at rest; fixation prevention via new token on login/register.
3. Roles `USER | ADMIN | CLEANUP_PARTNER`; never client-assignable; Buyer is not a role.
4. Deny-by-default guards + ownership policy + authorization matrix.
5. Origin check on unsafe methods for cookie CSRF defense in depth.
6. Media: magic-byte validation, re-encode, EXIF strip, private keys, app streaming only.
7. Location: exact vs public tables; public JSON tests forbid private keys.
8. Audit log for auth, media, location privileged actions.

## Frontend contract handoff

- Use `credentials: 'include'` on all API calls.
- Configure web origin in `CORS_ORIGINS`.
- Do not send `roles` / `status` on register.
- Prefer Next rewrite proxy `/api/*` → Nest for same-site cookies.
- Media: upload multipart; display via authenticated `downloadPath` (blob/fetch with cookies), never expect public CDN URLs in Phase 1.
- Location: render `public` for maps; request `exact` only when authorized.
- Shared Zod schemas live in `@greencity/shared`.

## Migrations

1. `20260717000001_init_user_session`
2. `20260717120000_enable_postgis`
3. `20260718000001_phase1_identity_media_location` — enums, harden User, AuditLog, MediaAsset, LocationExact/Public
