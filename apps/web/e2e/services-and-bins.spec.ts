import { test, expect } from "@playwright/test";
import {
  attachRuntimeGuards,
  assertCleanRuntime,
  assertNoHorizontalOverflow,
  assertOneH1,
} from "./helpers";
import snapshot from "../src/data/recycling-points.json";

/**
 * /dich-vu and /thung-rac were "đang phát triển" placeholders. Both now render
 * real content and neither calls an API, so these run without auth or mocks.
 *
 * The counts below are read from the committed snapshot rather than hardcoded:
 * a refresh that changes how many points OpenStreetMap has should not fail the
 * suite, but a page that stops reflecting the snapshot should.
 */

const TOTAL = snapshot.points.length;
const CONTAINERS = snapshot.points.filter(
  (p) => p.recyclingType === "container",
).length;

test.describe("Service catalog @core", () => {
  test("lists every service with its limit and a working link", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    await page.goto("/dich-vu", { waitUntil: "networkidle" });
    await assertOneH1(page, "Dịch vụ");

    const cards = page.locator('[data-testid="service-catalog"] > li');
    await expect(cards).toHaveCount(4);

    // The limit line is the point of the page: a catalogue that only lists
    // capabilities is the kind that oversells.
    for (let i = 0; i < 4; i += 1) {
      await expect(cards.nth(i)).toContainText("Giới hạn:");
    }

    // Each card must admit the one thing its feature cannot do.
    await expect(cards.nth(1)).toContainText("payOS");
    await expect(cards.nth(2)).toContainText("chưa điều phối");
    await expect(cards.nth(3)).toContainText("DEMO-ONLY");

    // No placeholder language survives anywhere on the page.
    await expect(page.locator("main")).not.toContainText("Đang phát triển");

    await page
      .getByRole("link", { name: /Đến Bán phế liệu/ })
      .click();
    await expect(page).toHaveURL(/\/ban-phe-lieu$/);

    await assertNoHorizontalOverflow(page);
    assertCleanRuntime(issues, "dich-vu");
  });

  test("renders the English catalog on /en/services", async ({ page }) => {
    await page.goto("/en/services", { waitUntil: "networkidle" });
    await assertOneH1(page, "Services");

    const cards = page.locator('[data-testid="service-catalog"] > li');
    await expect(cards).toHaveCount(4);
    await expect(cards.first()).toContainText("Limit:");
    await expect(page.locator("main")).not.toContainText("Giới hạn:");
  });
});

test.describe("Recycling points @core", () => {
  test("shows every snapshot point with its provenance", async ({ page }) => {
    const issues = attachRuntimeGuards(page);
    await page.goto("/thung-rac", { waitUntil: "networkidle" });
    await assertOneH1(page, "Thùng rác");

    await expect(page.locator('[data-testid="recycling-list"] > li')).toHaveCount(
      TOTAL,
    );

    // The honest count, not a rounded-up one: the page states how many of the
    // points are really containers.
    const coverage = page.getByRole("region", { name: "Mức độ phủ" });
    await expect(coverage).toContainText(String(TOTAL));
    await expect(coverage).toContainText(String(CONTAINERS));

    // Attribution is an ODbL condition, not decoration.
    await expect(
      page.getByRole("link", { name: /OpenStreetMap · ODbL/ }),
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);
    assertCleanRuntime(issues, "thung-rac");
  });

  test("draws one map marker per point and names the map for assistive tech", async ({
    page,
  }) => {
    await page.goto("/thung-rac", { waitUntil: "networkidle" });

    // Named rather than aria-hidden: Leaflet puts real focusable controls in
    // the container, and hiding them from assistive tech while leaving them
    // tabbable is the aria-hidden-focus violation the axe suite catches.
    const map = page.getByTestId("recycling-map");
    await expect(map).not.toHaveAttribute("aria-hidden", "true");
    await expect(map).toHaveAccessibleName(/Bản đồ các điểm thu gom tái chế/);
    // Leaflet renders asynchronously after hydration.
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(TOTAL);

    // The list is the accessible equivalent, so it must carry what the map
    // cannot: every point reachable as a link to its OSM record.
    await expect(
      page.getByRole("link", { name: /trên OpenStreetMap$/ }),
    ).toHaveCount(TOTAL);
  });

  test("fits 320px with the map rendered", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/thung-rac", { waitUntil: "networkidle" });
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(TOTAL);
    await assertNoHorizontalOverflow(page);
  });

  /**
   * The tile host is the one thing on this page we do not serve. When it is
   * unreachable the map used to degrade into a blank grey square, which reads
   * as "there is nothing here" rather than "the backdrop did not load" — and
   * Leaflet kept re-requesting tiles on every interaction. Aborting the tile
   * requests reproduces that deterministically, on any network.
   */
  test("says the map backdrop failed instead of showing an empty square", async ({
    page,
  }) => {
    // A RegExp, not a glob: the tile host is a.tile.openstreetmap.org, and
    // "**/tile.openstreetmap.org/**" needs a slash where that URL has a dot,
    // so the glob silently matches nothing and the test passes on a network
    // that happens to block the tiles anyway.
    await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
    await page.goto("/thung-rac", { waitUntil: "networkidle" });

    await expect(
      page.getByTestId("recycling-map-tiles-unavailable"),
    ).toHaveText(/OpenStreetMap/);

    // Everything served from the snapshot survives the failure: the map keeps
    // its markers, and the list keeps every point.
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(TOTAL);
    await expect(
      page.getByRole("link", { name: /trên OpenStreetMap$/ }),
    ).toHaveCount(TOTAL);
    await assertNoHorizontalOverflow(page);
  });

  test("leaves the notice off when the tiles load", async ({ page }) => {
    // A single dropped tile is normal on a flaky connection and must not
    // replace a map that is otherwise fine.
    let served = 0;
    await page.route(/tile\.openstreetmap\.org/, (route) => {
      served += 1;
      return served === 1
        ? route.abort()
        : route.fulfill({
            status: 200,
            contentType: "image/png",
            // 1x1 transparent PNG.
            body: Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
              "base64",
            ),
          });
    });
    await page.goto("/thung-rac", { waitUntil: "networkidle" });

    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(TOTAL);
    await expect(
      page.getByTestId("recycling-map-tiles-unavailable"),
    ).toHaveCount(0);
  });
});
