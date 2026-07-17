# GreenCity — Handoff for ChatGPT: Phase 0 Hardening Integration

**Date:** 2026-07-17
**Workspace:** `C:\Stuff\GreenCity`
**OS:** Windows

---

## Paste prompt for ChatGPT

```text
You are taking over GreenCity at C:\Stuff\GreenCity.

Read first:
1. docs/handoff-phase0-hardening-integration.md  (this file)
2. docs/handoff-to-gpt.md
3. docs/implementation-roadmap.md
4. docs/architecture.md

Current state:
- Default branch: master (Phase 0 complete, pre-hardening tip may lag)
- Hardening work lives on branch: integration/phase0-hardening
- Final HEAD of hardening branch: f12054cf55a45576e87db2a5a1888a45c12dd964 (f12054c)
- NOT auto-merged to master — human merge after review
- Phase 1 NOT started

Hard rules:
- Docker is NOT required for local owner workflow (native Windows PostgreSQL + PostGIS)
- No marketplace / cleanup / payment / subscription / rewards / completed auth yet
- No client-driven status transitions
- No users.balance as reward ledger SoT
- GET /health is readiness only (200 ok / 503 when DB down)

If continuing: either help review/merge integration/phase0-hardening into master, or start Phase 1 only after merge approval. Do not re-do Phase 0 unless broken.
```

---

## 1. Integration branch and commits

| Field | Value |
|-------|--------|
| **Branch** | `integration/phase0-hardening` |
| **Base** | `master` @ `ea81fd0` (handoff docs) |
| **Final HEAD** | `f12054cf55a45576e87db2a5a1888a45c12dd964` |
| **Short** | `f12054c` |
| **Merged to master?** | **No** |

```
f12054c fix prepare.mjs spawn on Windows (avoid EINVAL on pnpm.cmd).
81c2b58 Phase 0 hardening: scrub remaining credential placeholders from docs.
b7fe42d Phase 0 hardening: credentials, storage containment, readiness, CI.
```

---

## 2. Codex patch status (critical)

**`codex/phase0-hardening` was NOT found** in this repo (no remote, no local branch, no audit report file).
Placeholder `<CODEX_PATCH_SHA>` could not be cherry-picked.

Hardening was **reimplemented from the integration brief (areas A–G)** on `integration/phase0-hardening` so acceptance criteria pass.
This is **not** an auditable cherry-pick of a third-party Codex commit. If Codex SHA appears later, three-way compare against `f12054c`.

---

## 3. Review decisions by area

| Area | Decision | What was done |
|------|----------|----------------|
| **A. Credentials** | Accepted (implemented) | `.env.example` placeholders only; scripts require `PGPASSWORD` + `GREENCITY_DB_PASSWORD`; no insecure password defaults; README/handoff scrubbed; optional compose uses env secrets |
| **B. PowerShell DB scripts** | Accepted (implemented) | `scripts/db-common.ps1`; every `psql` checks `$LASTEXITCODE`; auth failure non-zero; success text only after success; identifier validation |
| **C. Storage containment** | Accepted (implemented) | Reject `..`, absolute/UNC paths, symlink/junction ancestors; paths from monorepo root; TOCTOU residual documented in code + architecture |
| **D. Env / paths** | Accepted (implemented) | Only monorepo-root `.env` via `findRepoRoot()`; same paths from root or `apps/api` cwd |
| **E. Health readiness** | Accepted (implemented) | `GET /health`: **200** when DB+PostGIS up; **503** when down; process stays up; invalid env fails startup |
| **F. Install lifecycle** | Accepted (implemented) | Root `prepare` → build `@greencity/shared` + `prisma generate` (no live DB) |
| **G. CI** | Accepted (implemented) | Triggers on **`master`**, pnpm **9.15.0**, `pnpm install --frozen-lockfile`, no Docker required for CI quality gates |
| **Cherry-pick Codex** | Impossible / not done | Branch missing |
| **Weaken storage** | Rejected | Kept strict containment |
| **Health as liveness** | Rejected | Readiness only |
| **Phase 1 features** | Not implemented | Explicitly out of scope |

---

## 4. Files changed (summary)

### API (`apps/api`)
- `src/main.ts` — canonical root `.env` only; no fail-start on DB down
- `src/config/env.ts` — validation without real credential examples
- `src/config/paths.ts` + `paths.spec.ts` — monorepo root discovery
- `src/health/health.controller.ts` / `health.service.ts` — readiness 200/503
- `src/storage/local-object-storage.ts` + `.spec.ts` — containment
- `src/storage/storage.module.ts`, `src/mail/mail.module.ts` — root-relative paths
- `src/app.module.ts` — `ignoreEnvFile: true` (env loaded in main)
- `package.json` — real tests via `tsx`

### Scripts
- `scripts/db-common.ps1` (new)
- `scripts/db-setup.ps1`, `db-postgis.ps1`, `db-verify.ps1` (hardened)
- `scripts/prepare.mjs` (install lifecycle)

### Root / CI / docs
- `package.json` — `prepare` script
- `pnpm-lock.yaml`
- `.env.example`
- `.github/workflows/ci.yml` — master, pnpm 9.15.0, frozen lockfile
- `README.md`, `docs/architecture.md`, `docs/handoff-to-gpt.md`
- `infra/docker/docker-compose.yml` — optional; secrets from env

---

## 5. Verification evidence (executed)

| Command / check | Outcome |
|-----------------|---------|
| `pnpm install --frozen-lockfile` | Pass |
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass (`local-object-storage.spec`, `paths.spec`) |
| `pnpm build` | Pass |
| Fresh temp DB + PostGIS + `pnpm db:migrate` | Pass |
| `pnpm db:verify` / `PostGIS_Version()` | Pass (`3.6 USE_GEOS=1…`) |
| `prisma migrate diff` (DB → schema) | Pass — no drift |
| Healthy `GET /health` | **HTTP 200**, `status:ok`, db/postgis up |
| Unreachable DB `GET /health` | **HTTP 503**, database/postgis down, process still running |
| Missing `DATABASE_URL` | Startup **exit 1**, clear error |
| Bad admin password `db-setup` | Non-zero exit, no success banner |
| Valid `db-setup` with required env secrets | Pass |

---

## 6. Runtime semantics (authoritative)

### Health = readiness only
- **200** + `status: "ok"` when database and PostGIS both up
- **503** + `status: "error"` when either down
- Process **does not exit** solely because DB is down
- Invalid/missing env **does** fail startup

### Local storage
- Root: `STORAGE_LOCAL_DIR` resolved from monorepo root
- Rejects: `..`, absolute paths, UNC, symlink/junction ancestors
- Residual **TOCTOU** risk documented

### DB scripts
- Require: `PGPASSWORD`, `GREENCITY_DB_PASSWORD` (for setup)
- `DATABASE_URL` required for verify (no default credentials)

---

## 7. Clean start (Windows, no Docker)

```powershell
cd C:\Stuff\GreenCity
git checkout integration/phase0-hardening

pnpm install --frozen-lockfile
copy .env.example .env
# edit DATABASE_URL with real local credentials

$env:PGPASSWORD = '<admin-password>'
$env:GREENCITY_DB_PASSWORD = '<app-password>'
pnpm db:setup
pnpm db:postgis
pnpm db:migrate
pnpm db:verify

pnpm dev:api   # :3001
pnpm dev:web   # :3000
```

---

## 8. Remaining risks

1. Codex original SHA never compared — re-audit if branch appears.
2. Storage TOCTOU residual.
3. Symlink test may skip without Windows privileges.
4. Local `.env` secrets on disk (gitignored).
5. Optional Docker compose still operator-configured if used.

---

## 9. What was NOT done

- Phase 1+ (auth, RBAC, media product flows, marketplace, cleanup, subscription, payment, rewards)
- Automatic merge to `master`
- Cherry-pick of missing Codex commit

---

## 10. Merge guidance (human)

After review:

```powershell
git checkout master
git merge --no-ff integration/phase0-hardening
# do not auto-merge without review
```

**Safe to merge after human review:** yes, as Phase 0 hardening.
**Do not claim “Codex cherry-pick verified”** without the original branch.

---

## 11. Next work

| If… | Then… |
|-----|--------|
| Merge approved | Merge branch → update handoff SHAs on master |
| Product continues | **Phase 1 only** (auth sessions, RBAC, media via ObjectStorage, location privacy) |
| Codex patch arrives | `git show` + compare/cherry-pick onto this branch and re-verify |

---

*End of ChatGPT handoff for Phase 0 hardening integration.*
