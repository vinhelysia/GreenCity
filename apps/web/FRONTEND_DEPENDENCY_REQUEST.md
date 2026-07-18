# Frontend dependency request

**Branch / worktree:** `grok/frontend-foundation`  
**Constraint:** Frontend agent must not modify root `package.json`, `pnpm-workspace.yaml`, or `pnpm-lock.yaml`.

---

## Requested packages

### 1. Playwright (E2E smoke)

| Field | Value |
|-------|--------|
| Package | `@playwright/test` |
| Version range | `^1.49.0` (or current monorepo-approved) |
| Where | `apps/web` **devDependencies** |
| Reason | Route smoke tests, navigation, mobile menu, viewport overflow, screenshots |
| Intended `apps/web/package.json` change | Add `"@playwright/test": "^1.49.0"` under `devDependencies`; add scripts `"test:e2e": "playwright test"` and optional `"pretest:e2e": "next build"` |

### 2. Optional a11y helper

| Field | Value |
|-------|--------|
| Package | `@axe-core/playwright` |
| Version range | `^4.10.0` |
| Where | `apps/web` **devDependencies** |
| Reason | Automated accessibility checks in Playwright |
| Required for foundation? | No — manual + keyboard verification covers foundation gate |

---

## Scripts after approval

```json
{
  "test:e2e": "playwright test",
  "pretest:e2e": "next build"
}
```

Lockfile must be updated by an agent allowed to run `pnpm add -D ... --filter web` (or root-owned install).

---

## Interim testing (this PR)

Without Playwright on the lockfile:

- `pnpm --filter web test` runs a **file/route smoke script** (`scripts/smoke.mjs`) that verifies required routes and components exist and that source does not hard-code API hosts or fake fetch targets.
- Browser verification is performed separately when a Playwright binary is available (npx / shared install), and screenshots are stored under `apps/web/screenshots/`.

---

## Not requested

- No new UI libraries (no shadcn install yet)
- No framer-motion / chart / map packages
- No auth SDK packages
