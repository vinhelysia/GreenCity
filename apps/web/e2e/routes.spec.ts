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
      assertCleanRuntime(issues, route.path);
    });
  }

  test("unknown route shows not-found content", async ({ page }) => {
    const issues = attachRuntimeGuards(page);
    const response = await page.goto("/trang-khong-ton-tai-xyz", {
      waitUntil: "networkidle",
    });
    // Next.js App Router not-found typically returns 404.
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
