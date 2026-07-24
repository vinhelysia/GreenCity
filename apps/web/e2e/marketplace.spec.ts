import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { attachRuntimeGuards, assertCleanRuntime, waitForAuthReady } from "./helpers";

/**
 * The full marketplace flow through the browser, proving the screens wire to the
 * real API end to end: a fresh seller submits scrap with a photo, the seeded
 * admin quotes within the price band, the seller accepts, the listing goes live,
 * and the seeded (subscribed) buyer reserves it — after which it is no longer
 * on the market.
 *
 * Requires the local DB to be seeded (pnpm --filter api db:seed): it uses the
 * seeded admin@ and buyer@ accounts and the seeded categories. Admin role and a
 * buyer subscription cannot be created through the UI by design, so they must
 * come from the seed. DEMO_PASSWORD must match what the DB was seeded with.
 */

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "GreenCity-Demo-2026";
const SUFFIX = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const SELLER_EMAIL = `seller-${SUFFIX}@market-${SUFFIX}.test`;

// A unique weight per run so this run's request/listing never collides with a
// leftover from another run or the seeded PET listings.
const PRICE = 1234; // within the seeded PET band 1000–1500
const WEIGHT = (7 + Math.floor(Math.random() * 900) / 1000).toFixed(3); // e.g. "7.437"
const LISTING_TOTAL = Math.round(PRICE * Number(WEIGHT)).toLocaleString("vi-VN");

// A real 240x180 PNG fixture — the media pipeline decodes and re-encodes, so a
// 1x1 image is rejected as unsupported.
const SCRAP_PNG = path.join(process.cwd(), "e2e/fixtures/scrap.png");

test.afterAll(() => {
  execFileSync(
    process.execPath,
    [path.join(process.cwd(), "e2e/cleanup-marketplace.mjs"), SUFFIX],
    { cwd: process.cwd(), stdio: "inherit", env: process.env },
  );
});

async function login(page: Page, email: string, password: string) {
  await page.goto("/dang-nhap", { waitUntil: "networkidle" });
  await waitForAuthReady(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByTestId("header-logout")).toBeVisible({ timeout: 15_000 });
}

async function logout(page: Page) {
  await page.getByTestId("header-logout").click();
  await expect(page.getByTestId("header-login")).toBeVisible({ timeout: 15_000 });
}

test("seller submits, admin quotes, seller accepts, buyer reserves", async ({ page }) => {
  const issues = attachRuntimeGuards(page, { allowConflict: true });

  // 1. Fresh seller registers.
  await page.goto("/dang-ky", { waitUntil: "networkidle" });
  await waitForAuthReady(page);
  await page.getByLabel(/Tên hiển thị/i).fill("Seller Test");
  await page.getByLabel("Email").fill(SELLER_EMAIL);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(page.getByTestId("header-logout")).toBeVisible({ timeout: 15_000 });

  // 2. Seller submits a scrap request with one photo.
  await page.goto("/ban-phe-lieu", { waitUntil: "networkidle" });
  const categorySelect = page.getByLabel("Loại phế liệu");
  // The option label carries the price band, so match by text and select by value.
  const petValue = await categorySelect
    .locator("option", { hasText: "Chai nhựa PET" })
    .first()
    .getAttribute("value");
  await categorySelect.selectOption(petValue!);
  await page.getByLabel("Khối lượng ước tính (kg)").fill(WEIGHT);
  await page.getByLabel("Ảnh phế liệu (một ảnh)").setInputFiles(SCRAP_PNG);
  // Upload is async; wait for the preview (photoState = done) before submitting.
  await expect(page.getByAltText("Ảnh phế liệu đã chọn")).toBeVisible({
    timeout: 15_000,
  });
  const submitResp = page.waitForResponse(
    (r) =>
      r.url().includes("/api/scrap-requests") &&
      r.request().method() === "POST",
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  expect((await submitResp).status()).toBe(201);
  // The request appears in "my requests" with its weight.
  await expect(page.getByText(`${WEIGHT}kg`, { exact: false })).toBeVisible({
    timeout: 15_000,
  });
  await logout(page);

  // 3. Seeded admin quotes within the band.
  await login(page, "admin@greencity.demo", DEMO_PASSWORD);
  await page.goto("/admin/bao-gia", { waitUntil: "networkidle" });
  const adminRow = page.locator("li").filter({ hasText: `${WEIGHT}kg` }).first();
  await expect(adminRow).toBeVisible({ timeout: 15_000 });
  await adminRow.getByLabel("Giá báo (đ/kg)").fill(String(PRICE));
  const quoteResp = page.waitForResponse(
    (r) => r.url().includes("/api/admin/scrap-requests") && r.request().method() === "POST",
    { timeout: 15_000 },
  );
  await adminRow.getByRole("button", { name: "Gửi báo giá" }).click();
  expect((await quoteResp).status()).toBeLessThan(400);
  await logout(page);

  // 4. Seller accepts the quote (confirm dialog).
  page.on("dialog", (d) => void d.accept());
  await login(page, SELLER_EMAIL, DEMO_PASSWORD);
  await page.goto("/ban-phe-lieu", { waitUntil: "networkidle" });
  const acceptBtn = page.getByRole("button", { name: "Chấp nhận" });
  await expect(acceptBtn).toBeVisible({ timeout: 15_000 });
  await acceptBtn.click();
  // Quote actions disappear once accepted.
  await expect(page.getByRole("button", { name: "Chấp nhận" })).toBeHidden({
    timeout: 15_000,
  });
  await logout(page);

  // 5. Seeded, subscribed buyer reserves the now-live listing.
  await login(page, "buyer@greencity.demo", DEMO_PASSWORD);
  await page.goto("/cho-online", { waitUntil: "networkidle" });
  const listingCard = page
    .locator("li")
    .filter({ hasText: LISTING_TOTAL })
    .first();
  await expect(listingCard).toBeVisible({ timeout: 15_000 });
  const reserveResp = page.waitForResponse(
    (r) =>
      /\/api\/marketplace\/listings\/[^/]+\/reserve/.test(r.url()) &&
      r.request().method() === "POST",
    { timeout: 15_000 },
  );
  await listingCard.getByRole("button", { name: "Đặt giữ" }).click();
  // The reservation is created: this is the end-to-end proof the flow works.
  expect((await reserveResp).status()).toBe(201);

  // A 201 alone is not proof the buyer was told it worked. Checking only the
  // response let a bug ship where the reservation succeeded while the row
  // showed an error, so assert what the buyer ends up looking at. On success
  // the list reloads and the listing leaves the market; on that failure the
  // reload never ran and the card stayed put next to an error.
  await expect(listingCard).toHaveCount(0, { timeout: 15_000 });

  assertCleanRuntime(issues, "marketplace");
});
