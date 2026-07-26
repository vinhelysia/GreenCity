import { test, expect, type Page, type Route } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  attachRuntimeGuards,
  assertCleanRuntime,
  assertNoHorizontalOverflow,
  waitForAuthReady,
} from "./helpers";

/**
 * The buyer-pass purchase, end to end, with payOS replaced by a route handler.
 * Nothing here reaches the provider: the payment endpoints are intercepted and
 * payUrl points back at this app, so "redirecting to payOS" is a same-origin
 * navigation the test can follow.
 */

const RUN_SUFFIX = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const PASSWORD = "test-pass-99";
const PENDING_KEY = "greencity.pendingSubscriptionPaymentId";
const PAYMENT_ID = "pay-e2e-fixture";
// Mirrors buyer-pass-panel.tsx. Pinned here on purpose: reading the component's
// constants would make the give-up test agree with whatever the component does.
const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_ATTEMPTS = 30;

// Matches e2e/cleanup-auth-users.mjs, which deletes by this marker.
function email(name: string): string {
  return `${name}@auth-ui-${RUN_SUFFIX}.test`;
}

function cleanupUsers() {
  execFileSync(
    process.execPath,
    [path.join(process.cwd(), "e2e/cleanup-auth-users.mjs"), RUN_SUFFIX],
    { cwd: process.cwd(), stdio: "inherit", env: process.env },
  );
}

async function registerAndSignIn(page: Page, name: string): Promise<void> {
  await page.goto("/dang-ky", { waitUntil: "networkidle" });
  await waitForAuthReady(page);
  await page.getByLabel("Email").fill(email(name));
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  // Registration signs the user in without leaving the page, so the header
  // control is the signal — waiting on a URL change waits forever.
  await expect(page.getByTestId("header-logout")).toBeVisible({
    timeout: 15_000,
  });
}

/** A subscription state the panel can render, with checkout switched on. */
function subscriptionState(eligible: boolean) {
  return {
    eligible,
    // Shaped to SubscriptionSchema exactly. A stray or missing field makes the
    // client parse fail, which looks like "not eligible" and is a confusing
    // way for a test to fail.
    subscription: eligible
      ? {
          id: "sub-e2e",
          userId: "user-e2e",
          status: "ACTIVE",
          startsAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          note: null,
        }
      : null,
    checkoutAvailable: true,
  };
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

/**
 * One listing to reserve, served from the test rather than the database: this
 * spec is about the pass, and it should not fail because the marketplace
 * happens to be empty.
 */
async function stubListings(page: Page): Promise<void> {
  await page.route("**/api/marketplace/listings", (route) =>
    json(route, {
      listings: [
        {
          id: "listing-e2e",
          categoryName: "Giấy carton",
          estimatedWeightKg: 10,
          buyerPricePerKgVnd: 3000,
          estimatedTotalVnd: 30000,
          status: "AVAILABLE",
          mediaDownloadPath: "/marketplace/listings/listing-e2e/photo",
          isOwn: false,
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  );
  // The photo would 404 from the stubbed id and trip the failed-request guard.
  await page.route("**/api/marketplace/listings/*/photo", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    }),
  );
}

test.afterAll(() => {
  cleanupUsers();
});

test("shows the pass offer once, with its price and no auto-renewal", async ({
  page,
}) => {
  const issues = attachRuntimeGuards(page);
  await page.route("**/api/subscriptions/me", (route) =>
    json(route, subscriptionState(false)),
  );

  await registerAndSignIn(page, "offer");
  await page.goto("/cho-online", { waitUntil: "networkidle" });

  const panel = page.getByRole("region", { name: "Gói người mua" });
  await expect(panel).toContainText("50.000đ / 30 ngày");
  await expect(panel).toContainText("không tự động gia hạn");

  // Exactly one call to action: the offer must not repeat down the page.
  await expect(page.getByTestId("buyer-pass-checkout")).toHaveCount(1);

  await assertNoHorizontalOverflow(page);
  assertCleanRuntime(issues, "buyer-pass-offer");
});

test("carries a payment through payOS and unlocks reserving", async ({
  page,
}) => {
  const issues = attachRuntimeGuards(page);
  let paid = false;
  let statusCalls = 0;
  let createdBody: string | null = null;

  await stubListings(page);
  await page.route("**/api/subscriptions/me", (route) =>
    json(route, subscriptionState(paid)),
  );
  await page.route("**/api/subscription-payments", async (route) => {
    createdBody = route.request().postData();
    await json(
      route,
      {
        paymentId: PAYMENT_ID,
        // Same-origin stand-in for payOS, so the redirect is followable here.
        payUrl:
          "http://127.0.0.1:3100/cho-online?code=00&id=fake-link&cancel=false&status=PAID&orderCode=1784000000000001",
      },
      201,
    );
  });
  await page.route(`**/api/subscription-payments/${PAYMENT_ID}`, (route) => {
    statusCalls += 1;
    // First poll still pending, then settled: proves the UI waits rather than
    // trusting the first answer it gets.
    const status = statusCalls === 1 ? "PENDING" : "PAID";
    if (status === "PAID") paid = true;
    return json(route, {
      id: PAYMENT_ID,
      status,
      amountVnd: 50000,
      paidAt: status === "PAID" ? new Date().toISOString() : null,
    });
  });

  await registerAndSignIn(page, "flow");
  await page.goto("/cho-online", { waitUntil: "networkidle" });

  await page.getByTestId("buyer-pass-checkout").click();
  // Landing back on /cho-online is the return trip from payOS.
  await page.waitForURL(/\/cho-online\?code=00/);
  // Let the returned page finish hydrating before asserting on it.
  await waitForAuthReady(page);

  // The body must be exactly {} — the server rejects a client-priced request.
  expect(createdBody).toBe("{}");

  await expect(page.getByTestId("payment-success")).toBeVisible({
    timeout: 15_000,
  });
  expect(statusCalls).toBeGreaterThanOrEqual(2);

  // The id is consumed once the payment settles.
  expect(
    await page.evaluate((key) => window.sessionStorage.getItem(key), PENDING_KEY),
  ).toBeNull();

  // Eligibility was refetched, so reserving works without a manual reload.
  await expect(page.getByRole("button", { name: "Đặt giữ" }).first()).toBeVisible(
    { timeout: 15_000 },
  );

  assertCleanRuntime(issues, "buyer-pass-paid");
});

test("reports a failed payment and allows another attempt", async ({ page }) => {
  const issues = attachRuntimeGuards(page);
  await page.route("**/api/subscriptions/me", (route) =>
    json(route, subscriptionState(false)),
  );
  await page.route("**/api/subscription-payments", (route) =>
    json(
      route,
      {
        paymentId: PAYMENT_ID,
        // Distinct from the current URL on purpose: returning to the very same
        // address makes waitForURL match before the reload even starts, and the
        // assertions then race the page that is being torn down.
        payUrl: "http://127.0.0.1:3100/cho-online?returned=1",
      },
      201,
    ),
  );
  await page.route(`**/api/subscription-payments/${PAYMENT_ID}`, (route) =>
    json(route, {
      id: PAYMENT_ID,
      status: "FAILED",
      amountVnd: 50000,
      paidAt: null,
    }),
  );

  await registerAndSignIn(page, "failed");
  await page.goto("/cho-online", { waitUntil: "networkidle" });
  await page.getByTestId("buyer-pass-checkout").click();
  await page.waitForURL(/\/cho-online\?returned=1/);
  // Let the returned page finish hydrating before asserting on it.
  await waitForAuthReady(page);

  await expect(page.getByTestId("payment-failed")).toBeVisible({
    timeout: 15_000,
  });
  expect(
    await page.evaluate((key) => window.sessionStorage.getItem(key), PENDING_KEY),
  ).toBeNull();
  // A second attempt is possible: the button is back and enabled.
  await expect(page.getByTestId("buyer-pass-checkout")).toBeEnabled();

  assertCleanRuntime(issues, "buyer-pass-failed");
});

test("ignores a payment result forged in the query string", async ({ page }) => {
  const issues = attachRuntimeGuards(page);
  let statusCalls = 0;

  await page.route("**/api/subscriptions/me", (route) =>
    json(route, subscriptionState(false)),
  );
  await page.route("**/api/subscription-payments/*", (route) => {
    statusCalls += 1;
    return json(route, {
      id: PAYMENT_ID,
      status: "PAID",
      amountVnd: 50000,
      paidAt: new Date().toISOString(),
    });
  });

  await registerAndSignIn(page, "forged");
  // Anyone can type this. Nothing about it may be treated as proof of payment.
  // Every parameter payOS really appends, all of them saying "paid". None are
  // signed, so none may move the UI: only the owner-authenticated status
  // endpoint can do that.
  await page.goto(
    "/cho-online?code=00&id=forged-link&cancel=false&status=PAID" +
      "&orderCode=1784000000000002",
    { waitUntil: "networkidle" },
  );

  expect(
    await page.evaluate((key) => window.sessionStorage.getItem(key), PENDING_KEY),
  ).toBeNull();
  await expect(page.getByTestId("payment-success")).toHaveCount(0);
  // With no pending id there is nothing to check, so the endpoint is untouched.
  expect(statusCalls).toBe(0);
  // And the pass is still unsold.
  await expect(page.getByTestId("buyer-pass-checkout")).toBeVisible();

  assertCleanRuntime(issues, "buyer-pass-forged-query");
});

test("keeps the page usable when starting a checkout fails", async ({
  page,
}) => {
  const issues = attachRuntimeGuards(page, { allowServiceUnavailable: true });
  await page.route("**/api/subscriptions/me", (route) =>
    json(route, subscriptionState(false)),
  );
  await page.route("**/api/subscription-payments", (route) =>
    json(
      route,
      {
        error: {
          code: "PAYMENT_PROVIDER_UNAVAILABLE",
          message: "Payment provider is unavailable",
        },
      },
      503,
    ),
  );

  await registerAndSignIn(page, "checkout-error");
  await page.goto("/cho-online", { waitUntil: "networkidle" });
  const url = page.url();

  await page.getByTestId("buyer-pass-checkout").click();

  const alert = page.getByTestId("checkout-error");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/thanh toán/i);
  // No navigation, no stored id, and the button works again.
  expect(page.url()).toBe(url);
  expect(
    await page.evaluate((key) => window.sessionStorage.getItem(key), PENDING_KEY),
  ).toBeNull();
  await expect(page.getByTestId("buyer-pass-checkout")).toBeEnabled();

  assertCleanRuntime(issues, "buyer-pass-checkout-error");
});

test("offers no second checkout while a payment is unresolved", async ({
  page,
}) => {
  const issues = attachRuntimeGuards(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route("**/api/subscriptions/me", (route) =>
    json(route, subscriptionState(false)),
  );
  await page.route("**/api/subscription-payments", (route) =>
    json(
      route,
      { paymentId: PAYMENT_ID, payUrl: "http://127.0.0.1:3100/cho-online?returned=1" },
      201,
    ),
  );
  // Held open so the panel stays in the polling state while we look at it.
  await page.route(`**/api/subscription-payments/${PAYMENT_ID}`, async (route) => {
    await held;
    return json(route, {
      id: PAYMENT_ID,
      status: "PENDING",
      amountVnd: 50000,
      paidAt: null,
    });
  });

  await registerAndSignIn(page, "no-double");
  await page.goto("/cho-online", { waitUntil: "networkidle" });
  await page.getByTestId("buyer-pass-checkout").click();
  await page.waitForURL(/\/cho-online\?returned=1/);
  await waitForAuthReady(page);

  // Paying twice for one 30-day pass must not be one click away.
  await expect(page.getByTestId("payment-polling")).toBeVisible();
  await expect(page.getByTestId("buyer-pass-checkout")).toHaveCount(0);

  release();
  assertCleanRuntime(issues, "buyer-pass-no-double-checkout");
});

test("resumes polling instead of offering checkout on a fresh load with a pending payment", async ({
  page,
}) => {
  const issues = attachRuntimeGuards(page);
  let createCalls = 0;

  // Seeded before any script on the page runs, so the very first mount of
  // BuyerPassPanel already sees a pending id — the scenario a reload, or a
  // slow auth check, produces in production.
  await page.addInitScript(
    ({ key, id }) => window.sessionStorage.setItem(key, id),
    { key: PENDING_KEY, id: PAYMENT_ID },
  );

  await page.route("**/api/subscriptions/me", (route) =>
    json(route, subscriptionState(false)),
  );
  await page.route("**/api/subscription-payments", (route) => {
    createCalls += 1;
    return json(
      route,
      { paymentId: PAYMENT_ID, payUrl: "http://127.0.0.1:3100/cho-online?returned=1" },
      201,
    );
  });
  await page.route(`**/api/subscription-payments/${PAYMENT_ID}`, (route) =>
    json(route, {
      id: PAYMENT_ID,
      status: "PENDING",
      amountVnd: 50000,
      paidAt: null,
    }),
  );

  await registerAndSignIn(page, "fresh-load");
  await page.goto("/cho-online", { waitUntil: "networkidle" });

  await expect(page.getByTestId("payment-polling")).toBeVisible();
  await expect(page.getByTestId("buyer-pass-checkout")).toHaveCount(0);
  expect(createCalls).toBe(0);

  assertCleanRuntime(issues, "buyer-pass-fresh-load-pending");
});

test("keeps the pending id and hides checkout when polling gives up", async ({
  page,
}) => {
  const issues = attachRuntimeGuards(page);
  let statusCalls = 0;

  await page.route("**/api/subscriptions/me", (route) =>
    json(route, subscriptionState(false)),
  );
  await page.route("**/api/subscription-payments", (route) =>
    json(
      route,
      { paymentId: PAYMENT_ID, payUrl: "http://127.0.0.1:3100/cho-online?returned=1" },
      201,
    ),
  );
  await page.route(`**/api/subscription-payments/${PAYMENT_ID}`, (route) => {
    statusCalls += 1;
    return json(route, {
      id: PAYMENT_ID,
      status: "PENDING",
      amountVnd: 50000,
      paidAt: null,
    });
  });

  await registerAndSignIn(page, "gives-up");
  // Fake time, so the 30 attempts take no real minute.
  await page.clock.install();
  await page.goto("/cho-online", { waitUntil: "networkidle" });
  await page.getByTestId("buyer-pass-checkout").click();
  await page.waitForURL(/\/cho-online\?returned=1/);
  await waitForAuthReady(page);

  // Step the clock one interval at a time and wait for each request to land.
  // Running 70s in one jump fires all 30 timers before the first reply has been
  // awaited, so the chain only ever reaches attempt two and the assertion below
  // passes or fails for reasons unrelated to giving up.
  await expect.poll(() => statusCalls).toBe(1);
  for (let attempt = 2; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    await page.clock.runFor(POLL_INTERVAL_MS);
    await expect.poll(() => statusCalls).toBe(attempt);
  }

  const panel = page.getByTestId("payment-unconfirmed");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  // Never tell someone their money is safe when we do not know that.
  await expect(panel).toContainText("đừng thanh toán lại");
  await expect(page.getByTestId("payment-recheck")).toBeVisible();
  await expect(page.getByTestId("buyer-pass-checkout")).toHaveCount(0);
  // The id survives: it is the only handle on a payment that may yet settle.
  expect(
    await page.evaluate((key) => window.sessionStorage.getItem(key), PENDING_KEY),
  ).toBe(PAYMENT_ID);

  assertCleanRuntime(issues, "buyer-pass-unconfirmed");
});

test("shows applying, not a second CTA, while the pass has not refreshed yet", async ({
  page,
}) => {
  const issues = attachRuntimeGuards(page);
  // Every call — pre-checkout, the fresh page's own initial check after the
  // payOS redirect, and the refetch that follows PAID — reports not-eligible.
  // Nothing ever makes it "error" or "ready & eligible", so once poll settles
  // on "paid" the panel has no path but "applying": a stable state, not a
  // single-frame race, and exactly what a genuinely slow grant looks like.
  await page.route("**/api/subscriptions/me", (route) =>
    json(route, subscriptionState(false)),
  );
  await page.route("**/api/subscription-payments", (route) =>
    json(
      route,
      { paymentId: PAYMENT_ID, payUrl: "http://127.0.0.1:3100/cho-online?returned=1" },
      201,
    ),
  );
  await page.route(`**/api/subscription-payments/${PAYMENT_ID}`, (route) =>
    json(route, {
      id: PAYMENT_ID,
      status: "PAID",
      amountVnd: 50000,
      paidAt: new Date().toISOString(),
    }),
  );

  await registerAndSignIn(page, "applying");
  await page.goto("/cho-online", { waitUntil: "networkidle" });
  await page.getByTestId("buyer-pass-checkout").click();
  await page.waitForURL(/\/cho-online\?returned=1/);
  await waitForAuthReady(page);

  await expect(page.getByTestId("payment-applying")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("buyer-pass-checkout")).toHaveCount(0);

  assertCleanRuntime(issues, "buyer-pass-applying");
});

test("recovers from a failed refetch after payment, then activates on retry", async ({
  page,
}) => {
  const issues = attachRuntimeGuards(page, { allowServiceUnavailable: true });
  let meCalls = 0;

  await stubListings(page);
  // Three calls land before any retry: the pre-checkout load, the fresh
  // page's own initial check right after the payOS redirect, and only then
  // the refetch onSubscriptionChange triggers once poll observes PAID — that
  // third call is the one that must fail here. A 4th call, from clicking
  // Retry, is the one that succeeds.
  await page.route("**/api/subscriptions/me", (route) => {
    meCalls += 1;
    if (meCalls === 3) {
      return json(
        route,
        { error: { code: "UNKNOWN_ERROR", message: "boom" } },
        503,
      );
    }
    return json(route, subscriptionState(meCalls >= 4));
  });
  await page.route("**/api/subscription-payments", (route) =>
    json(
      route,
      { paymentId: PAYMENT_ID, payUrl: "http://127.0.0.1:3100/cho-online?returned=1" },
      201,
    ),
  );
  await page.route(`**/api/subscription-payments/${PAYMENT_ID}`, (route) =>
    json(route, {
      id: PAYMENT_ID,
      status: "PAID",
      amountVnd: 50000,
      paidAt: new Date().toISOString(),
    }),
  );

  await registerAndSignIn(page, "recover");
  await page.goto("/cho-online", { waitUntil: "networkidle" });
  await page.getByTestId("buyer-pass-checkout").click();
  await page.waitForURL(/\/cho-online\?returned=1/);
  await waitForAuthReady(page);

  // Money was received and the app knows it — this must never be confused
  // with "checkout is off" or silently stuck on "applying" forever.
  const recovery = page.getByTestId("subscription-error");
  await expect(recovery).toBeVisible({ timeout: 15_000 });
  await expect(recovery).toContainText("Thanh toán đã được ghi nhận");
  await expect(page.getByTestId("buyer-pass-checkout")).toHaveCount(0);

  await page.getByTestId("subscription-retry").click();

  await expect(page.getByTestId("payment-success")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Đặt giữ" }).first()).toBeVisible(
    { timeout: 15_000 },
  );

  assertCleanRuntime(issues, "buyer-pass-paid-refetch-recovery");
});

test("says it could not check the pass, rather than that checkout is off", async ({
  page,
}) => {
  const issues = attachRuntimeGuards(page, { allowServiceUnavailable: true });
  await page.route("**/api/subscriptions/me", (route) =>
    json(route, { error: { code: "UNKNOWN_ERROR", message: "boom" } }, 503),
  );

  await registerAndSignIn(page, "sub-error");
  await page.goto("/cho-online", { waitUntil: "networkidle" });

  const alert = page.getByTestId("subscription-error");
  await expect(alert).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("subscription-retry")).toBeVisible();
  // Those are different failures; conflating them sends people to the wrong fix.
  await expect(page.getByTestId("checkout-unavailable")).toHaveCount(0);

  assertCleanRuntime(issues, "buyer-pass-subscription-error");
});
