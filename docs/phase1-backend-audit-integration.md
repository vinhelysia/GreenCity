# Phase 1 Backend Audit Integration

**Integration branch:** `integration/phase1-backend-reviewed`
**Base backend:** `fcf404e` (`grok/phase1-backend`)
**Codex audit:** `70c0f997` (`codex/audit-phase1-backend`)
**Application method:** `git cherry-pick 70c0f997` (no conflicts)

## Review decision

**Phase 1 backend accepted with documented deployment follow-up.**

Codex security fixes are accepted as cherry-picked. No Critical/High blockers remain on the Phase 1 surface. Production proxy hop topology remains an explicit deploy follow-up (trust proxy stays disabled).

## Proxy / rate-limit interim policy

**Selected: Policy 2 interim (Next same-origin rewrite) without enabling `trust proxy`.**

| Setting | Value |
|---------|--------|
| trust proxy | **disabled** (do not set `true`) |
| Topology (local/default) | Browser → Next `/api/*` rewrite → Nest |
| Client IP source | Express socket IP (`req.ip`) |
| X-Forwarded-For | **not trusted** |
| Known limitation | Shared rate-limit bucket for all clients behind the same Next/proxy hop |
| Production follow-up | Choose direct Nest exposure **or** configure **exactly one** trusted proxy hop / narrow CIDR before enabling proxy trust |

## CSRF / Origin policy

| Case | Behavior |
|------|----------|
| Valid allowlisted Origin | Allowed on unsafe methods |
| Invalid / denied Origin | `403` `{ error: { code: INVALID_ORIGIN, ... requestId } }` |
| Missing Origin + cookie session | **Rejected** (`INVALID_ORIGIN`) |
| Missing Origin + no cookie + `Authorization: Bearer <opaque-session>` | Allowed (explicit non-browser path) |
| `Origin: null` / duplicate Origin | Rejected |
| Same-origin Next rewrite | Browser still sends real page Origin; keep `CORS_ORIGINS` aligned |

Public endpoints (`@Public`): `GET /health`, `POST /auth/register`, `POST /auth/login`. All other routes require authentication via global `AuthenticatedGuard`.

## Scope

No Phase 2 marketplace/cleanup/subscription/payment/rewards. No production frontend features on this branch.
