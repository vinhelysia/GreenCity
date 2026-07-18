# Frontend foundation

Public shell for GreenCity (`apps/web`). Phase foundation only — no marketplace, cleanup, or auth backend wiring.

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
- Fonts: Bricolage Grotesque (display) + Be Vietnam Pro (body)
- Honest placeholders — no fake stats, listings, or rewards

## API boundary

- Browser → same-origin `/api/*` only (when contracts exist)
- See `BACKEND_CONTRACT_REQUEST.md`
- Login does not call any endpoint

## Dependencies

See `FRONTEND_DEPENDENCY_REQUEST.md` for Playwright.
