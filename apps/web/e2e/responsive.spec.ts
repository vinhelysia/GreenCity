import { test, expect } from "@playwright/test";
import {
  VIEWPORTS,
  attachRuntimeGuards,
  assertCleanRuntime,
  assertNoHorizontalOverflow,
  menuToggle,
  mainNav,
} from "./helpers";

test.describe("Responsive overflow and layout", () => {
  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow at ${vp.name}`, async ({ page }) => {
      const issues = attachRuntimeGuards(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/", { waitUntil: "networkidle" });
      await assertNoHorizontalOverflow(page);

      // Header brand and login remain in layout
      await expect(page.getByRole("link", { name: "GreenCity" }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Đăng nhập" }).first()).toBeVisible();

      if (vp.width < 1024) {
        await expect(menuToggle(page)).toBeVisible();
      } else {
        await expect(mainNav(page).getByRole("link", { name: "Chợ online" })).toBeVisible();
      }

      // Spot-check other routes for overflow
      for (const path of ["/cho-online", "/dang-nhap", "/thung-rac"]) {
        await page.goto(path, { waitUntil: "networkidle" });
        await assertNoHorizontalOverflow(page);
      }

      assertCleanRuntime(issues, `overflow-${vp.name}`);
    });
  }

  test("footer does not cover main content on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    const overlap = await page.evaluate(() => {
      const main = document.querySelector("main");
      const footer = document.querySelector("footer");
      if (!main || !footer) return { error: "missing landmarks" };
      const m = main.getBoundingClientRect();
      const f = footer.getBoundingClientRect();
      // Footer should start at or below main bottom in document flow (allow 1px).
      return {
        mainBottom: m.bottom,
        footerTop: f.top,
        // On long pages, footer may be below viewport; check document order via offsetTop.
        mainOffsetBottom: (main as HTMLElement).offsetTop + (main as HTMLElement).offsetHeight,
        footerOffsetTop: (footer as HTMLElement).offsetTop,
      };
    });
    expect(overlap.error).toBeUndefined();
    expect(overlap.footerOffsetTop!).toBeGreaterThanOrEqual(
      (overlap.mainOffsetBottom ?? 0) - 1,
    );
  });
});
