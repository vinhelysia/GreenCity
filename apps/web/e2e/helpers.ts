import { expect, type Page, type ConsoleMessage, type Request } from "@playwright/test";

/** Public routes with expected visible h1 text. */
export const ROUTES = [
  { path: "/", h1: "GreenCity — tái chế và làm sạch thành phố" },
  { path: "/thung-rac", h1: "Thùng rác" },
  { path: "/dich-vu", h1: "Dịch vụ" },
  { path: "/dong-gop", h1: "Đóng góp" },
  { path: "/cho-online", h1: "Chợ online" },
  { path: "/dang-nhap", h1: "Đăng nhập" },
] as const;

export const NAV_LINKS = [
  { name: "Trang chủ", href: "/" },
  { name: "Thùng rác", href: "/thung-rac" },
  { name: "Dịch vụ", href: "/dich-vu" },
  { name: "Đóng góp", href: "/dong-gop" },
  { name: "Chợ online", href: "/cho-online" },
] as const;

/** Required viewports for overflow and layout checks. */
export const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
  { name: "320x568", width: 320, height: 568 },
] as const;

const HYDRATION = /hydrat|did not match|Text content does not match/i;
const REACT_WARN = /Warning: /i;

/** Hosts that indicate invented/direct API calls (must not appear from UI). */
const FORBIDDEN_API = /localhost:3001|127\.0\.0\.1:3001|:3001\//;

export type RuntimeIssues = {
  consoleErrors: string[];
  pageErrors: string[];
  hydrationWarnings: string[];
  failedRequests: string[];
  forbiddenApiRequests: string[];
};

/**
 * Attach listeners before navigation. Collects console/page/network problems.
 * Call assertCleanRuntime() after interactions.
 */
export function attachRuntimeGuards(page: Page): RuntimeIssues {
  const issues: RuntimeIssues = {
    consoleErrors: [],
    pageErrors: [],
    hydrationWarnings: [],
    failedRequests: [],
    forbiddenApiRequests: [],
  };

  page.on("console", (msg: ConsoleMessage) => {
    const text = msg.text();
    if (msg.type() === "error") {
      // Chromium logs document 404s as console.error — expected for not-found routes.
      if (/Failed to load resource:.*status of 404/i.test(text)) return;
      issues.consoleErrors.push(text);
    }
    if (HYDRATION.test(text) || (msg.type() === "warning" && REACT_WARN.test(text))) {
      issues.hydrationWarnings.push(text);
    }
  });

  page.on("pageerror", (err) => {
    issues.pageErrors.push(err.message);
  });

  page.on("request", (req: Request) => {
    const url = req.url();
    if (FORBIDDEN_API.test(url)) {
      issues.forbiddenApiRequests.push(url);
    }
  });

  page.on("requestfailed", (req) => {
    const url = req.url();
    // Ignore cancelled navigations / aborts during SPA transitions.
    const failure = req.failure()?.errorText ?? "";
    if (/ERR_ABORTED|net::ERR_ABORTED/i.test(failure)) return;
    // Fonts from Google may fail offline — recorded but asserted only when expected online.
    if (/fonts\.gstatic\.com|fonts\.googleapis\.com/i.test(url)) return;
    issues.failedRequests.push(`${req.method()} ${url} (${failure})`);
  });

  return issues;
}

export function assertCleanRuntime(issues: RuntimeIssues, context: string) {
  expect(issues.consoleErrors, `${context}: console.error`).toEqual([]);
  expect(issues.pageErrors, `${context}: pageerror`).toEqual([]);
  expect(issues.hydrationWarnings, `${context}: hydration`).toEqual([]);
  expect(issues.forbiddenApiRequests, `${context}: forbidden API`).toEqual([]);
  expect(issues.failedRequests, `${context}: failed requests`).toEqual([]);
}

export async function assertNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `horizontal overflow: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`,
  ).toBeLessThanOrEqual(clientWidth);
}

export async function assertOneH1(page: Page, expected?: string | RegExp) {
  const h1 = page.locator("h1");
  await expect(h1).toHaveCount(1);
  await expect(h1).toBeVisible();
  if (expected) {
    await expect(h1).toHaveText(expected);
  }
}

export function mainNav(page: Page) {
  return page.getByRole("navigation", { name: "Điều hướng chính" });
}

/** Primary mobile menu control (not the backdrop dismiss button). */
export function menuToggle(page: Page) {
  return page.locator("button.nav-toggle");
}
