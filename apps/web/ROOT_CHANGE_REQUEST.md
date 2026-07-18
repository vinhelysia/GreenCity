# Root change request (integration note)

**From:** Frontend integration lead
**Branch:** `integration/frontend-foundation-reviewed`
**Scope:** Root repository hygiene only — not product code.

## Request

Add to the monorepo root `.gitignore`:

```gitignore
# Generated design-tool session state (not product source)
.hallmark/
```

## Reason

The original frontend foundation accidentally committed `.hallmark/log.json`
(Hallmark session memory). That path is **outside** `apps/web/**` ownership.

This reviewed branch **removes** the file from version control. Ignoring
`.hallmark/` prevents re-commit of generated design-tool state.

## Not requested here

- No other root `.gitignore` changes
- No Hallmark skill package changes
- Frontend agents must not recreate `.hallmark/` under version control
