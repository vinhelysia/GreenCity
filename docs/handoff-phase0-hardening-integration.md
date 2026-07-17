# GreenCity — Phase 0 Hardening Integration (post-merge)

**Verification date:** 2026-07-17  
**Workspace:** `C:\Stuff\GreenCity`  
**OS:** Windows  

## Status

| Item | Value |
|------|--------|
| **master before merge** | `ea81fd0b1cf1b737117ea5fa27167c6f465af371` |
| **Source branch** | `integration/phase0-hardening` |
| **Expected source marker** | `f12054cf55a45576e87db2a5a1888a45c12dd964` (ancestor) |
| **Source tip at merge** | `113f566660a3dd8bf3b22051bec872d1b2062bb6` |
| **Merge commit** | `8e4aa36a65386967308a20cbb8900a1974a94082` |
| **Tag** | `phase-0-hardened` (annotated after this handoff commit) |
| **Phase 1** | **NOT STARTED** |

## Wording (authoritative)

**Codex findings were independently reimplemented, reviewed, and verified on `integration/phase0-hardening`.**

Do **not** say the Codex patch was cherry-picked. The original `codex/phase0-hardening` branch was unavailable.

## What was verified before merge

- Fresh `pnpm install --frozen-lockfile`, lint, typecheck, test, build
- Native temp DB + PostGIS + migrate + `db:verify` + no Prisma drift
- Readiness: HTTP 200 (healthy) / HTTP 503 (DB down, process alive)
- Invalid env fails startup
- DB scripts: missing secrets and bad admin credentials exit non-zero
- Storage/path unit tests pass
- Web Phase 0 shell HTTP 200
- Parallel review agents: credentials, runtime, DB scripts, storage, CI — Pass

## Residual risks

- Storage TOCTOU (documented)
- Junction test may skip without Windows symlink privileges
- Hosted GitHub Actions **not observed** (no remote/PR run)
- Local Node was v24; CI pins Node 20 (local Node 20 not re-run via nvm)
- Local gitignored `.env` secrets
- Historical commits before scrub may still mention older wording

## Next

Phase 1 only when product owner requests it (auth, RBAC, media, location privacy).
