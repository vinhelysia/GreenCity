import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  ROUTES,
  attachRuntimeGuards,
  assertCleanRuntime,
  assertOneH1,
} from "./helpers";

test.describe("Accessibility behavior", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("skip link targets #noi-dung and focuses main", async ({ page }) => {
    const issues = attachRuntimeGuards(page);
    await page.goto("/", { waitUntil: "networkidle" });

    const skip = page.getByRole("link", { name: "Bỏ qua đến nội dung chính" });
    await expect(skip).toHaveAttribute("href", "#noi-dung");

    // Tab to skip link (first focusable in document order)
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");

    const main = page.locator("main#noi-dung");
    await expect(main).toBeVisible();
    // Focus should land on main (tabIndex=-1) or stay at fragment target.
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        id: el?.id ?? "",
        tag: el?.tagName ?? "",
      };
    });
    expect(
      focused.id === "noi-dung" || focused.tag === "MAIN",
      `expected focus on main, got ${JSON.stringify(focused)}`,
    ).toBeTruthy();

    assertCleanRuntime(issues, "skip-link");
  });

  test("each public route has one h1 and landmarks", async ({ page }) => {
    const issues = attachRuntimeGuards(page);
    for (const route of ROUTES) {
      await page.goto(route.path, { waitUntil: "networkidle" });
      await assertOneH1(page, route.h1);
      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
      await expect(page.locator("main#noi-dung")).toHaveCount(1);
      await expect(
        page.getByRole("navigation", { name: "Điều hướng chính" }),
      ).toHaveCount(1);
    }
    assertCleanRuntime(issues, "landmarks");
  });

  test("focus-visible styles are not disabled globally", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Our globals.css must declare :focus-visible with a real outline.
    const hasFocusVisibleRule = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          const text = rule.cssText ?? "";
          if (
            /:focus-visible/.test(text) &&
            /outline/.test(text) &&
            !/outline\s*:\s*none/.test(text)
          ) {
            return true;
          }
        }
      }
      return false;
    });
    expect(hasFocusVisibleRule, "expected :focus-visible outline rule").toBe(
      true,
    );

    // Keyboard focus path: Tab to skip link, then to brand/header controls.
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Bỏ qua đến nội dung chính" });
    await expect(skip).toBeFocused();

    const login = page
      .getByRole("banner")
      .getByRole("link", { name: "Đăng nhập" });
    await login.focus();
    await expect(login).toBeFocused();
  });

  test("axe scan: serious/critical free on public routes", async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route.path, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(
        serious,
        `${route.path} axe serious/critical: ${JSON.stringify(
          serious.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.length })),
        )}`,
      ).toEqual([]);
    }
  });
});
