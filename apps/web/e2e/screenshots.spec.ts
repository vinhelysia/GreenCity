import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import {
  VIEWPORTS,
  attachRuntimeGuards,
  assertCleanRuntime,
  assertNoHorizontalOverflow,
  menuToggle,
  mainNav,
} from "./helpers";

const SHOT_DIR = join(process.cwd(), "screenshots");

test.describe("Approved screenshot set", () => {
  test.beforeAll(() => {
    mkdirSync(SHOT_DIR, { recursive: true });
  });

  test("regenerate foundation screenshots with relative VERIFY_REPORT", async ({
    page,
  }, testInfo) => {
    const issues = attachRuntimeGuards(page);
    const results: string[] = [];

    // Homepage at each required viewport
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/", { waitUntil: "networkidle" });
      await assertNoHorizontalOverflow(page);
      const file = `home-${vp.name}.png`;
      await page.screenshot({ path: join(SHOT_DIR, file), fullPage: true });
      results.push(file);
    }

    // Mobile nav open
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    await menuToggle(page).click();
    await expect(mainNav(page).getByRole("link", { name: "Trang chủ" })).toBeVisible();
    await page.screenshot({
      path: join(SHOT_DIR, "mobile-nav-open.png"),
      fullPage: true,
    });
    results.push("mobile-nav-open.png");

    // Login
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dang-nhap", { waitUntil: "networkidle" });
    await page.screenshot({
      path: join(SHOT_DIR, "dang-nhap.png"),
      fullPage: true,
    });
    results.push("dang-nhap.png");

    // Marketplace empty
    await page.goto("/cho-online", { waitUntil: "networkidle" });
    await page.screenshot({
      path: join(SHOT_DIR, "cho-online.png"),
      fullPage: true,
    });
    results.push("cho-online.png");

    // Not found
    await page.goto("/trang-khong-ton-tai-xyz", { waitUntil: "networkidle" });
    await page.screenshot({
      path: join(SHOT_DIR, "not-found.png"),
      fullPage: true,
    });
    results.push("not-found.png");

    assertCleanRuntime(issues, "screenshots");

    // Portable evidence only — relative path, no machine-local absolutes
    const report = [
      "OK",
      "tool=@playwright/test (repository-owned)",
      `project=${testInfo.project.name}`,
      "baseURL=http://127.0.0.1:3100",
      "screenshots=screenshots",
      `files=${results.join(",")}`,
      `command=pnpm --filter web test:e2e`,
      `generated=repository-relative`,
      "",
    ].join("\n");

    writeFileSync(join(SHOT_DIR, "VERIFY_REPORT.txt"), report, "utf8");
    expect(report).not.toMatch(/[A-Za-z]:\\/);
    expect(report).not.toMatch(/\/Users\//);
    expect(report).not.toMatch(/C:\\Stuff\\/);
  });
});
