import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ECO_ARROW_PATH } from "../src/components/eco-icons";
import { attachRuntimeGuards, assertCleanRuntime, assertNoHorizontalOverflow, menuToggle } from "./helpers";

for (const motion of ["no-preference", "reduce"] as const) {
  test(`CTA morph supports pointer, keyboard and ${motion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motion });
    const issues = attachRuntimeGuards(page);
    await page.goto("/", { waitUntil: "networkidle" });
    const action = page.locator(".home-hero a").first();
    const icon = action.locator("svg");
    const shape = icon.locator("path");
    const initial = await shape.getAttribute("d");
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    await shape.evaluate(el => {
      const seen: string[] = [];
      new MutationObserver(() => {
        seen.push(el.getAttribute("d") ?? "");
        el.setAttribute("data-observed-shapes", JSON.stringify(seen));
      }).observe(el, { attributes: true, attributeFilter: ["d"] });
    });
    await action.hover();
    await expect(shape).toHaveAttribute("d", ECO_ARROW_PATH);
    const frames: string[] = JSON.parse(await shape.getAttribute("data-observed-shapes") ?? "[]");
    expect(frames.length).toBeGreaterThan(0);
    if (motion === "reduce") expect(frames.every(frame => frame === ECO_ARROW_PATH)).toBe(true);
    else expect(frames.some(frame => frame !== ECO_ARROW_PATH && frame !== initial)).toBe(true);

    await action.focus();
    await page.mouse.move(0, 0);
    await expect(shape).toHaveAttribute("d", ECO_ARROW_PATH);
    await action.evaluate(el => (el as HTMLElement).blur());
    await expect(shape).toHaveAttribute("d", initial!);
    assertCleanRuntime(issues, `morph-${motion}`);
  });
}

test("VI/EN icon UI stays reachable at mobile widths and menu morphs", async ({ page }) => {
  const issues = attachRuntimeGuards(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/", "/en"]) {
    for (const width of [320, 375, 414, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route, { waitUntil: "networkidle" });
      await assertNoHorizontalOverflow(page);
      for (const action of await page.locator(".home-hero a").all()) {
        const bounds = await action.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      }
      const toggle = menuToggle(page);
      const shape = toggle.locator("svg path");
      await expect(shape).toHaveAttribute("d", "M4 6h16M4 12h16M4 18h16");
      await toggle.click();
      await expect(shape).toHaveAttribute("d", "M6 6l12 12M6 18 18 6");
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      await expect(shape).toHaveAttribute("d", "M4 6h16M4 12h16M4 18h16");
    }
  }
  const output = path.resolve(process.cwd(), "../../.local/verification/morphicons-2026-10-02");
  mkdirSync(output, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(output, "homepage.png"), fullPage: true });
  await page.screenshot({ path: path.join(output, "hero.png") });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: path.join(output, "mobile.png"), fullPage: true });
  await page.screenshot({ path: path.join(output, "mobile-hero.png") });
  assertCleanRuntime(issues, "responsive-icons");
});
