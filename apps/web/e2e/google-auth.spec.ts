import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { assertNoHorizontalOverflow } from "./helpers";

test("OAuth callback keeps no-referrer through the Next proxy @core", async ({ request }) => {
  const response = await request.get("/api/auth/google/callback?error=access_denied", { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["cache-control"]).toMatch(/private.*no-store/);
});

test("Google sign-in keeps VI/EN destinations, pending state, retry and safe redirects @core", async ({ page }) => {
  await page.route("**/api/auth/google/status", route => route.fulfill({ json: { enabled: true, linked: false } }));
  const requests: unknown[] = [];
  let finish: (() => void) | undefined;
  await page.route("**/api/auth/google/start", async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) await new Promise<void>(resolve => { finish = resolve; });
    // A malicious/unexpected provider URL must not leave the GreenCity page.
    await route.fulfill({ json: { url: "https://evil.test/steal" } });
  });
  await page.goto("/dang-nhap?next=%2Fcho-online");
  const action = page.getByTestId("google-sign-in-panel").getByRole("button");
  await action.click();
  await expect(action).toBeDisabled();
  await expect.poll(() => Boolean(finish)).toBe(true);
  finish!();
  await expect(page.getByRole("alert").filter({ hasText: "Không thể hoàn tất đăng nhập Google" })).toBeVisible();
  await expect(action).toBeEnabled();
  expect(requests[0]).toEqual({ returnTo: "/cho-online" });
  await expect(page).toHaveURL(/dang-nhap/);
  await action.click();
  await expect.poll(() => requests.length).toBe(2);
  await page.goto("/en/register?next=%2Fcho-online");
  await page.getByRole("button", { name: "Sign in with Google", exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2]).toEqual({ returnTo: "/en/marketplace" });
});

test("Google email collision is localized, email login stays usable, narrow layouts fit @core", async ({ page }) => {
  await page.route("**/api/auth/google/status", route => route.fulfill({ json: { enabled: true, linked: false } }));
  for (const [route, button, message] of [
    ["/dang-nhap?googleError=link_required", "Đăng nhập với Google", "Hãy đăng nhập bằng mật khẩu"],
    ["/en/login?googleError=link_required", "Sign in with Google", "Sign in with your password"],
  ] as const) {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(route);
    await expect(page.getByRole("button", { name: button, exact: true })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
    await expect(page.getByLabel(/^Email(?: Address)?$/)).toBeEnabled();
    await assertNoHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dang-nhap");
  await expect(page.getByRole("button", { name: "Đăng nhập với Google", exact: true })).toBeVisible();
  const output = path.resolve(process.cwd(), "../../.local/verification/google-auth-2026-10-02");
  mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, "login.png") });
});

test("Google sign-in stays hidden without provider configuration @core", async ({ page }) => {
  await page.route("**/api/auth/google/status", route => route.fulfill({ json: { enabled: false, linked: false } }));
  await page.goto("/dang-nhap");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập với Google", exact: true })).toHaveCount(0);
});

test("Account linking uses authenticated endpoint and reports a linked Google identity @core", async ({ page }) => {
  for (const [endpoint, json] of [
    ["points/me", { balance: 0, entries: [] }],
    ["scrap-requests/mine", { requests: [] }],
    ["cleanup-reports/mine", { reports: [] }],
    ["account/history", { reservations: [], subscriptions: [], payments: [] }],
    ["subscriptions/me", { eligible: false, subscription: null, checkoutAvailable: false }],
  ] as const) {
    await page.route(`**/api/${endpoint}*`, route => route.fulfill({ json }));
  }
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: {
    id: "google-link-ui", email: "google-link@example.test", displayName: "Google link test", phone: null,
    roles: ["USER"], status: "ACTIVE", createdAt: "2026-10-02T00:00:00.000Z",
  } } }));
  await page.route("**/api/auth/google/status", route => route.fulfill({ json: { enabled: true, linked: false } }));
  let body: unknown;
  await page.route("**/api/auth/google/link", async route => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 503, json: { error: { code: "GOOGLE_UNAVAILABLE", message: "not configured" } } });
  });
  await page.goto("/en/account");
  const panel = page.getByTestId("google-link-panel");
  await panel.getByRole("button", { name: "Link Google account", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Unable to complete Google sign-in");
  expect(body).toEqual({ returnTo: "/en/account" });
  await page.route("**/api/auth/google/status", route => route.fulfill({ json: { enabled: true, linked: true } }));
  await page.reload();
  await expect(panel.getByRole("status")).toContainText("Google account linked");
  await expect(panel.getByRole("button")).toHaveCount(0);
});
