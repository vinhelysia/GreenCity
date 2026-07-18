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
});
