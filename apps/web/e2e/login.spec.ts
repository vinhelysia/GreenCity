import { test, expect } from "@playwright/test";
import {
  attachRuntimeGuards,
  assertCleanRuntime,
} from "./helpers";

test.describe("Login visual shell", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("labels, pending message, no network submit, password toggle", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    const apiish: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      // Any non-document request to /api/* or backend ports is unexpected here.
      if (/\/api\//.test(url) || /:3001\//.test(url)) {
        apiish.push(url);
      }
    });

    await page.goto("/dang-nhap", { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toHaveText("Đăng nhập");

    const email = page.getByLabel("Email");
    const password = page.getByLabel("Mật khẩu");
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();

    // Pending-backend message visible before submit
    await expect(
      page.getByText(/Chưa gửi yêu cầu tới máy chủ|xác thực backend/i),
    ).toBeVisible();

    // No role/status form fields for privilege elevation
    await expect(page.locator('input[name="role"]')).toHaveCount(0);
    await expect(page.locator('select[name="role"]')).toHaveCount(0);
    await expect(page.locator('input[name="status"]')).toHaveCount(0);

    await email.fill("user@example.com");
    await password.fill("secret-not-logged");

    // Password show/hide preserves value
    const toggle = page.getByRole("button", { name: /Hiện mật khẩu|Ẩn mật khẩu/i });
    await expect(password).toHaveAttribute("type", "password");
    await toggle.click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("secret-not-logged");
    await expect(toggle).toBeFocused();
    await toggle.click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue("secret-not-logged");

    // Submit must not hit network APIs; should update status message
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(
      page.getByRole("status"),
    ).toContainText(/Đăng nhập chưa khả dụng|hợp đồng API/i);

    // No fake success
    await expect(page.getByText(/đăng nhập thành công|welcome back/i)).toHaveCount(
      0,
    );

    expect(apiish, "login must not call /api or :3001").toEqual([]);
    assertCleanRuntime(issues, "login");

    // Password must not appear in console
    const consoleDump = issues.consoleErrors.join("\n");
    expect(consoleDump).not.toContain("secret-not-logged");
  });
});
