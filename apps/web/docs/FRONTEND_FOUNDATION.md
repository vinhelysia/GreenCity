# Frontend foundation

Public shell for GreenCity (`apps/web`). Phase foundation only — no marketplace,
cleanup, or auth backend wiring.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Homepage editorial hierarchy |
| `/thung-rac` | Waste-bin area — đang phát triển |
| `/dich-vu` | Service overview shell |
| `/dong-gop` | Contribution flow intro |
| `/cho-online` | Marketplace intro + empty state |
| `/dang-nhap` | Login visual shell only |

## Shell

- Sticky header: brand left, nav + đăng nhập right
- Accessible mobile menu (Escape, focus return, min 44px targets)
- Skip link → `#noi-dung`
- Footer with primary links
- `loading.tsx`, `error.tsx`, `not-found.tsx`

## Visual

- Hallmark **Garden** (editorial), stacked wireframe document
- Fonts via `next/font/google`: Bricolage Grotesque (display) + Be Vietnam Pro (body)
- Honest placeholders — no fake stats, listings, or rewards
- Cold production builds may need network access once for Google Fonts download
  (cached afterward). No machine-local font binaries are required or committed.

## API boundary

- Browser → same-origin `/api/*` only; never an absolute API host
- Login and registration call `/api/auth/*` through the Next rewrite

## Testing

| Command | What |
|---------|------|
| `pnpm --filter web test` | Smoke structure + anti-fake-API guards |
| `pnpm --filter web exec playwright install chromium` | One-time browser binary |
| `pnpm --filter web test:e2e` | Full Playwright suite (builds first) |

Evidence screenshots live under `apps/web/screenshots/` with portable
`VERIFY_REPORT.txt` (relative paths only).
