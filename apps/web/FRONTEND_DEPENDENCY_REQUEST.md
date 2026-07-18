# Frontend dependency request

**Branch / worktree:** `integration/frontend-foundation-reviewed`
**Constraint (historical):** Frontend agents must not modify root lockfile unless
acting as integration owner with explicit approval.

## Approved and installed (this integration)

| Package | Version range | Where | Reason |
|---------|---------------|-------|--------|
| `@playwright/test` | `^1.51.0` | `apps/web` devDependencies | Repository-owned E2E / browser verification |
| `@axe-core/playwright` | `^4.10.1` | `apps/web` devDependencies | Automated a11y scan in e2e/a11y.spec.ts |

Root `pnpm-lock.yaml` is updated by the integration owner for these packages only.

## Browser binaries (not committed)

```powershell
pnpm install --frozen-lockfile
pnpm --filter web exec playwright install chromium
# or
pnpm --filter web run test:e2e:install
```

CI on Linux should use `playwright install --with-deps chromium`.
Browser binaries are **not** installed by `pnpm install` alone and must **not**
be committed to git.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm --filter web test` | Structure smoke (no browser) |
| `pnpm --filter web test:e2e` | Playwright suite (builds via `pretest:e2e`) |
| `pnpm --filter web test:e2e:install` | Install Chromium for Playwright |

## Verification policy

- Browser test success must come from **repository-owned** `@playwright/test`.
- Global / machine-local Playwright is not acceptable evidence.
- `scripts/browser-verify.mjs` requires `@playwright/test` only (no `playwright` fallback).
