import { test, expect } from "@playwright/test";
import {
  attachRuntimeGuards,
  assertCleanRuntime,
  waitForAuthReady,
} from "./helpers";

test.describe("Login form", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("labels, same-origin login fetch, password toggle, no role fields", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    const loginApiCalls: string[] = [];
    const directBackend: string[] = [];

    page.on("request", (req) => {
      const url = req.url();
      if (/:3001\//.test(url) || /localhost:3001/.test(url)) {
        directBackend.push(url);
      }
      if (req.method() === "POST" && /\/api\/auth\/login(?:\?|$)/.test(url)) {
        loginApiCalls.push(url);
      }
    });

    await page.goto("/dang-nhap", { waitUntil: "networkidle" });
    await waitForAuthReady(page);
    await expect(page.locator("h1")).toHaveText("Đăng nhập");

    const email = page.getByLabel("Email");
    const password = page.getByLabel("Mật khẩu", { exact: true });
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();

    // No role/status form fields for privilege elevation
    await expect(page.locator('input[name="role"]')).toHaveCount(0);
    await expect(page.locator('select[name="role"]')).toHaveCount(0);
    await expect(page.locator('input[name="status"]')).toHaveCount(0);

    await email.fill("user@example.com");
    await password.fill("secret-not-logged");

    // Password show/hide preserves value and focus
    const toggle = page.getByRole("button", { name: /Hiện mật khẩu|Ẩn mật khẩu/i });
    await expect(password).toHaveAttribute("type", "password");
    await toggle.click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("secret-not-logged");
    await expect(toggle).toBeFocused();
    await toggle.click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue("secret-not-logged");

    // Submit must call same-origin /api/auth/login (not :3001 directly)
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect
      .poll(() => loginApiCalls.length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    expect(
      loginApiCalls.every((u) => /\/api\/auth\/login/.test(u)),
      "login must call /api/auth/login",
    ).toBeTruthy();
    expect(directBackend, "login must not call :3001 directly").toEqual([]);

    // Wrong/unknown credentials → generic error, no fake success
    // (filter: Next.js also mounts a route announcer with role=alert)
    await expect(
      page.getByRole("alert").filter({ hasText: /Email hoặc mật khẩu không đúng/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/đăng nhập thành công|welcome back/i),
    ).toHaveCount(0);
    await expect(page.getByTestId("header-login")).toBeVisible();

    assertCleanRuntime(issues, "login");

    // Password must not appear in console
    const consoleDump = issues.consoleErrors.join("\n");
    expect(consoleDump).not.toContain("secret-not-logged");
  });
});
