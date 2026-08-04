import { test, expect, type Page } from "@playwright/test";
import {
  attachRuntimeGuards,
  assertCleanRuntime,
  assertNoHorizontalOverflow,
  assertOneH1,
} from "./helpers";

/**
 * The rewards page against a mocked GET /api/points/offers.
 *
 * The point of mocking the catalog is that it proves the page has no coupon
 * array of its own left: every merchant asserted below exists only in this
 * file, so a page that fell back to hard-coded cards would fail on the first
 * expectation rather than quietly keep passing.
 *
 * Auth is mocked too. This spec is about the catalog and its dialog, and a
 * real registration would only add a user to clean up and a rate limit to
 * dodge.
 */

const OFFERS_PATH = "/api/points/offers";
const POINTS_PATH = "/api/points/me";
const ME_PATH = "/api/auth/me";

const BALANCE = 1234;

/** Two offers whose merchant name differs per locale — the EN/VI proof. */
const OFFERS = [
  {
    slug: "e2e-water-alpha",
    merchantNameVi: "Nước sạch mô phỏng",
    merchantNameEn: "Simulated water utility",
    offerVi: "Hỗ trợ 100.000 ₫ cho hóa đơn nước mô phỏng.",
    offerEn: "VND 100,000 in simulated water bill support.",
    pointsCost: 1000,
    demoOnly: true,
  },
  {
    slug: "e2e-cafe-beta",
    merchantNameVi: "Quán cà phê mô phỏng",
    merchantNameEn: "Simulated coffee house",
    offerVi: "Voucher đồ uống mô phỏng trị giá 50.000 ₫.",
    offerEn: "A simulated beverage voucher worth VND 50,000.",
    pointsCost: 500,
    demoOnly: true,
  },
];

const SESSION = {
  user: {
    id: "user-rewards-e2e",
    email: "rewards@e2e.test",
    displayName: "Rewards E2E",
    phone: null,
    roles: ["USER"],
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  },
};

type Reply = { status: number; json: unknown };

/**
 * Answers a fixed set of API paths from the test instead of the network, by
 * wrapping window.fetch. Deliberately not page.route(): see the note in
 * subscription-payment.spec.ts — request interception perturbs resource
 * timing enough to make React abandon hydration on roughly one load in ten.
 *
 * The table is static per test, so unlike that spec's version this one needs
 * no exposeFunction round trip.
 */
async function installApiMock(
  page: Page,
  table: Record<string, Reply>,
): Promise<void> {
  await page.addInitScript((routes: Record<string, Reply>) => {
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const { pathname } = new URL(href, window.location.href);
      const hit = routes[pathname];
      if (!hit) return original(input, init);
      return new Response(JSON.stringify(hit.json), {
        status: hit.status,
        headers: { "Content-Type": "application/json" },
      });
    };
  }, table);
}

function signedIn(offers: Reply): Record<string, Reply> {
  return {
    [ME_PATH]: { status: 200, json: SESSION },
    [POINTS_PATH]: { status: 200, json: { balance: BALANCE, entries: [] } },
    [OFFERS_PATH]: offers,
  };
}

/** Every non-GET call the page makes to the API, for the "no redemption" check. */
function recordWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on("request", (req) => {
    const { pathname } = new URL(req.url());
    if (pathname.startsWith("/api/") && req.method() !== "GET") {
      writes.push(`${req.method()} ${pathname}`);
    }
  });
  return writes;
}

test.describe("Reward catalog", () => {
  test("renders Vietnamese catalog fields from the API response", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    await installApiMock(page, signedIn({ status: 200, json: OFFERS }));
    await page.goto("/diem-thuong", { waitUntil: "networkidle" });
    await assertOneH1(page, "Tài khoản & điểm thưởng");

    const cards = page.getByRole("button", { name: /Xem mô phỏng coupon/ });
    await expect(cards).toHaveCount(2);

    // API order, not sorted by anything the page decided.
    await expect(cards.nth(0)).toHaveAccessibleName(
      "Xem mô phỏng coupon Nước sạch mô phỏng",
    );
    await expect(cards.nth(1)).toHaveAccessibleName(
      "Xem mô phỏng coupon Quán cà phê mô phỏng",
    );

    const catalog = page.locator("#doi-diem");
    await expect(catalog).toContainText("Nước sạch mô phỏng");
    await expect(catalog).toContainText(
      "Hỗ trợ 100.000 ₫ cho hóa đơn nước mô phỏng.",
    );
    // The English copy for the same rows must not leak into the VI page.
    await expect(catalog).not.toContainText("Simulated water utility");
    // Nor may any merchant from the shipped catalog appear: this page has no
    // coupon array of its own any more.
    await expect(catalog).not.toContainText("Starbucks");
    await expect(catalog).not.toContainText("Highlands");

    assertCleanRuntime(issues, "rewards-vi");
  });

  test("renders English merchant and offer copy on /en/rewards", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    await installApiMock(page, signedIn({ status: 200, json: OFFERS }));
    await page.goto("/en/rewards", { waitUntil: "networkidle" });
    await assertOneH1(page, "Account & Rewards");

    const catalog = page.locator("#doi-diem");
    await expect(catalog).toContainText("Simulated water utility");
    await expect(catalog).toContainText(
      "VND 100,000 in simulated water bill support.",
    );
    await expect(catalog).not.toContainText("Nước sạch mô phỏng");
    await expect(
      page.getByRole("button", { name: "Preview demo coupon from Simulated water utility" }),
    ).toBeVisible();

    assertCleanRuntime(issues, "rewards-en");
  });

  test("says the catalog is empty rather than pretending it loaded", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    await installApiMock(page, signedIn({ status: 200, json: [] }));
    await page.goto("/diem-thuong", { waitUntil: "networkidle" });

    await expect(page.getByTestId("offers-empty")).toBeVisible();
    await expect(page.getByTestId("offers-empty")).toContainText(
      "Chưa có ưu đãi nào",
    );
    await expect(
      page.getByRole("button", { name: /Xem mô phỏng/ }),
    ).toHaveCount(0);

    assertCleanRuntime(issues, "rewards-empty");
  });

  test("a failed catalog request leaves the balance and ledger intact", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    await installApiMock(
      page,
      signedIn({
        status: 500,
        json: { error: { code: "UNKNOWN_ERROR", message: "boom" } },
      }),
    );
    await page.goto("/diem-thuong", { waitUntil: "networkidle" });

    await expect(page.getByTestId("offers-error")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Xem mô phỏng/ }),
    ).toHaveCount(0);

    // The point of two independent requests: one failing catalog must not take
    // the balance down with it.
    await expect(page.getByRole("region", { name: "Tổng điểm tích lũy" })).toContainText(
      "1.234",
    );
    await expect(page.getByTestId("points-error")).toHaveCount(0);

    // Chromium logs the mocked 500 as a console error; that is the fixture,
    // not a page defect.
    issues.consoleErrors = issues.consoleErrors.filter(
      (line) => !/status of 500/i.test(line),
    );
    assertCleanRuntime(issues, "rewards-offers-error");
  });
});

test.describe("Demo preview dialog", () => {
  test("opens with the offer, closes on the button, and returns focus", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    const writes = recordWrites(page);
    await installApiMock(page, signedIn({ status: 200, json: OFFERS }));
    await page.goto("/diem-thuong", { waitUntil: "networkidle" });

    const trigger = page.getByRole("button", {
      name: "Xem mô phỏng coupon Nước sạch mô phỏng",
    });
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeHidden();

    await trigger.click();
    await expect(dialog).toBeVisible();

    // Named for screen readers, and carrying every disclosure the card cannot.
    await expect(dialog).toHaveAccessibleName("Mô phỏng đổi coupon");
    await expect(dialog).toContainText("Nguyên mẫu dự thi");
    await expect(dialog).toContainText("Nước sạch mô phỏng");
    await expect(dialog).toContainText(
      "Hỗ trợ 100.000 ₫ cho hóa đơn nước mô phỏng.",
    );
    await expect(dialog).toContainText("1.000");
    await expect(dialog).toContainText("DEMO-ONLY");
    await expect(dialog).toContainText("Không có điểm nào bị trừ");
    await expect(dialog).toContainText("không có giá trị sử dụng");
    await expect(dialog).toContainText(
      "GreenCity hiện không tuyên bố có liên kết với Nước sạch mô phỏng.",
    );
    await expect(dialog).toContainText("đối tác chính thức");
    // Nothing may congratulate the user on a redemption that did not happen.
    await expect(dialog).not.toContainText(/thành công/i);

    const close = page.getByRole("button", { name: "Đóng" });
    await expect(close).toBeFocused();

    await close.click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    expect(writes, "dialog must not write to the API").toEqual([]);
    assertCleanRuntime(issues, "rewards-dialog");
  });

  test("Escape closes the dialog and returns focus to its trigger", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    await installApiMock(page, signedIn({ status: 200, json: OFFERS }));
    await page.goto("/diem-thuong", { waitUntil: "networkidle" });

    // The second card, so a passing test cannot be an artefact of "the first
    // trigger happens to be where focus already was".
    const trigger = page.getByRole("button", {
      name: "Xem mô phỏng coupon Quán cà phê mô phỏng",
    });
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Quán cà phê mô phỏng");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    // Reopening from the keyboard alone must work as well as the mouse.
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    assertCleanRuntime(issues, "rewards-dialog-escape");
  });

  test("leaves the displayed balance untouched", async ({ page }) => {
    const writes = recordWrites(page);
    await installApiMock(page, signedIn({ status: 200, json: OFFERS }));
    await page.goto("/diem-thuong", { waitUntil: "networkidle" });

    const balance = page.getByRole("region", { name: "Tổng điểm tích lũy" });
    await expect(balance).toContainText("1.234");

    await page
      .getByRole("button", { name: "Xem mô phỏng coupon Nước sạch mô phỏng" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Đóng" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await expect(balance).toContainText("1.234");
    expect(writes).toEqual([]);
  });

  test("dialog and catalog fit 320px and 390px without horizontal overflow", async ({
    page,
  }) => {
    await installApiMock(page, signedIn({ status: 200, json: OFFERS }));

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/diem-thuong", { waitUntil: "networkidle" });
      await assertNoHorizontalOverflow(page);

      await page
        .getByRole("button", { name: "Xem mô phỏng coupon Nước sạch mô phỏng" })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await page.keyboard.press("Escape");
    }
  });
});
