# Implementation Plan: MoMo buyer subscription payment

## Goal

Add a real MoMo Sandbox checkout that lets an authenticated GreenCity user pay
50,000 VND for 30 days of buyer eligibility.

This plan treats "50k/month" as a one-time 30-day pass. It does **not**
automatically charge the user again. True recurring billing needs MoMo
pre-authorization/tokenization, scheduled charges, cancellation, retry, and
dunning; that is deliberately out of scope for the contest build.

## Preconditions

1. Create a checkpoint commit for the current audit fixes before Gemini edits
   payment code. The current worktree contains intentional local changes and an
   untracked `skills-lock.json`; do not discard or absorb them accidentally.
2. Register for MoMo Sandbox credentials:
   `partnerCode`, `accessKey`, and `secretKey`.
3. Never paste credentials into a prompt, source file, screenshot, test fixture,
   Git commit, Vercel variable, or browser-visible `NEXT_PUBLIC_*` variable.
   Secrets belong only in the repository-root `.env` for local manual testing
   and Render environment variables for deployment.

## Subagent orchestration (applies to every prompt)

Every prompt below is given to the **coordinator agent**. Before doing the work,
the coordinator spawns the listed bounded subagents in parallel, waits for all
of them, reviews their evidence/diffs, and performs final integration and
verification itself.

Rules:

- Publish shared names/contracts and exact file ownership before spawning.
- Concurrent edits are allowed only on disjoint files. If Antigravity does not
  provide isolated worktrees and ownership may overlap, that worker is
  read-only.
- Only the coordinator edits `tasks/todo.md`, generates Prisma Client, runs
  migrations or shared/full test suites, and makes integration fixes.
- Workers must not commit, restore, reset, stash, push, deploy, install packages,
  edit `.env`, use credentials, or run package-manager commands concurrently.
- Every worker returns findings, files touched, diff summary, commands/results,
  and unresolved risks. Unsupported claims are discarded.
- Use at most three subagents. Dependency-ordered work remains sequential.

Parallel assignments:

| Prompt | Subagent A | Subagent B | Subagent C |
| --- | --- | --- | --- |
| 1.1 | Read-only architecture/data-flow audit | Read-only auth/Origin/threat audit | Read-only official MoMo docs/signature audit |
| 1.2 | Own Prisma schema + one new migration only | Own shared contracts + focused contract test only | Read-only compatibility/security review |
| 1.3 | Own payment-domain service/module files | Own one new RED integration test file | Read-only concurrency/idempotency review |
| 2.1 | Own env/example/deploy placeholders | Own MoMo signing/client + focused unit tests | Read-only official-docs comparison |
| 2.2 | Own checkout/status controller and service files | Own one focused integration test file | Read-only access-control/tampering review |
| 2.3 | Own narrow OriginGuard bypass + control test | Own webhook controller/service + webhook tests | Read-only adversarial HMAC/replay review |
| 3.1 | Own payment functions in web `api.ts` | Own new checkout/return pages/components | Read-only accessibility/state/trust review |
| 3.2 | Own one payment Playwright spec | Own README/env/smoke changes | Read-only test-quality review |
| 3.3 | Read-only security review | Read-only correctness/concurrency review | Read-only release/deployment review |

Additional coordinator duties by prompt:

- 1.1: reconcile sources into one exact dependency/file map before any edits.
- 1.2: decide schema/contract names first; run Prisma generate only after both
  editing workers finish.
- 1.3: publish the verified-facts method signature before workers start.
- 2.1: review canonical signing strings and host allowlists line by line.
- 2.2: ensure test and implementation workers use the published API contract.
- 2.3: review the guard bypass and signature verification line by line; prove
  other unsafe public POST routes remain Origin-protected.
- 3.1: publish frontend routes/types first; the UI worker must reuse `api.ts`.
- 3.2: only the coordinator runs Playwright or restores generated screenshots.
- 3.3: require P0/P1/P2 findings with exact file/line evidence, independently
  reproduce every P0/P1, then fix only confirmed defects sequentially.

## Architecture decisions

- Support MoMo only. Do not create a generic provider interface for a single
  implementation.
- Use Node's built-in `crypto`, `fetch`, `URL`, and `AbortSignal`; use the
  already-installed Zod. Add no payment SDK or query-string dependency.
- The server owns the plan:
  `BUYER_30_DAYS = { amountVnd: 50_000, durationDays: 30 }`.
  The browser never submits an amount or duration.
- A MoMo IPN is the source of truth. Redirect query parameters only identify the
  payment status page; they never activate a subscription.
- Store a payment row before calling MoMo. Keep provider order/request IDs
  unique and make IPN handling idempotent.
- On a successful IPN, update the payment and create/extend the subscription in
  one database transaction. A duplicate IPN must not add another 30 days.
- If a user has remaining active time, a new paid pass extends from the latest
  expiry rather than overwriting or wasting it.
- Do not store full MoMo request/response bodies. Store only IDs, amount, status,
  result code, and timestamps. Never log signatures or secrets.
- `MOMO_ENV=sandbox|production` selects a hard-coded allowlisted MoMo endpoint.
  Do not accept an arbitrary provider base URL from user input.
- Missing credentials must not break unrelated API startup. Checkout reports a
  stable `PAYMENT_NOT_CONFIGURED` error and `/subscriptions/me` reports that
  checkout is unavailable without revealing which secret is absent.

## Minimal data model

Add a `SubscriptionPayment` model rather than adding billing fields directly to
the existing eligibility/history `Subscription` rows.

Suggested fields:

- `id`, `userId`, timestamps
- `amountVnd` fixed to 50,000 for this plan
- `durationDays` fixed to 30 for this plan
- `status`: `PENDING | PAID | FAILED`
- `momoOrderId` unique
- `momoRequestId` unique
- `momoTransactionId` nullable and unique, stored as a string
- `momoResultCode` nullable integer
- `paidAt` nullable
- `subscriptionId` nullable and unique, linking the successful payment to the
  one subscription row it created

Add database checks for positive amount/duration where the repository's
migration style supports it. Preserve seeded/demo subscriptions with a nullable
payment link.

## API contracts

### `POST /subscription-payments`

- Authenticated and protected by the existing browser Origin guard.
- Takes no amount. An empty body is sufficient because only one plan exists.
- Creates a pending payment, calls MoMo create-payment, validates the untrusted
  response, and returns `{ paymentId, payUrl }`.
- `payUrl` must be HTTPS and use an allowlisted MoMo host for the selected
  environment.
- Stable errors include `PAYMENT_NOT_CONFIGURED`,
  `PAYMENT_PROVIDER_UNAVAILABLE`, and `PAYMENT_PROVIDER_REJECTED`.

### `GET /subscription-payments/:id`

- Authenticated.
- Owner-only; another user receives 404 to avoid leaking payment existence.
- Returns only `{ id, status, amountVnd, paidAt }`.

### `POST /payment-webhooks/momo`

- No GreenCity session authentication.
- Must bypass the browser Origin guard using a narrow webhook-specific metadata
  decorator, not by weakening Origin checks for every public POST route.
- Validate payload shape, recompute HMAC-SHA256, compare signatures in constant
  time, then match `partnerCode`, `orderId`, `requestId`, and `amount` against
  the stored payment.
- Valid success: atomically mark paid and create/extend one subscription.
- Valid non-success: mark the pending payment failed.
- Duplicate delivery: no-op.
- Invalid signature or mismatched immutable data: no state change and no
  sensitive error details.
- Unexpected database failure must return a failure response so MoMo can retry;
  successfully handled notifications return HTTP 204 within 15 seconds.

### Existing `GET /subscriptions/me`

Keep the current eligibility response and add a boolean such as
`checkoutAvailable`. It may reveal only whether checkout is available, never
which credential is missing.

## Threat cases that must have regression tests

1. A forged redirect cannot activate a subscription.
2. A forged or malformed IPN cannot change payment/subscription state.
3. A valid IPN with the wrong amount/order/request/partner code is rejected.
4. Two identical successful IPNs create exactly one subscription.
5. Another user cannot read a payment.
6. Frontend cannot choose a cheaper amount or longer duration.
7. MoMo timeout/bad JSON/unexpected response/unsafe `payUrl` yields a stable
   error and does not create an active subscription.
8. Existing active time is extended, not replaced.
9. The webhook Origin bypass applies only to the signed MoMo route; login,
   registration, and other unsafe browser routes retain their current checks.

## Session 1 — Contract and persistence foundation

### Prompt 1.1 — Read-only audit and exact implementation map

```text
You are continuing work in C:\Stuff\GreenCity. Communicate mainly in Vietnamese,
keep common technical terms in English, and follow AGENTS.md. Work as a senior
engineer: do not invent APIs or claim tests passed without running them.

This feature is a MoMo one-time buyer pass: exactly 50,000 VND for 30 days. It is
not auto-renewing. Read tasks/plan.md and tasks/todo.md completely. Then work in
READ-ONLY mode:

1. Run git status and identify all pre-existing changes. Preserve them.
2. Trace the current Subscription Prisma model, /subscriptions/me, reservation
   eligibility, shared Zod contracts, auth/Public decorator, OriginGuard,
   exception format, env validation, audit log pattern, migrations, and tests.
3. Check the current official MoMo one-time create-payment and IPN docs. Use only
   official MoMo sources and note the exact canonical signing strings.
4. Produce an exact file-by-file implementation map and identify any conflict
   between tasks/plan.md and the real code.

Do not edit files, install dependencies, commit, push, deploy, or request real
credentials. Stop after the audit and ask for approval if a material contract
must change.
```

### Prompt 1.2 — Payment persistence and shared contracts, TDD

```text
Continue from the approved read-only audit. Implement only the persistence and
shared-contract foundation for the MoMo 50,000 VND / 30-day one-time pass.

Use TDD: first add the smallest contract/migration regression checks and show
that they fail for the missing feature; then implement.

Required outcome:
- Add the minimal SubscriptionPayment status/model and relation to User and
  Subscription described in tasks/plan.md.
- Generate a named Prisma migration. Do not use db push and do not edit an old
  migration.
- Add shared Zod response schemas/types for payment creation and owner-visible
  payment status.
- Extend SubscriptionState additively with checkoutAvailable.
- Define stable payment error-code constants.
- Keep provider-specific field names; do not add a generic payment-provider
  abstraction or new dependency.
- Never put secrets or raw provider payloads in the schema.

Run Prisma generate, shared/API typecheck, and the focused contract tests.
Review git diff --check and report exact changed files and exact commands/results.
Do not implement network calls, controllers, UI, commit, push, or deploy.
```

### Prompt 1.3 — Domain activation transaction and regression tests

```text
Continue on the same worktree. Implement the payment-domain state transition,
without calling MoMo yet.

Create the smallest service method that consumes already-verified provider
facts and:
- finds the pending payment by immutable MoMo IDs;
- on success, marks it PAID and creates exactly one linked 30-day Subscription;
- extends from the latest active expiry when applicable;
- on a valid provider failure, marks it FAILED;
- is idempotent for duplicate successful/failed notifications;
- does not lose paid time under concurrent duplicate processing.

Use one database transaction and existing Prisma patterns. Do not hide a money
race behind a comment. Add focused integration tests for: first activation,
duplicate success, wrong immutable amount/order/request, failure, and extending
an active subscription. Tests must prove no duplicate subscription.

Run the focused tests, full API unit tests, and integration tests. Update
tasks/todo.md only for work actually verified. Do not add MoMo HTTP, controllers,
frontend, commit, push, or deploy.
```

## Session 2 — MoMo adapter, checkout, and signed IPN

### Prompt 2.1 — Configuration, signing, and provider client

```text
Start a new session in C:\Stuff\GreenCity. Read AGENTS.md, tasks/plan.md,
tasks/todo.md, the current git diff, and the Session 1 implementation before
editing. Preserve unrelated and pre-existing changes.

Implement the minimal MoMo one-time provider client using Node stdlib plus the
existing Zod only:
- validated optional env fields for MOMO_ENV, partnerCode, accessKey, secretKey,
  PUBLIC_API_URL, and PUBLIC_WEB_URL;
- hard-coded sandbox/production API origins selected by MOMO_ENV;
- HMAC-SHA256 canonical request signing and IPN verification matching current
  official MoMo docs;
- constant-time signature comparison;
- POST create-payment using fetch with a bounded timeout;
- strict validation of response shape, resultCode, and HTTPS payUrl host.

Missing/partial configuration must fail checkout safely without exposing which
secret is absent and must not break unrelated app startup. Add deterministic
unit tests for canonical signing, invalid signatures, timeout, bad JSON,
provider rejection, and unsafe payUrl. Never log or snapshot secrets/signatures.
Do not add an SDK/dependency, controller, UI, commit, push, deploy, or call the
real sandbox.
```

### Prompt 2.2 — Authenticated checkout and owner status endpoints

```text
Continue from Prompt 2.1. Add the authenticated vertical slice:

- POST /subscription-payments with no client-controlled amount or duration.
- Store the PENDING row before the provider call.
- Generate unique orderId/requestId server-side.
- Call the MoMo client and return the shared { paymentId, payUrl } contract.
- GET /subscription-payments/:id returns the minimal shared status contract and
  behaves as 404 for a different owner.
- /subscriptions/me returns checkoutAvailable based on complete server config.
- Use existing ApiError shape, request ID, audit conventions, auth, and Origin
  protection. Do not leak provider bodies or secrets.

Write integration tests first. Stub outbound fetch; tests must not depend on
MoMo availability or credentials. Prove the browser cannot set amount/duration,
another user cannot read the row, provider failures are stable, and no active
subscription exists before IPN.

Run focused tests, full API unit/integration tests, typecheck, and diff check.
Do not implement the webhook or frontend yet. Do not commit, push, or deploy.
```

### Prompt 2.3 — Public signed IPN without weakening CSRF protection

```text
Continue from Prompt 2.2. Implement POST /payment-webhooks/momo.

Security requirements:
- It is Public for GreenCity session auth.
- Add a narrow webhook-only metadata decorator so OriginGuard permits this one
  server-to-server POST without Origin. Do not skip Origin checks for all Public
  endpoints and do not change CORS to wildcard.
- Parse the untrusted body with Zod.
- Verify the current official MoMo IPN HMAC in constant time before mutation.
- Match partnerCode, orderId, requestId, and amount against the DB row.
- Feed only verified facts to the Session 1 transaction.
- Valid handled deliveries return 204 quickly. Database/internal failures remain
  retryable. Do not expose verification detail to callers or logs.

Add integration tests for: valid success, duplicate success, invalid signature,
wrong amount/order/request/partner, valid failure, request without Origin, and a
control proving another unsafe public browser POST is still Origin-protected.
Run all backend quality gates. Update tasks/todo.md only after verification.
Do not add frontend, commit, push, deploy, or use real credentials.
```

## Session 3 — Frontend, end-to-end verification, and sandbox handoff

### Prompt 3.1 — Minimal subscription checkout UI

```text
Start a new session in C:\Stuff\GreenCity. Read AGENTS.md, tasks/plan.md,
tasks/todo.md, current status/diff, and the implemented backend contracts. Do
not redesign unrelated pages.

Build the smallest accessible frontend flow:
- Add typed api.ts functions that validate shared Zod schemas.
- Replace the marketplace's "demo payment" dead end with a clear link/button to
  purchase the buyer pass.
- Add one focused page showing exactly "50.000đ / 30 ngày", explicitly saying it
  is a one-time payment and does not auto-renew.
- Checkout calls POST /api/subscription-payments then navigates to the validated
  MoMo payUrl.
- If checkoutAvailable is false, show an honest unavailable message rather than
  a broken button.
- Add a return/status page that uses paymentId, polls the owner status endpoint
  for a bounded period, then shows PAID, FAILED, or still-processing. Ignore all
  redirect claims of success.
- On PAID, refresh /subscriptions/me and offer navigation back to /cho-online.

Handle loading, network failure, retry, keyboard focus, and aria-live/alert
states. Do not expose credentials, add analytics, add a provider selector, or
add a new dependency.

Run web smoke, typecheck, lint, and build. Do not commit, push, or deploy.
```

### Prompt 3.2 — Browser regression coverage and honest copy

```text
Continue from Prompt 3.1. Add focused Playwright coverage without contacting
MoMo:

1. Unsubscribed authenticated user sees the 50.000đ / 30-day one-time offer.
2. Checkout success uses the backend payUrl; test intercepts the API and never
   leaves the test origin.
3. Forged redirect success parameters do not show PAID unless the owner status
   API says PAID.
4. Pending transitions to PAID while polling and the marketplace then enables
   reservation.
5. Checkout unavailable/provider/network failure produces a recoverable error,
   never an endless spinner.

Update smoke route expectations and README/env examples with truthful language:
MoMo Sandbox payment exists only when configured; it is a one-time 30-day pass,
not auto-renew. Do not put sample real-looking secrets in docs.

Run focused E2E, then full Playwright. Restore generated screenshot noise only
if the screenshot was clean before the run. Run git diff --check and report
exact results. Do not commit, push, or deploy.
```

### Prompt 3.3 — Release audit and manual MoMo Sandbox checklist

```text
Perform a final senior review of the complete MoMo payment slice. Do not start
by changing code.

Audit end-to-end:
- client cannot choose price/duration or activate from redirect;
- all provider input/output is schema-validated;
- HMAC comparison and canonical strings match current official MoMo docs;
- IPN is idempotent and amount/order/request/partner are DB-matched;
- payment ownership and audit logs are correct;
- no secret/signature/raw payload appears in source, tests, logs, frontend
  bundle, Git diff, or docs;
- webhook Origin bypass is route-specific;
- no unnecessary dependency/provider abstraction was added.

Fix only verified defects found by this review and add the smallest regression
test for each. Then run: pnpm lint, pnpm typecheck, pnpm build, pnpm test:unit,
pnpm test:integration, and full Playwright. Run the repository's native
dependency audit only if the user explicitly approves registry access; never
auto-apply force fixes.

Finish by writing a manual Sandbox checklist for the human:
1. obtain MoMo credentials;
2. set local/Render secrets and public Vercel/Render base URLs;
3. deploy API before web;
4. register the Render IPN URL;
5. make one sandbox payment;
6. verify Payment=PAID, exactly one linked Subscription, /subscriptions/me
   eligible, duplicate IPN harmless, and no secrets in logs.

Do not claim real Sandbox success without credentials and an observed IPN. Do
not commit, push, mutate Render/Vercel/Supabase, or deploy unless the user
explicitly authorizes those external actions.
```

## Human checkpoint before production

MoMo Sandbox implementation can be built and fully regression-tested without
credentials by stubbing outbound requests. It is not production-ready until:

- the merchant account and production contract are approved;
- Sandbox create-payment, redirect, and IPN are observed on the deployed URLs;
- production credentials are stored only in Render;
- refund/cancellation/support behavior and legal copy are defined;
- true recurring billing is separately specified if still wanted.

