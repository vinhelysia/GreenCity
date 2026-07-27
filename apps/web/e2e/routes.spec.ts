import { test, expect } from "@playwright/test";
import {
  ROUTES,
  attachRuntimeGuards,
  assertCleanRuntime,
  assertOneH1,
} from "./helpers";

test.describe("Public routes", () => {
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

test.describe("English routes & i18n", () => {
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
