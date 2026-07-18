import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import {
  attachRuntimeGuards,
  assertCleanRuntime,
  assertNoHorizontalOverflow,
  VIEWPORTS,
  waitForAuthReady,
} from "./helpers";

const RUN_SUFFIX = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const PASSWORD = "test-pass-99";

function email(name: string): string {
  return `${name}@auth-ui-${RUN_SUFFIX}.test`;
}

function cleanupUsers() {
  execFileSync(
    process.execPath,
    [path.join(process.cwd(), "e2e/cleanup-auth-users.mjs"), RUN_SUFFIX],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    },
  );
}

async function registerViaUi(
  page: import("@playwright/test").Page,
  userEmail: string,
  displayName?: string,
) {
  await page.goto("/dang-ky", { waitUntil: "networkidle" });
  await waitForAuthReady(page);
  if (displayName) {
    await page.getByLabel(/Tên hiển thị/i).fill(displayName);
  }
  await page.getByLabel("Email").fill(userEmail);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(page.getByTestId("header-logout")).toBeVisible({
    timeout: 15_000,
  });
}

test.describe.configure({ mode: "serial" });

test.describe("Auth flows", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.afterAll(() => {
    cleanupUsers();
  });

  test("1 register → signed-in UI + same-origin API", async ({ page }) => {
    const issues = attachRuntimeGuards(page);
    const registerCalls: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/api\/auth\/register/.test(req.url())) {
        registerCalls.push(req.url());
      }
    });

    const userEmail = email("reg");
    await registerViaUi(page, userEmail, "Người test");

    await expect
      .poll(() => registerCalls.length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    expect(registerCalls[0]).toMatch(/\/api\/auth\/register/);
    expect(registerCalls[0]).not.toMatch(/:3001/);

    await expect(page.getByTestId("header-logout")).toBeVisible();
    await expect(page.getByTestId("header-user-label")).toContainText(
      /Người test|auth-ui/i,
    );
    await expect(page.getByTestId("register-success")).toBeVisible();
    await expect(page.getByTestId("header-login")).toHaveCount(0);
    assertCleanRuntime(issues, "register");
  });

  test("2 reload restores session via GET /api/auth/me", async ({ page }) => {
    const issues = attachRuntimeGuards(page);
    const meCalls: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "GET" && /\/api\/auth\/me/.test(req.url())) {
        meCalls.push(req.url());
      }
    });

    await registerViaUi(page, email("reload"));

    meCalls.length = 0;
    await page.reload({ waitUntil: "networkidle" });
    await waitForAuthReady(page);

    await expect
      .poll(() => meCalls.some((u) => /\/api\/auth\/me/.test(u)))
      .toBeTruthy();
    await expect(page.getByTestId("header-logout")).toBeVisible();
    await expect(page.getByTestId("header-login")).toHaveCount(0);
    assertCleanRuntime(issues, "reload-session");
  });

  test("3 logout → subsequent /me is 401 and signed-out UI", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    await registerViaUi(page, email("logout"));

    await page.getByTestId("header-logout").click();
    await expect(page.getByTestId("header-login")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("header-logout")).toHaveCount(0);

    const meRes = page.waitForResponse(
      (res) =>
        res.url().includes("/api/auth/me") &&
        res.request().method() === "GET",
    );
    await page.reload({ waitUntil: "networkidle" });
    const res = await meRes;
    expect(res.status()).toBe(401);
    await waitForAuthReady(page);
    await expect(page.getByTestId("header-login")).toBeVisible();
    assertCleanRuntime(issues, "logout");
  });

  test("4 wrong password → one generic error, still signed out", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    const userEmail = email("wrongpw");
    await registerViaUi(page, userEmail);
    await page.getByTestId("header-logout").click();
    await expect(page.getByTestId("header-login")).toBeVisible();

    await page.goto("/dang-nhap", { waitUntil: "networkidle" });
    await waitForAuthReady(page);
    await page.getByLabel("Email").fill(userEmail);
    await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong-password-xx");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: /Email hoặc mật khẩu không đúng/i }),
    ).toBeVisible();
    await expect(page.getByText(/đăng nhập thành công/i)).toHaveCount(0);
    await expect(page.getByTestId("header-login")).toBeVisible();
    await expect(page.getByTestId("header-logout")).toHaveCount(0);
    assertCleanRuntime(issues, "wrong-password");
  });

  test("5 duplicate email → readable field-level 409 message", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page, { allowConflict: true });
    const userEmail = email("dupe");
    await registerViaUi(page, userEmail);
    await page.getByTestId("header-logout").click();
    await expect(page.getByTestId("header-login")).toBeVisible();

    await page.goto("/dang-ky", { waitUntil: "networkidle" });
    await waitForAuthReady(page);
    await page.getByLabel("Email").fill(userEmail);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Đăng ký", exact: true }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: /đã được đăng ký/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/stack|Prisma|ECONNREFUSED|\{"error"/i),
    ).toHaveCount(0);
    await expect(page.getByTestId("header-login")).toBeVisible();
    assertCleanRuntime(issues, "duplicate-email");
  });

  test("6 client-side validation matches shared schema", async ({ page }) => {
    const issues = attachRuntimeGuards(page);
    await page.goto("/dang-ky", { waitUntil: "networkidle" });
    await waitForAuthReady(page);

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Đăng ký", exact: true }).click();

    await expect(
      page.getByText(/Email không hợp lệ/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/ít nhất 8 ký tự/i).first(),
    ).toBeVisible();

    await page.getByLabel("Email").fill(email("ok"));
    await page.getByLabel("Mật khẩu", { exact: true }).fill("longenough");
    // Native maxLength=80 matches the schema ceiling; also force-set 81 chars
    // so Zod field validation is exercised (fill() is capped by maxLength).
    const display = page.getByLabel(/Tên hiển thị/i);
    await expect(display).toHaveAttribute("maxLength", "80");
    await display.evaluate((el, value) => {
      const input = el as HTMLInputElement;
      input.removeAttribute("maxLength");
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, "x".repeat(81));
    await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
    await expect(page.getByText(/tối đa 80/i).first()).toBeVisible();

    await page.goto("/dang-nhap", { waitUntil: "networkidle" });
    await waitForAuthReady(page);
    await page.getByLabel("Email").fill("bad");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /Email|mật khẩu|Mật khẩu/i }).first(),
    ).toBeVisible();

    assertCleanRuntime(issues, "client-validation");
  });

  test("7 no session: /me 401, no authenticated flash, signed-out chrome", async ({
    page,
  }) => {
    const issues = attachRuntimeGuards(page);
    await page.context().clearCookies();

    const mePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/auth/me") &&
        res.request().method() === "GET",
      { timeout: 20_000 },
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const meRes = await mePromise;
    expect(meRes.status()).toBe(401);

    await expect(page.getByTestId("header-logout")).toHaveCount(0);
    await waitForAuthReady(page);
    await expect(page.getByTestId("header-login")).toBeVisible();
    await expect(page.getByTestId("header-user-label")).toHaveCount(0);

    // Auth pages remain usable while signed out (login route is the destination for 401 mid-session).
    await page.goto("/dang-nhap", { waitUntil: "networkidle" });
    await waitForAuthReady(page);
    await expect(page).toHaveURL(/\/dang-nhap/);
    await expect(page.getByTestId("header-login")).toBeVisible();
    await expect(page.getByTestId("header-logout")).toHaveCount(0);
    assertCleanRuntime(issues, "no-session");
  });

  test("8 no horizontal overflow on auth pages at all viewports", async ({
    page,
  }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const pathName of ["/dang-ky", "/dang-nhap"]) {
        await page.goto(pathName, { waitUntil: "networkidle" });
        await waitForAuthReady(page);
        await assertNoHorizontalOverflow(page);
      }
    }
  });

  test("9 axe: zero serious/critical on /dang-ky and /dang-nhap", async ({
    page,
  }) => {
    for (const pathName of ["/dang-ky", "/dang-nhap"]) {
      await page.goto(pathName, { waitUntil: "networkidle" });
      await waitForAuthReady(page);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(
        serious,
        `${pathName} axe: ${JSON.stringify(
          serious.map((v) => ({ id: v.id, help: v.help })),
        )}`,
      ).toEqual([]);
    }
  });
});
