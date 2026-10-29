# GreenCity — follow-up task prompts (for Codex / another agent)

Three independent tasks. Each prompt below is self-contained: copy **one whole
section** (including "Shared context" at the top) into the agent. Do not run two
of these in the same worktree at the same time.

---

## Shared context — paste this with EVERY task

You are working in the GreenCity pnpm monorepo at `C:\Stuff\GreenCity`.

Stack: Next.js 15 (App Router, `apps/web`), NestJS 11 (`apps/api`), Prisma +
Supabase PostgreSQL/PostGIS, shared Zod contracts in `packages/shared`.
Web deploys to Vercel, API to Render. Locales: Vietnamese (default) + English.

### Non-negotiable rules

1. **Never commit secrets.** `.env` and `.env.local` are gitignored; `.env.example`
   holds commented placeholders only, never values.
2. **`packages/shared` is the single source of truth** for API contracts. Change
   the Zod schema there first, then run `pnpm --filter @greencity/shared build`,
   then update API and web. Web and API must never define the shape separately.
3. **i18n parity is enforced by a test.** Every key added to
   `apps/web/messages/vi.json` MUST be added to `apps/web/messages/en.json` with
   the same path, or `pnpm --filter web test` fails. Vietnamese is the primary
   language — write real Vietnamese, not machine translation.
4. Keep `apps/web` dependencies lean. It has 6 (`next`, `react`, `react-dom`,
   `next-intl`, `@greencity/shared`, `leaflet`). Do not add more without a
   strong reason.
5. Follow the existing comment style: comments explain **why**, not what.

### Gotchas that will waste hours if you don't know them

- **`.env` points at LOCAL Postgres, not Supabase.** Running `pnpm db:migrate`
  plain migrates your laptop and reports success while production stays
  untouched. The Supabase URL lives in `C:\Stuff\GreenCity\.env.supabase.local`.
  To target production:
  ```bash
  set -a; . ./.env.supabase.local; set +a; pnpm db:migrate
  ```
- **Render does NOT run migrations on deploy, but CI DOES auto-deploy the API on
  push to `master`.** So a schema change must be applied to Supabase *before*
  pushing, or the deployed API breaks on a missing column. Always
  `prisma migrate status` first to see what is actually pending.
- **There is no local database in most worktrees.** `prisma migrate dev` will
  fail. Hand-write the migration SQL under
  `apps/api/prisma/migrations/<timestamp>_<name>/migration.sql` matching the
  style of the existing ones.
- **2 API unit tests already fail locally** (`test/audit-regression.test.ts`,
  "DATABASE_URL is required"). That is pre-existing and environmental, not
  something you broke. Baseline is **118 passing / 2 failing**. They pass in CI,
  which sets a placeholder `DATABASE_URL`.
- **Tailwind opacity modifiers do not work on this codebase's colour tokens.**
  `bg-primary/20`, `border-warm-600/30`, `ring-x/16` silently render as
  transparent, because the tokens are plain hex CSS variables, not RGB triplets.
  Use a literal `bg-[rgba(196,69,27,0.3)]` instead. This affects existing code
  too — do not "fix" it repo-wide, just avoid it in new code.
- **`.next` serves stale chunks.** After changing any `NEXT_PUBLIC_*` value or
  deleting a route, `rm -rf apps/web/.next` before rebuilding, or you will
  verify a cached bundle and reach a wrong conclusion.
- **Do not pipe a build through `head`.** `pnpm build | head -8` SIGPIPEs and
  kills the build half-finished, leaving no `BUILD_ID`. Use `| tail -N`.

### Quality gates — all must pass before you are done

```bash
pnpm --filter @greencity/shared build
pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build
pnpm --filter api typecheck && pnpm --filter api build
```

Verify behaviour in a real browser, not by assumption. Report honestly what you
verified versus what you could not.

---

## TASK A — Replace Google Geocoding with OpenStreetMap Nominatim

### Why

The "Đóng góp" (report a dumping site) form has a GPS button and a Leaflet map
pin that produce coordinates, then calls the API to turn those coordinates into
ward/district/city and autofill the address fields. That lookup currently uses
Google Geocoding, which requires a billing account. **The owner cannot add a
working payment card, so the feature is permanently dormant.** Replace the
provider with Nominatim, which needs no key, no billing and no card.

### Current state

- `apps/api/src/location/geocoding.service.ts` — calls Google, requires
  `GOOGLE_GEOCODING_API_KEY`, throws `GEOCODING_NOT_CONFIGURED` (503) when unset.
- `apps/api/src/location/location.controller.ts` — `GET /locations/reverse-geocode?lat=&lng=`,
  authenticated, `@Throttle({ default: { limit: 30, ttl: 60_000 } })`.
- `packages/shared/src/index.ts` — `ReverseGeocodeResultSchema`
  (`{ ward, district, city, addressLine }`, all nullable) and
  `GEOCODE_ERROR_CODES`.
- `apps/web/src/lib/api.ts` — `reverseGeocode(lat, lng)`.
- `apps/web/src/components/location-picker.tsx` — calls it after a GPS fix; the
  form fills **blank fields only**, never overwriting typed text. Keep that.

### What to do

Rewrite `geocoding.service.ts` to call Nominatim. Delete the Google path
entirely, including `GOOGLE_GEOCODING_API_KEY` from `apps/api/src/config/env.ts`,
`.env.example`, and `render.yaml`. Do not leave dead config behind.

Nominatim request:

```
https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=<lat>&lon=<lng>&zoom=18&addressdetails=1&accept-language=vi
```

**Their usage policy is a hard requirement, not advice:**

1. **Send a real `User-Agent` identifying the app** — e.g.
   `GreenCity/1.0 (https://green-city-web.vercel.app)`. Generic or absent
   User-Agents get blocked.
2. **Maximum 1 request per second, globally.** The existing `@Throttle` is
   per-client and does NOT satisfy this — ten users each making 3 requests
   stays under the per-client limit while breaking Nominatim's. Add a
   **server-side global gate**: keep a module-level `lastRequestAt` timestamp
   and delay so consecutive outbound calls are ≥1100ms apart. The API is a
   single Render instance, so an in-process gate is sufficient — say so in a
   `ponytail:` comment, and note it would need Redis if the API ever scales to
   more than one instance.
3. **Attribution.** The map already shows "© OpenStreetMap contributors" via the
   Leaflet tile layer. That covers it; do not add a second visible credit.

Map Nominatim's `address` object to the DTO (fields vary by location — try each
in order, fall back to null):

- `ward` ← `quarter` → `suburb` → `village` → `ward`
- `district` ← `city_district` → `district` → `county`
- `city` ← `city` → `town` → `state`
- `addressLine` ← top-level `display_name`

Keep the endpoint **authenticated** — without a key it is otherwise a free
public geocoding proxy running on your dime and your IP's Nominatim reputation.
Keep the response contract (`ReverseGeocodeResultSchema`) unchanged so the web
side needs no edit. Keep timeouts and Zod-validate the response, matching the
existing service. Never echo the raw upstream error to the client.

Rename `GEOCODING_NOT_CONFIGURED` usage: with no key there is no unconfigured
state, so that branch disappears. Keep `GEOCODING_FAILED` for upstream errors.

### Verify

- Unit-test the address-component mapping with 2–3 realistic Nominatim response
  fixtures (a HCMC address with `quarter`+`city_district`, one with only
  `city`, and an empty `address`). Put it beside the existing API tests.
- Prove the 1 req/sec gate: fire 3 calls and assert ≥1100ms between outbound
  requests (inject a clock or spy on fetch — do not `sleep` in a test).
- Manually: log in on the running app, open **Đóng góp**, press "Dùng vị trí
  hiện tại" or tap the map, and confirm ward/district/city populate and that
  already-typed values are not overwritten.

### Deploy

No migration. Push to `master`; CI deploys the API automatically.

---

## TASK B — Show cleanup-report coordinates to admins

### Why

Reporters can now pin the exact location of a dumping site, and the API stores
and returns `latitude`/`longitude`. But the admin verification queue still
renders only the free-text address, so the coordinates are captured and never
used — the person who has to actually find the pile can't see them.

### Current state

- `packages/shared/src/index.ts` → `CleanupReportSchema` already includes
  `latitude: z.number().nullable()` and `longitude: z.number().nullable()`.
  **No schema change needed.**
- `apps/api/src/cleanup/cleanup.mapper.ts` already returns both. **No API change
  needed.** This is a frontend-only task.
- `apps/web/src/components/admin-cleanup-queue.tsx` — the admin queue UI.
- `apps/web/src/components/cleanup-report-view.tsx` — the reporter's own list
  (`MyCleanupReports`), which also shows a location line.

### What to do

In the admin queue, when a report has coordinates, show them (5 decimal places,
`tabular-nums`) plus a link that opens the spot on a map in a new tab:

```
https://www.openstreetmap.org/?mlat=<lat>&mlon=<lng>#map=18/<lat>/<lng>
```

Use OpenStreetMap, **not** Google Maps — the project deliberately avoids Google
dependencies (no billing account). Give the link `target="_blank"` and
`rel="noopener noreferrer"`.

When a report has no coordinates (all reports created before this feature), show
nothing extra — no empty state, no "N/A". Reports predating the feature are
normal, not broken.

Add the same coordinate line to the reporter's own list in
`cleanup-report-view.tsx` so they can confirm the pin they dropped was right.

New i18n keys go in **both** `vi.json` and `en.json` under `cleanup`. Suggested:
- `coordsLabel`: `"Tọa độ"` / `"Coordinates"`
- `openInMap`: `"Xem trên bản đồ"` / `"View on map"`

### Do NOT

Do not add coordinates to `PublicCleanupReportSchema` or the homepage feed. That
feed is shown to unauthenticated visitors and deliberately exposes only
city/district. Exact coordinates are for the reporter and admins. This mirrors
the existing `LocationExact` / `LocationPublic` privacy split in the schema —
read `apps/api/src/location/location.redaction.ts` before touching anything
location-related.

### Verify

Log in as an admin, open the admin cleanup queue, and confirm: a report with
coordinates shows them and the link opens the right place on OSM; a report
without them renders unchanged. Check 390px width for layout overflow.

---

## TASK C — Chatwoot verified identity (HMAC)

### Why

The site has a live Chatwoot support widget (`apps/web/src/components/chatwoot-widget.tsx`)
running **anonymous conversations only**. Nothing proves who is typing, so a
visitor can claim to be any user, and support agents therefore must not discuss
account balances, payments, or order details. This task adds HMAC-verified
identity so they safely can.

This is Task 3.2 of `tasks/chatwoot-deployment-plan.md` — read that file's
"Task 3.2" section first; it is the authoritative spec.

### Prerequisite (human, cannot be automated)

In Chatwoot: **Settings → Inboxes → GreenCity → Settings → enable identity
validation**, then copy the HMAC token it reveals. Set it on **Render** as
`CHATWOOT_HMAC_TOKEN`. If the owner has not done this yet, still build the code
— it must be dormant and harmless without the token, exactly like the widget is
without its website token.

### Backend

Add one authenticated endpoint returning the current user's Chatwoot identity:

```
GET /chatwoot/identity  →  { userId: string, identifierHash: string }
```

- `identifierHash = HMAC-SHA256(key = CHATWOOT_HMAC_TOKEN, message = userId)`,
  hex encoded, using Node's built-in `node:crypto`. Add no dependency.
- Use the **stable internal user id**, never the email. Email is user-editable
  and would let one account impersonate another after an address change.
- `CHATWOOT_HMAC_TOKEN` is optional config in `apps/api/src/config/env.ts`,
  server-side only, with **no `NEXT_PUBLIC_` twin ever**. Follow the pattern of
  the payOS keys in that file. Absent token → respond 503
  `CHATWOOT_IDENTITY_NOT_CONFIGURED`; it must never be a startup error.
- Anonymous callers get 401 from the existing auth guard. Never return an
  identity for a user other than the caller — the user id comes from the
  session, never from a query parameter or body.
- Never log or return the token itself.

### Frontend

In `chatwoot-widget.tsx`:

- Wait for **both** the authenticated GreenCity user (`useAuth()`) **and** the
  Chatwoot SDK being ready before calling any SDK method. Listen for the
  `chatwoot:ready` window event — `window.$chatwoot` does not exist before it,
  and calling `setUser` early silently does nothing.
- Then call `window.$chatwoot.setUser(userId, { identifier_hash })`.
- On logout or account change, call `window.$chatwoot.reset()` **before** any
  other account can use the browser, or the next person inherits the previous
  conversation. `apps/web/src/components/auth-provider.tsx` has `logout()` and
  `clearSessionAndRedirect()` — both paths must reset.
- Do not pass roles, payment state, or any profile data beyond what a support
  workflow actually needs.
- Keep the existing fail-open behaviour: if the identity fetch fails, the widget
  must still load for anonymous chat rather than disappearing.

### Verify (security-critical — actually run these)

1. Anonymous visitor → widget loads, no `setUser` call, no error.
2. Log in as user A, chat, log out, log in as user B → **B must not see A's
   conversation**. This is the whole point of the task; test it in a real
   browser.
3. Search the built client bundle for the token:
   `rm -rf apps/web/.next && pnpm --filter web build && grep -r "<token>" apps/web/.next/static`
   → must return nothing.
4. Confirm the endpoint returns 401 for an unauthenticated request and cannot be
   made to return another user's hash.

Add one focused API test for the endpoint: valid session, anonymous, and
unconfigured-token cases.

### Deploy

No migration. Push to `master`; CI deploys the API. Then set
`CHATWOOT_HMAC_TOKEN` in the Render dashboard and enable identity validation in
Chatwoot.
