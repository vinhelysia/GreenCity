# MoMo subscription payment checklist

## Preconditions

- [x] Confirm scope: 50,000 VND buys 30 days; no automatic renewal.
- [x] Checkpoint the current audit fixes before payment work.
- [ ] Register for MoMo Sandbox credentials without sharing secrets in prompts.

## Session 1: Contract and persistence

- [x] Complete read-only audit against current code and official MoMo docs.
- [x] Add `SubscriptionPayment` model, status enum, relations, and new migration.
- [x] Add shared payment contracts and stable error codes.
- [x] Add `checkoutAvailable` to subscription state.
- [x] Implement idempotent paid/failed activation transaction.
- [x] Verify activation, duplicate IPN, mismatch, failure, and extension tests.

### Checkpoint 1

- [x] Prisma generate/migration checks pass.
- [x] Shared/API typecheck passes.
- [x] API unit and integration tests pass.
- [x] No provider HTTP or UI was added early.

## Session 2: MoMo backend

- [ ] Add optional validated MoMo config and hard-coded environment endpoints.
- [ ] Implement stdlib HMAC signing/verification and bounded provider fetch.
- [ ] Add authenticated payment creation and owner-only status endpoints.
- [ ] Add route-specific Origin bypass for the signed MoMo IPN only.
- [ ] Implement IPN validation and connect it to the activation transaction.
- [ ] Verify forged/mismatched/duplicate notifications cannot grant extra time.

### Checkpoint 2

- [ ] Full backend unit/integration tests pass without real MoMo access.
- [ ] No new dependency or speculative provider abstraction.
- [ ] No secret/signature/raw provider payload in source, fixtures, or logs.
- [ ] Existing unsafe browser routes remain Origin-protected.

## Session 3: Frontend and release

- [ ] Add the 50.000đ / 30-day one-time checkout page.
- [ ] Replace demo dead-end copy with a real checkout path.
- [ ] Add bounded return-page polling that trusts only backend payment status.
- [ ] Add focused Playwright tests for success, forgery, pending, and failure.
- [ ] Update README, `.env.example`, and deployment configuration placeholders.
- [ ] Run full lint, typecheck, build, unit, integration, smoke, and Playwright.

### Checkpoint 3

- [ ] All local quality gates are green with exact counts recorded.
- [ ] Generated screenshots and unrelated dirty files are excluded from the diff.
- [ ] Human reviews the final diff before commit/push/deploy.

## Manual Sandbox and deployment

- [ ] Add MoMo Sandbox secrets to local `.env` and Render only.
- [ ] Set exact public Vercel web and Render API base URLs.
- [ ] Deploy API, then web, only with explicit authorization.
- [ ] Register the public Render IPN URL with MoMo.
- [ ] Observe one real Sandbox payment and signed IPN.
- [ ] Confirm one PAID payment creates exactly one 30-day subscription.
- [ ] Replay the IPN and confirm it grants no additional time.
- [ ] Confirm `/subscriptions/me` enables marketplace reservation.
- [ ] Inspect logs and frontend bundle for secret leakage.

## Explicitly deferred

- [ ] Auto-renew/tokenized recurring billing.
- [ ] VNPAY or a generic multi-provider abstraction.
- [ ] Refunds, chargebacks, invoices, coupons, and plan catalog.

