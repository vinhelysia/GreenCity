/**
 * Optional browser verification using Playwright if resolvable.
 * Requires the approved repository-owned @playwright/test dependency.
 *
 * Usage (from apps/web, after next start on PORT):
 *   node ./scripts/browser-verify.mjs
 *
 * Env:
 *   BASE_URL=http://127.0.0.1:3100
 *   SCREENSHOT_DIR=./screenshots
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3100";
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
    "browser-verify: @playwright/test not installed. See FRONTEND_DEPENDENCY_REQUEST.md",
  );
  process.exit(2);
}

const ROUTES = [
  { path: "/", h1: /GreenCity/ },
  { path: "/thung-rac", h1: /Thùng rác/ },
  { path: "/dich-vu", h1: /Dịch vụ/ },
  { path: "/dong-gop", h1: /Đóng góp/ },
  { path: "/cho-online", h1: /Chợ online/ },
  { path: "/dang-nhap", h1: /Đăng nhập/ },
];

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
];

mkdirSync(shotDir, { recursive: true });

const failures = [];
const browser = await chromium.launch({ headless: true });

try {
  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: VIEWPORTS[0] });
    const issues = [];
    page.on("console", (msg) => {
      const t = msg.text();
      if (/hydrat|did not match|Warning: /i.test(t)) issues.push(t);
    });
    page.on("request", (req) => {
      const url = req.url();
      if (/localhost:3001|127\.0\.0\.1:3001/.test(url)) {
        failures.push(`${route.path} requested backend host: ${url}`);
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

  // Homepage viewports + overflow
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

  // Mobile menu open
  {
    const page = await browser.newPage({ viewport: VIEWPORTS[3] });
    await page.goto(new URL("/", baseURL).toString(), { waitUntil: "networkidle" });
    const toggle = page.getByRole("button", { name: /Mở menu|Menu/i });
    await toggle.click();
    await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Tin tức" }).count().catch(() => 0);
    // Ensure a nav link is visible
    const homeLink = page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Trang chủ" });
    if (!(await homeLink.isVisible())) failures.push("mobile menu did not show links");
    await page.screenshot({
      path: join(shotDir, "mobile-nav-open.png"),
      fullPage: true,
    });
    // Keyboard Escape
    await page.keyboard.press("Escape");
    if (await homeLink.isVisible().catch(() => false)) {
      // After close, links may be hidden — check aria-expanded
    }
    const expanded = await toggle.getAttribute("aria-expanded");
    if (expanded === "true") failures.push("Escape did not close mobile menu");
    await page.close();
  }

  // Login + cho-online + not-found
  for (const [path, name] of [
    ["/dang-nhap", "dang-nhap"],
    ["/cho-online", "cho-online"],
    ["/trang-khong-ton-tai-xyz", "not-found"],
  ]) {
    const page = await browser.newPage({ viewport: VIEWPORTS[0] });
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

  // Desktop nav click sample
  {
    const page = await browser.newPage({ viewport: VIEWPORTS[0] });
    await page.goto(new URL("/", baseURL).toString(), { waitUntil: "networkidle" });
    await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Chợ online" }).click();
    await page.waitForURL("**/cho-online");
    await page.close();
  }

  writeFileSync(
    join(shotDir, "VERIFY_REPORT.txt"),
    failures.length
      ? `FAIL\n${failures.join("\n")}\n`
      : `OK\nbaseURL=${baseURL}\nscreenshots=${reportedShotDir}\n`,
    "utf8",
  );
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("browser-verify FAILED:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("browser-verify OK — screenshots in", shotDir);
