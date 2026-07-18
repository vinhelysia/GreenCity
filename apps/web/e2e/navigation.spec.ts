import { test, expect } from "@playwright/test";
import {
  NAV_LINKS,
  attachRuntimeGuards,
  assertCleanRuntime,
  mainNav,
  menuToggle,
} from "./helpers";

test.describe("Desktop navigation", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("primary nav links navigate and set active state", async ({ page }) => {
    const issues = attachRuntimeGuards(page);
    await page.goto("/", { waitUntil: "networkidle" });

    const nav = mainNav(page);
    await expect(nav.getByRole("link", { name: "Trang chủ" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    for (const link of NAV_LINKS) {
      if (link.href === "/") continue;
      await nav.getByRole("link", { name: link.name }).click();
      await page.waitForURL(`**${link.href}`);
      await expect(
        mainNav(page).getByRole("link", { name: link.name }),
      ).toHaveAttribute("aria-current", "page");
      // Home must not remain current on other routes.
      await expect(
        mainNav(page).getByRole("link", { name: "Trang chủ" }),
      ).not.toHaveAttribute("aria-current", "page");
    }

    assertCleanRuntime(issues, "desktop-nav");
  });

  test("browser back/forward restores route", async ({ page }) => {
    const issues = attachRuntimeGuards(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await mainNav(page).getByRole("link", { name: "Chợ online" }).click();
    await page.waitForURL("**/cho-online");
    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.locator("h1")).toContainText("GreenCity");
    await page.goForward();
    await page.waitForURL("**/cho-online");
    await expect(page.locator("h1")).toHaveText("Chợ online");
    assertCleanRuntime(issues, "history");
  });
});

test.describe("Mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("menu opens, closes, Escape returns focus, route closes menu", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    await page.goto("/", { waitUntil: "networkidle" });

    const toggle = menuToggle(page);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Open
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const homeLink = mainNav(page).getByRole("link", { name: "Trang chủ" });
    await expect(homeLink).toBeVisible();

    // Escape closes + focus returns to toggle
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();

    // Open again and navigate — menu must not stay open
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await mainNav(page).getByRole("link", { name: "Dịch vụ" }).click();
    await page.waitForURL("**/dich-vu");
    await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
    // Links are hidden when closed on mobile
    await expect(
      mainNav(page).getByRole("link", { name: "Trang chủ" }),
    ).toBeHidden();

    // Close via toggle click (header stays above backdrop)
    await menuToggle(page).click();
    await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");
    await menuToggle(page).click();
    await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");

    // Backdrop dismiss also closes
    await menuToggle(page).click();
    await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Đóng menu điều hướng" }).click();
    await expect(menuToggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(menuToggle(page)).toBeFocused();

    assertCleanRuntime(issues, "mobile-nav");
  });
});
