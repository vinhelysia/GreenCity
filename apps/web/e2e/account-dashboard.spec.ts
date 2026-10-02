import { expect, test, type Page } from "@playwright/test";
import {
  assertCleanRuntime,
  assertOneH1,
  attachRuntimeGuards,
} from "./helpers";

const ME_PATH = "/api/auth/me";
const POINTS_PATH = "/api/points/me";
const SCRAP_PATH = "/api/scrap-requests/mine";
const CLEANUP_PATH = "/api/cleanup-reports/mine";
const SUBSCRIPTION_PATH = "/api/subscriptions/me";
const HISTORY_PATH = "/api/account/history";
const DETAIL_PATH = "/api/marketplace/reservations/reservation-account-e2e";
const CREATED_AT = "2026-08-09T00:00:00.000Z";

const SESSION = {
  user: {
    id: "account-e2e-user",
    email: "account@example.test",
    displayName: "Account Test User",
    phone: "0900000000",
    roles: ["USER"],
    status: "ACTIVE",
    createdAt: CREATED_AT,
  },
};

const MEDIA = {
  id: "media-account-e2e",
  ownerId: SESSION.user.id,
  contentType: "image/png",
  byteSize: 1,
  width: null,
  height: null,
  createdAt: CREATED_AT,
  downloadPath: "/media/media-account-e2e/content",
};

type Reply = { status: number; json: unknown };
type ApiCall = { path: string; search: string; method: string };

function accountRoutes(overrides: Record<string, Reply> = {}): Record<string, Reply> {
  return {
    [ME_PATH]: { status: 200, json: SESSION },
    [DETAIL_PATH]: { status: 200, json: {
      id: "reservation-account-e2e", listingId: "listing-account-e2e", status: "COMPLETED",
      categoryName: "Giấy carton", estimatedWeightKg: 12.5, estimatedTotalVnd: 37500,
      createdAt: CREATED_AT, scheduledAt: CREATED_AT, pickupLocation: "Campus meeting point",
      coordinatorContact: "Coordinator TEST", completedAt: CREATED_AT, actualWeightKg: 10,
      sellerReceivedAmountVnd: 30000, receiptNote: "Cash receipt DETAIL-001", contacts: null,
      cancelledAt: null, cancelReason: null,
    } },
    [POINTS_PATH]: {
      status: 200,
      json: { balance: 123, entries: [] },
    },
    [`${POINTS_PATH}?limit=1`]: {
      status: 200,
      json: { balance: 123, entries: [] },
    },
    [`${POINTS_PATH}?limit=5`]: {
      status: 200,
      json: {
        balance: 123,
        entries: [
          {
            id: "point-account-e2e",
            delta: 50,
            reason: "CLEANUP_VERIFIED",
            occurredAt: CREATED_AT,
          },
        ],
      },
    },
    [`${SCRAP_PATH}?limit=5`]: {
      status: 200,
      json: {
        requests: [
          {
            id: "scrap-account-e2e",
            sellerId: SESSION.user.id,
            category: {
              id: "category-account-e2e",
              name: "Giấy carton",
              minPricePerKgVnd: 2000,
              maxPricePerKgVnd: 3000,
              active: true,
            },
            estimatedWeightKg: 12.5,
            media: MEDIA,
            note: null,
            status: "ACCEPTED",
            createdAt: CREATED_AT,
            activeQuote: {
              id: "quote-account-e2e",
              scrapRequestId: "scrap-account-e2e",
              pricePerKgVnd: 2500,
              status: "ACCEPTED",
              createdAt: CREATED_AT,
              acceptedAt: CREATED_AT,
            },
          },
        ],
      },
    },
    [`${CLEANUP_PATH}?limit=5`]: {
      status: 200,
      json: {
        reports: [
          {
            id: "cleanup-account-e2e",
            reporterId: SESSION.user.id,
            description: "A verified account dashboard cleanup report.",
            addressLine: "Private address not rendered on the dashboard",
            ward: "Ward 1",
            district: "District 1",
            city: "Ho Chi Minh City",
            latitude: 10.7,
            longitude: 106.7,
            media: MEDIA,
            status: "VERIFIED",
            createdAt: CREATED_AT,
          },
        ],
      },
    },
    [SUBSCRIPTION_PATH]: {
      status: 200,
      json: {
        eligible: true,
        subscription: {
          id: "subscription-current-account-e2e",
          userId: SESSION.user.id,
          status: "ACTIVE",
          startsAt: CREATED_AT,
          expiresAt: "2026-09-08T00:00:00.000Z",
          note: null,
        },
        checkoutAvailable: false,
      },
    },
    [`${HISTORY_PATH}?limit=5`]: {
      status: 200,
      json: {
        reservations: [
          {
            id: "reservation-account-e2e",
            role: "BUYER",
            categoryName: "Giấy carton",
            estimatedWeightKg: 12.5,
            buyerPricePerKgVnd: 3000,
            estimatedTotalVnd: 37500,
            status: "COMPLETED",
            createdAt: CREATED_AT,
          },
        ],
        subscriptions: [
          {
            id: "subscription-account-e2e",
            status: "ACTIVE",
            startsAt: CREATED_AT,
            expiresAt: "2026-09-08T00:00:00.000Z",
          },
        ],
        payments: [
          {
            id: "payment-account-e2e",
            provider: "PAYOS",
            status: "PAID",
            amountVnd: 50000,
            createdAt: CREATED_AT,
            paidAt: CREATED_AT,
          },
        ],
      },
    },
    ...overrides,
  };
}

/**
 * Mock fetch before hydration without page.route(), which this repository
 * deliberately avoids because interception perturbs React hydration timing.
 */
async function installApiMock(
  page: Page,
  table: Record<string, Reply>,
  calls: ApiCall[],
): Promise<void> {
  await page.exposeFunction("__gcAccountApiCall", (call: ApiCall) => {
    calls.push(call);
  });
  await page.addInitScript((routes: Record<string, Reply>) => {
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const url = new URL(href, window.location.href);
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      await (
        window as unknown as {
          __gcAccountApiCall: (call: ApiCall) => Promise<void>;
        }
      ).__gcAccountApiCall({
        path: url.pathname,
        search: url.search,
        method,
      });

      const hit = routes[`${url.pathname}${url.search}`] ?? routes[url.pathname];
      if (!hit) return original(input, init);
      return new Response(JSON.stringify(hit.json), {
        status: hit.status,
        headers: { "Content-Type": "application/json" },
      });
    };
  }, table);
}

test.describe("Account dashboard", () => {
  for (const sample of [
    { name: "pending", step: 0, status: "RESERVED", scheduledAt: null },
    { name: "scheduled", step: 1, status: "RESERVED", scheduledAt: CREATED_AT },
    { name: "cancelled", step: null, status: "CANCELLED", scheduledAt: null },
    { name: "legacy", step: null, status: "COMPLETED", scheduledAt: null },
  ]) {
    test(`collection progress reflects ${sample.name} at 320px`, async ({ page }) => {
      const routes = accountRoutes();
      const receipt = routes[DETAIL_PATH];
      if (!receipt) throw new Error("Missing reservation fixture");
      receipt.json = {
        ...(receipt.json as Record<string, unknown>),
        status: sample.status, scheduledAt: sample.scheduledAt,
        completedAt: sample.status === "COMPLETED" ? CREATED_AT : null,
        actualWeightKg: null, sellerReceivedAmountVnd: null,
        cancelReason: sample.status === "CANCELLED" ? "Pickup cancelled" : null,
      };
      await installApiMock(page, routes, []);
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto("/tai-khoan?reservation=reservation-account-e2e", { waitUntil: "networkidle" });
      const detail = page.getByTestId("reservation-summary");
      await expect(detail).toBeVisible();
      if (sample.step !== null) {
        await expect(detail.locator('ol [aria-current="step"]')).toHaveCount(1);
        await expect(detail.locator("ol li").nth(sample.step)).toHaveAttribute("aria-current", "step");
      } else await expect(detail.locator("ol")).toHaveCount(0);
      const logout = await page.getByTestId("header-logout").boundingBox();
      expect(logout!.x + logout!.width).toBeLessThanOrEqual(320);
      for (const width of [1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const overlaps = await page.getByRole("banner").evaluate(header => {
          const boxes = Array.from(header.querySelectorAll("a,button"))
            .map(el => el.getBoundingClientRect()).filter(box => box.width && box.height);
          return boxes.some((a, i) => boxes.slice(i + 1).some(b => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom && a.bottom > b.top));
        });
        expect(overlaps, `header controls overlap at ${width}px`).toBe(false);
      }
    });
  }

  for (const sample of [
    { path: "/tai-khoan", title: "Chi tiết đơn thu gom", amount: "30.000đ" },
    { path: "/en/account", title: "Collection order details", amount: "30,000 VND" },
  ]) {
    test(`shows the private receipt and appointment on ${sample.path}`, async ({ page }) => {
      const issues = attachRuntimeGuards(page);
      const calls: ApiCall[] = [];
      await installApiMock(page, accountRoutes(), calls);
      await page.goto(`${sample.path}?reservation=reservation-account-e2e`, { waitUntil: "networkidle" });
      const detail = page.getByTestId("account-reservation-detail");
      await expect(detail).toContainText(sample.title);
      await expect(detail).toContainText("Campus meeting point");
      await expect(detail).toContainText(sample.amount);
      await expect(detail).toContainText("Cash receipt DETAIL-001");
      expect(calls.some(call => call.path === DETAIL_PATH && call.method === "GET")).toBe(true);
      assertCleanRuntime(issues, "private collection receipt");
    });
  }

  test("anonymous Vietnamese visitors see the sign-in-required state and no private histories load", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    const calls: ApiCall[] = [];
    await installApiMock(
      page,
      { [ME_PATH]: { status: 401, json: { error: { code: "UNAUTHENTICATED", message: "Authentication required" } } } },
      calls,
    );

    await page.goto("/tai-khoan", { waitUntil: "networkidle" });

    await expect(page.getByTestId("account-login-required")).toBeVisible();
    await expect(page.getByTestId("account-dashboard")).toHaveCount(0);
    expect(
      calls.filter((call) =>
        [POINTS_PATH, SCRAP_PATH, CLEANUP_PATH, SUBSCRIPTION_PATH, HISTORY_PATH].includes(
          call.path,
        ),
      ),
    ).toEqual([]);
    assertCleanRuntime(issues, "account-anonymous-vi");
  });

  test("authenticated Vietnamese dashboard loads recent snapshots with limit=5 and states product limits", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    const calls: ApiCall[] = [];
    await installApiMock(page, accountRoutes(), calls);

    await page.goto("/tai-khoan", { waitUntil: "networkidle" });
    await assertOneH1(page, "Tài khoản của tôi");

    await expect(page.getByTestId("account-dashboard")).toBeVisible();
    await expect(page.getByTestId("account-profile")).toContainText(
      "Account Test User",
    );
    await expect(page.getByTestId("account-points")).toContainText("123");
    await expect(page.getByTestId("account-sales")).toContainText("Giấy carton");
    await expect(page.getByTestId("account-reservations")).toContainText("37.500");
    await expect(page.getByTestId("account-subscription")).toContainText("payOS");
    await expect(page.getByTestId("account-cleanup")).toContainText(
      "A verified account dashboard cleanup report.",
    );
    await expect(page.getByTestId("account-cleanup")).not.toContainText(
      "Private address not rendered on the dashboard",
    );
    await expect(page.getByTestId("account-cleanup")).not.toContainText("Ward 1");
    await expect(page.getByTestId("account-cleanup")).not.toContainText("10.7");
    await expect(page.getByTestId("account-demo-notice")).toContainText(
      "Coupon, ưu đãi EVN và nước chỉ là demo. Chúng không thực hiện đổi điểm hoặc thanh toán.",
    );
    await expect(page.getByTestId("account-withdrawal-not-supported")).toContainText(
      /không hỗ trợ rút tiền mặt/i,
    );
    await expect(page.getByTestId("header-account")).toHaveAttribute(
      "href",
      "/tai-khoan",
    );

    for (const path of [POINTS_PATH, SCRAP_PATH, CLEANUP_PATH, HISTORY_PATH]) {
      expect(calls).toContainEqual({ path, search: "?limit=5", method: "GET" });
    }
    expect(
      calls.filter(
        (call) => call.path.startsWith("/api/") && call.method !== "GET",
      ),
      "account dashboard must not start withdrawals, redemptions, payments, or other mutations",
    ).toEqual([]);
    assertCleanRuntime(issues, "account-authenticated-vi");
  });

  test("authenticated English dashboard uses /en/account and localizes the honest disclosure", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    const calls: ApiCall[] = [];
    await installApiMock(page, accountRoutes(), calls);

    await page.goto("/en/account", { waitUntil: "networkidle" });
    await assertOneH1(page, "My account");
    await expect(page.getByTestId("account-withdrawal-not-supported")).toContainText(
      "Cash withdrawal is not supported",
    );
    await expect(page.getByTestId("account-demo-notice")).toContainText(
      "demo-only",
    );
    await expect(page.getByTestId("header-account")).toHaveAttribute(
      "href",
      "/en/account",
    );
    expect(calls).toContainEqual({
      path: HISTORY_PATH,
      search: "?limit=5",
      method: "GET",
    });
    assertCleanRuntime(issues, "account-authenticated-en");
  });

  test("a failed history snapshot does not blank the profile, points, sale, or cleanup sections", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    const calls: ApiCall[] = [];
    await installApiMock(
      page,
      accountRoutes({
        [`${HISTORY_PATH}?limit=5`]: {
          status: 500,
          json: { error: { code: "UNKNOWN_ERROR", message: "fixture failure" } },
        },
      }),
      calls,
    );

    await page.goto("/tai-khoan", { waitUntil: "networkidle" });

    await expect(page.getByTestId("account-history-error")).toBeVisible();
    await expect(page.getByTestId("account-profile")).toContainText(
      "Account Test User",
    );
    await expect(page.getByTestId("account-points")).toContainText("123");
    await expect(page.getByTestId("account-sales")).toContainText("Giấy carton");
    await expect(page.getByTestId("account-cleanup")).toContainText(
      "A verified account dashboard cleanup report.",
    );

    // The mocked 500 is expected fixture behaviour, not a runtime regression.
    issues.consoleErrors = issues.consoleErrors.filter(
      (line) => !/status of 500/i.test(line),
    );
    assertCleanRuntime(issues, "account-history-partial-failure");
  });
});
