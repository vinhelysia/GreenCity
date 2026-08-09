import { test, expect, type Page } from "@playwright/test";
import {
  ROUTES,
  attachRuntimeGuards,
  assertCleanRuntime,
  assertOneH1,
} from "./helpers";

type ApiReply = { status: number; json: unknown };

const HOME_STATS = {
  availableListings: 0,
  verifiedCleanupReports: 3,
  scrapWeightKg: 0,
  totalPointsAwarded: 0,
};

const HOME_REPORTS = [
  {
    id: "newest-report",
    description: "Newest verified report",
    city: "Ho Chi Minh City",
    district: "District 1",
    photoPath: "/cleanup-reports/newest-report/photo",
    verifiedAt: "2026-08-09T12:00:00.000Z",
  },
  {
    id: "second-report",
    description: "Second newest verified report",
    city: "Ho Chi Minh City",
    district: "District 3",
    photoPath: "/cleanup-reports/second-report/photo",
    verifiedAt: "2026-08-08T12:00:00.000Z",
  },
  {
    id: "oldest-report",
    description: "Oldest verified report",
    city: "Ho Chi Minh City",
    district: "District 5",
    photoPath: "/cleanup-reports/oldest-report/photo",
    verifiedAt: "2026-08-07T12:00:00.000Z",
  },
];

async function installHomeApiMock(
  page: Page,
  table: Record<string, ApiReply>,
): Promise<void> {
  await page.addInitScript((routes: Record<string, ApiReply>) => {
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const href =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const { pathname } = new URL(href, window.location.href);
      const reply = routes[pathname];
      if (!reply) return original(input, init);
      return new Response(JSON.stringify(reply.json), {
        status: reply.status,
        headers: { "Content-Type": "application/json" },
      });
    };
  }, table);
}

function homeApiReplies(overrides: Record<string, ApiReply> = {}) {
  return {
    "/api/auth/me": {
      status: 401,
      json: { error: { code: "UNAUTHORIZED", message: "unauthenticated" } },
    },
    "/api/stats": { status: 200, json: HOME_STATS },
    "/api/marketplace/listings": { status: 200, json: { listings: [] } },
    "/api/cleanup-reports/public": {
      status: 200,
      json: { reports: HOME_REPORTS },
    },
    ...overrides,
  };
}

test.describe("Public routes @core", () => {
  test("homepage metadata is locale-specific and private routes are not indexable @core", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const viCanonical = page.locator('link[rel="canonical"]');
    await expect(viCanonical).toHaveCount(1);
    const viUrl = await viCanonical.getAttribute("href");
    expect(viUrl).toMatch(/^https?:\/\/[^/]+$/);

    await expect(
      page.locator('link[rel="alternate"][hreflang="vi-VN"]'),
    ).toHaveAttribute("href", viUrl!);
    await expect(
      page.locator('link[rel="alternate"][hreflang="en-US"]'),
    ).toHaveAttribute("href", `${viUrl}/en`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      viUrl!,
    );

    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${viUrl}/en`,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      `${viUrl}/en`,
    );

    // Public content pages must not inherit the homepage canonical or OG URL.
    await page.goto("/cho-online", { waitUntil: "domcontentloaded" });
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);

    for (const route of [
      "/tai-khoan",
      "/dang-nhap",
      "/dang-ky",
      "/admin/bao-gia",
    ]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator('meta[name="robots"]'), route).toHaveAttribute(
        "content",
        /noindex,\s*nofollow/,
      );
    }
  });

  test("homepage shows the two newest verified cleanup reports", async ({
    page,
  }) => {
    await installHomeApiMock(page, homeApiReplies());
    await page.goto("/", { waitUntil: "networkidle" });

    const reports = page.locator("#diem-rac-da-don ul > li");
    await expect(reports).toHaveCount(2);
    await expect(reports.nth(0)).toContainText("Newest verified report");
    await expect(reports.nth(1)).toContainText(
      "Second newest verified report",
    );
    // Asserted on the section, not on the two <li>: a negated toContainText
    // against a multi-element locator is a strict-mode violation, and the
    // point of the check is that the third report is absent from the section.
    await expect(page.locator("#diem-rac-da-don")).not.toContainText(
      "Oldest verified report",
    );
  });

  for (const route of ROUTES) {
    test(`${route.path} renders 200 with one h1 and clean runtime`, async ({
      page,
    }) => {
      const issues = attachRuntimeGuards(page);
      const response = await page.goto(route.path, { waitUntil: "networkidle" });
      expect(response?.status(), `${route.path} status`).toBe(200);
      await assertOneH1(page, route.h1);
      await expect(page.locator("main#noi-dung")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "vi");
      assertCleanRuntime(issues, route.path);
    });
  }

  test("unknown route shows not-found content", async ({ page }) => {
    const issues = attachRuntimeGuards(page);
    const response = await page.goto("/trang-khong-ton-tai-xyz", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
    await assertOneH1(page, "Không tìm thấy trang");
    await expect(
      page.getByRole("link", { name: "Về trang chủ" }),
    ).toBeVisible();
    assertCleanRuntime(issues, "not-found");
  });

  test("anonymous marketplace shows login actions instead of a loading placeholder", async ({ page }) => {
    await page.goto("/cho-online", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Gói người mua" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Đăng nhập để mua gói" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Đăng nhập để đặt giữ" }).first(),
    ).toBeVisible();
  });

  test("shows a recoverable error when the response body stream fails", async ({ page }) => {
    await page.addInitScript(() => {
      const realFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.endsWith("/api/marketplace/listings")) {
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new TypeError("connection lost"));
              },
            }),
            { status: 200 },
          );
        }
        return realFetch(input, init);
      };
    });
    await page.goto("/cho-online", { waitUntil: "domcontentloaded" });
    const alert = page.locator('main [role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).not.toBeEmpty();
  });
});

test.describe("English routes & i18n @core", () => {
  test("homepage fetch errors are localized on the English route", async ({
    page,
  }) => {
    const failure = {
      status: 500,
      json: { error: { code: "UNKNOWN_ERROR", message: "private detail" } },
    };
    await installHomeApiMock(
      page,
      homeApiReplies({
        "/api/stats": failure,
        "/api/marketplace/listings": failure,
        "/api/cleanup-reports/public": failure,
      }),
    );
    await page.goto("/en", { waitUntil: "networkidle" });

    // Scoped to the impact section rather than the page: Next's empty
    // #__next-route-announcer__ also carries role="alert", so a bare alert
    // role resolves to two elements. Scoping also makes this assert the error
    // surfaces in the right place, not merely somewhere on the page.
    await expect(page.locator("#tac-dong").getByRole("alert")).toContainText(
      "Unable to load impact statistics.",
    );
    await expect(page.getByTestId("featured-listings-error")).toContainText(
      "Unable to load listings.",
    );
    await expect(
      page.getByTestId("public-cleanup-reports-error"),
    ).toContainText("Unable to load verified reports.");
    await expect(page.locator("main")).not.toContainText("Không thể tải");
    await expect(page.locator("main")).not.toContainText("private detail");
  });

  const EN_ROUTES = [
    { path: "/en", h1: "Scrap finds a buyer! Report illegal dumping!" },
    { path: "/en/recycling-bins", h1: "Recycling Bins" },
    { path: "/en/services", h1: "Services" },
    { path: "/en/community-cleanup", h1: "Community Reporting" },
    { path: "/en/marketplace", h1: "Marketplace" },
    { path: "/en/login", h1: "Sign In" },
    { path: "/en/register", h1: "Create Account" },
    { path: "/en/sell-scrap", h1: "Sell Scrap" },
  ] as const;

  for (const route of EN_ROUTES) {
    test(`${route.path} renders 200 with English h1 and lang="en"`, async ({
      page,
    }) => {
      const issues = attachRuntimeGuards(page);
      const response = await page.goto(route.path, { waitUntil: "networkidle" });
      expect(response?.status(), `${route.path} status`).toBe(200);
      await assertOneH1(page, route.h1);
      await expect(page.locator("main#noi-dung")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      assertCleanRuntime(issues, route.path);
    });
  }

  test("unknown English route shows English not-found content", async ({ page }) => {
    const issues = attachRuntimeGuards(page);
    const response = await page.goto("/en/unknown-page-xyz", {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
    await assertOneH1(page, "Page Not Found");
    await expect(
      page.getByRole("link", { name: "Return home" }),
    ).toBeVisible();
    // No html[lang] assertion here: Next renders notFound() into its own
    // error document (<html id="__next_error__">) which sits outside
    // [locale]/layout.tsx, so the locale layout never gets to set lang. The
    // copy above still proves the 404 body itself is localized.
    assertCleanRuntime(issues, "not-found-en");
  });

  test("language switcher toggles between VI and EN routes while preserving query params", async ({
    page,
  }) => {
    await page.goto("/cho-online?sort=newest", { waitUntil: "networkidle" });

    // The languages sit behind a globe disclosure, so open it first.
    const viTrigger = page
      .getByRole("button", { name: /Chuyển đổi ngôn ngữ/ })
      .first();
    await expect(viTrigger).toHaveAttribute("aria-expanded", "false");
    await viTrigger.click();
    await expect(viTrigger).toHaveAttribute("aria-expanded", "true");

    const enSwitch = page.getByRole("link", { name: "Chuyển sang Tiếng Anh" });
    await expect(enSwitch).toBeVisible();
    await expect(enSwitch).toHaveAttribute("href", "/en/marketplace?sort=newest");

    await enSwitch.click();
    await page.waitForURL("**/en/marketplace?sort=newest");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await assertOneH1(page, "Marketplace");

    const enTrigger = page.getByRole("button", { name: /Switch language/ }).first();
    await enTrigger.click();

    const viSwitch = page.getByRole("link", { name: "Switch to Vietnamese" });
    await expect(viSwitch).toBeVisible();
    await expect(viSwitch).toHaveAttribute("href", "/cho-online?sort=newest");

    await viSwitch.click();
    await page.waitForURL("**/cho-online?sort=newest");
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await assertOneH1(page, "Chợ online");
  });
});
