import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { attachRuntimeGuards, assertCleanRuntime, assertNoHorizontalOverflow, waitForAuthReady } from "./helpers";

/**
 * The full marketplace flow through the browser, proving the screens wire to the
 * real API end to end: a fresh seller submits scrap with a photo, the seeded
 * admin quotes within the price band, the seller accepts, the listing goes live,
 * and the seeded (subscribed) buyer reserves it — after which it is no longer
 * on the market.
 *
 * Requires seeded admin and categories. The buyer is test-owned and gets a
 * pass through the admin grant UI, so the test never depends on an old demo
 * subscription's expiry. DEMO_PASSWORD must match the seeded admin account.
 */

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "GreenCity-Demo-2026";
const SUFFIX = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const SELLER_EMAIL = `seller-${SUFFIX}@market-${SUFFIX}.test`;
const BUYER_EMAIL = `buyer-${SUFFIX}@market-${SUFFIX}.test`;

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

test("seller submits, admin quotes, seller accepts, buyer reserves @core", async ({ page }) => {
  test.setTimeout(120_000);
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
  await expect(page.getByText(`${Number(WEIGHT)}kg`, { exact: false })).toBeVisible({
    timeout: 15_000,
  });
  await logout(page);

  // 3. Seeded admin quotes within the band.
  await login(page, "admin@greencity.demo", DEMO_PASSWORD);

  // The admin screens live outside the public nav, so the only way in is the
  // admin-only header link. Prove it appears and lands on an admin screen,
  // otherwise an admin has no route to the queues but typing URLs.
  const adminLink = page.getByTestId("header-admin");
  await expect(adminLink).toBeVisible();
  await adminLink.click();
  await page.waitForURL("**/admin/**");
  await expect(
    page.getByRole("navigation", { name: "Khu vực quản trị" }),
  ).toBeVisible();

  await page.goto("/admin/bao-gia", { waitUntil: "networkidle" });
  const adminRow = page.locator("li").filter({ hasText: `${Number(WEIGHT)}kg` }).first();
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

  // 5. A fresh buyer gets a test-only pass from the existing admin grant UI.
  await page.goto("/dang-ky", { waitUntil: "networkidle" });
  await waitForAuthReady(page);
  await page.getByLabel(/Tên hiển thị/i).fill("Buyer Test");
  await page.getByLabel("Email").fill(BUYER_EMAIL);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(page.getByTestId("header-logout")).toBeVisible();
  await logout(page);
  await login(page, "admin@greencity.demo", DEMO_PASSWORD);
  await page.goto("/admin/giao-dich", { waitUntil: "networkidle" });
  await page.getByLabel("Email tài khoản").fill(BUYER_EMAIL);
  await page.getByLabel("Lý do cấp").fill("Disposable collection browser test");
  await page.getByRole("button", { name: "Cấp gói", exact: true }).click();
  await expect(page.getByTestId("grant-pass-success")).toContainText(BUYER_EMAIL);
  await logout(page);
  await login(page, BUYER_EMAIL, DEMO_PASSWORD);
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
  const reserved = await reserveResp;
  expect(reserved.status()).toBe(201);
  const { reservationId } = await reserved.json();

  // A 201 alone is not proof the buyer was told it worked. Checking only the
  // response let a bug ship where the reservation succeeded while the row
  // showed an error. The buyer must reach the new private order details.
  await expect(page).toHaveURL(new RegExp(`/tai-khoan\\?reservation=${reservationId}$`));
  await expect(page.getByTestId("account-reservation-detail")).toContainText(reservationId);
  await expect(page.getByTestId("account-reservation-detail")).toContainText("Chờ admin điều phối");

  // Cancel from the mobile admin UI, then rebook without erasing the first order.
  await logout(page);
  await login(page, "admin@greencity.demo", DEMO_PASSWORD);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/admin/giao-dich", { waitUntil: "networkidle" });
  const cancelledRow = page.locator("li").filter({ hasText: reservationId });
  await cancelledRow.locator("summary").filter({ hasText: "Hủy đơn và mở lại tin" }).click();
  await cancelledRow.getByLabel("Lý do hủy").fill("Buyer needs another pickup appointment");
  await cancelledRow.getByRole("button", { name: "Hủy đơn và mở lại tin" }).click();
  await expect(cancelledRow).toHaveCount(0);
  await logout(page);
  await login(page, BUYER_EMAIL, DEMO_PASSWORD);
  await page.goto(`/tai-khoan?reservation=${reservationId}`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("account-reservation-detail")).toContainText("Đã hủy");
  await page.goto("/cho-online", { waitUntil: "networkidle" });
  const rebookResponse = page.waitForResponse(r => /\/api\/marketplace\/listings\/[^/]+\/reserve/.test(r.url()) && r.request().method() === "POST");
  await page.locator("li").filter({ hasText: LISTING_TOTAL }).first().getByRole("button", { name: "Đặt giữ" }).click();
  const rebook = await rebookResponse;
  expect(rebook.status()).toBe(201);
  const nextId = (await rebook.json()).reservationId;
  expect(nextId).not.toBe(reservationId);
  await expect(page.getByTestId("account-reservation-detail")).toContainText(nextId);
  await logout(page);
  await login(page, "admin@greencity.demo", DEMO_PASSWORD);
  await page.goto("/admin/giao-dich", { waitUntil: "networkidle" });
  const activeRow = page.locator("li").filter({ hasText: nextId });
  await activeRow.locator("summary").filter({ hasText: "Lịch lấy hàng" }).click();
  await activeRow.getByLabel("Ngày giờ lấy hàng").fill("2026-11-01T08:00");
  await activeRow.getByLabel("Điểm hẹn").fill("Campus collection point — UI test");
  await activeRow.getByLabel("Liên hệ điều phối").fill("Coordinator TEST: 0900000000");
  await assertNoHorizontalOverflow(page);
  await activeRow.getByRole("button", { name: "Lưu lịch hẹn" }).click();
  await expect(activeRow.getByTestId("reservation-summary")).toContainText("Campus collection point — UI test");
  // The seller can see the appointment before completion.
  await logout(page);
  await login(page, SELLER_EMAIL, DEMO_PASSWORD);
  await page.goto(`/tai-khoan?reservation=${nextId}`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("account-reservation-detail")).toContainText("Coordinator TEST: 0900000000");
  await logout(page);
  await login(page, "admin@greencity.demo", DEMO_PASSWORD);
  await page.goto("/admin/giao-dich", { waitUntil: "networkidle" });
  const completionRow = page.locator("li").filter({ hasText: nextId });
  await completionRow.locator("summary").filter({ hasText: "Xác nhận đã thu gom và trả tiền" }).click();
  const actualWeight = Number((Number(WEIGHT) - 1).toFixed(3));
  const receivedAmount = Math.round(actualWeight * PRICE);
  await completionRow.getByLabel("Khối lượng thực cân (kg)").fill(String(actualWeight));
  await completionRow.getByLabel("Tiền seller đã nhận (VND)").fill(String(receivedAmount));
  await completionRow.getByLabel("Mã hoặc ghi chú biên nhận").fill("Cash receipt UI-001 — seller confirmed");
  await assertNoHorizontalOverflow(page);
  await completionRow.getByRole("button", { name: "Xác nhận đã thu gom và trả tiền" }).click();
  await expect(completionRow).toHaveCount(0);
  await logout(page);
  await login(page, SELLER_EMAIL, DEMO_PASSWORD);
  await page.goto(`/tai-khoan?reservation=${nextId}`, { waitUntil: "networkidle" });
  const completedDetail = page.getByTestId("account-reservation-detail");
  await expect(completedDetail).toContainText("Hoàn tất");
  await expect(completedDetail).toContainText(receivedAmount.toLocaleString("vi-VN"));
  await expect(completedDetail).toContainText("Cash receipt UI-001");
  await expect(page.getByTestId("account-points").getByText(`${Math.max(1, Math.floor(receivedAmount / 1000))} điểm`, { exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 1280, height: 960 });
  const screenshotPath = path.resolve(process.cwd(), "../../.local/verification/collection-flow-2026-10-02/collection-completed.png");
  mkdirSync(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath });

  assertCleanRuntime(issues, "marketplace");
});
