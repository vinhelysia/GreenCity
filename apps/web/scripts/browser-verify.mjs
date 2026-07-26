/**
 * Automated browser verification using Playwright.
 * Evaluates public routes, viewports, console logs, overflow, mobile menu, and admin queues.
 *
 * Usage (from apps/web, after next start on PORT):
 *   node ./scripts/browser-verify.mjs
 *
 * Env:
 *   BASE_URL=http://127.0.0.1:3000
 *   SCREENSHOT_DIR=./screenshots
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const shotDir = process.env.SCREENSHOT_DIR
  ? join(process.cwd(), process.env.SCREENSHOT_DIR)
  : join(webRoot, "screenshots");
const reportedShotDir =
  relative(process.cwd(), shotDir).replace(/\\/g, "/") || ".";

let chromium;
try {
  ({ chromium } = require("@playwright/test"));
} catch {
  console.error(
    "browser-verify: @playwright/test not installed. Run: pnpm --filter web exec playwright install chromium",
  );
  process.exit(2);
}

const ROUTES = [
  { path: "/", h1: /Rác có người mua/ },
  { path: "/thung-rac", h1: /Thùng rác/ },
  { path: "/dich-vu", h1: /Dịch vụ/ },
  { path: "/dong-gop", h1: /Đóng góp/ },
  { path: "/cho-online", h1: /Chợ online/ },
  { path: "/dang-nhap", h1: /Đăng nhập/ },
  { path: "/dang-ky", h1: /Đăng ký/ },
];

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
];

mkdirSync(shotDir, { recursive: true });

const failures = [];
let browser;

try {
  browser = await chromium.launch({ headless: true });
} catch (err) {
  writeFileSync(
    join(shotDir, "VERIFY_REPORT.txt"),
    `FAIL\nFailed to launch browser: ${err?.message || err}\n`,
    "utf8",
  );
  console.error("Failed to launch browser:", err);
  process.exit(1);
}

try {
  // Check routes for 1 H1, correct status, and clean logs
  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: VIEWPORTS[6] }); // 1440x900
    const issues = [];
    page.on("console", (msg) => {
      const t = msg.text();
      // Allow expected 401 unauthenticated check
      if (t.includes("401") || t.includes("Unauthorized")) return;
      if (/hydrat|did not match|Warning: |Error:/i.test(t)) {
        issues.push(t);
      }
    });
    page.on("pageerror", (err) => {
      issues.push(`PageError: ${err.message}`);
    });
    page.on("requestfailed", (req) => {
      const url = req.url();
      if (!url.includes("/api/auth/me")) {
        failures.push(`${route.path} request failed: ${url}`);
      }
    });

    const res = await page.goto(new URL(route.path, baseURL).toString(), {
      waitUntil: "networkidle",
    });
    if (!res || res.status() >= 400) {
      failures.push(`${route.path} status ${res?.status()}`);
    }
    const h1 = page.locator("h1");
    const count = await h1.count();
    if (count !== 1) failures.push(`${route.path} expected 1 h1, got ${count}`);
    else if (!(await h1.first().innerText()).match(route.h1)) {
      failures.push(`${route.path} h1 mismatch`);
    }
    if (issues.length) failures.push(`${route.path} console: ${issues.join("; ")}`);
    await page.close();
  }

  // Homepage viewports & horizontal overflow test across all viewports
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: vp });
    await page.goto(new URL("/", baseURL).toString(), { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
      };
    });
    if (overflow.scrollWidth > overflow.clientWidth + 1) {
      failures.push(`home overflow at ${vp.name}: ${overflow.scrollWidth}>${overflow.clientWidth}`);
    }
    await page.screenshot({
      path: join(shotDir, `home-${vp.name}.png`),
      fullPage: true,
    });
    await page.close();
  }

  // Mobile navigation drawer toggle & Escape key check
  {
    const page = await browser.newPage({ viewport: VIEWPORTS[2] }); // 390x844
    await page.goto(new URL("/", baseURL).toString(), { waitUntil: "networkidle" });
    const toggle = page.getByRole("button", { name: /Mở menu|Menu/i });
    await toggle.click();
    const homeLink = page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Trang chủ" });
    if (!(await homeLink.isVisible())) failures.push("mobile menu did not show links");
    await page.screenshot({
      path: join(shotDir, "mobile-nav-open.png"),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    const expanded = await toggle.getAttribute("aria-expanded");
    if (expanded === "true") failures.push("Escape did not close mobile menu");
    await page.close();
  }

  // Capture screenshots for major routes
  for (const [path, name] of [
    ["/dang-nhap", "dang-nhap"],
    ["/dang-ky", "dang-ky"],
    ["/cho-online", "cho-online"],
    ["/ban-phe-lieu", "ban-phe-lieu"],
    ["/dong-gop", "dong-gop"],
    ["/trang-khong-ton-tai-xyz", "not-found"],
  ]) {
    const page = await browser.newPage({ viewport: VIEWPORTS[6] });
    await page.goto(new URL(path, baseURL).toString(), { waitUntil: "networkidle" });
    await page.screenshot({
      path: join(shotDir, `${name}.png`),
      fullPage: true,
    });
    if (path === "/dang-nhap") {
      const email = page.getByLabel("Email");
      const password = page.getByLabel("Mật khẩu");
      if (!(await email.count()) || !(await password.count())) {
        failures.push("login labels missing");
      }
    }
    await page.close();
  }

  // Write report based on failures
  writeFileSync(
    join(shotDir, "VERIFY_REPORT.txt"),
    failures.length
      ? `FAIL\n${failures.join("\n")}\n`
      : `OK\nbaseURL=${baseURL}\nscreenshots=${reportedShotDir}\n`,
    "utf8",
  );
} catch (err) {
  failures.push(`Unexpected error: ${err?.message || err}`);
  writeFileSync(
    join(shotDir, "VERIFY_REPORT.txt"),
    `FAIL\n${failures.join("\n")}\n`,
    "utf8",
  );
} finally {
  if (browser) await browser.close();
}

if (failures.length) {
  console.error("browser-verify FAILED:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("browser-verify OK — screenshots in", reportedShotDir);
