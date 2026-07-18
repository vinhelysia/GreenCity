import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// pnpm --filter web test:e2e runs with cwd = apps/web
const webDir = process.cwd();
const repoRoot = path.resolve(webDir, "../..");

/** Load monorepo-root .env into process.env (does not override existing). */
function loadRootEnv() {
  const envPath = path.join(repoRoot, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadRootEnv();

/**
 * Repository-owned Playwright config for apps/web.
 * Browser binaries are NOT committed — run:
 *   pnpm --filter web exec playwright install chromium
 *
 * Auth E2E needs both Next (3100) and the Nest API (3001). Rate limit is
 * raised only for the test API process — production default stays 10.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "vi-VN",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter api build && pnpm --filter api start",
      cwd: repoRoot,
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...process.env,
        AUTH_LOGIN_RATE_LIMIT: "1000",
        // Playwright serves the web app at 127.0.0.1:3100; Origin must be allowed.
        CORS_ORIGINS:
          "http://localhost:3000,http://127.0.0.1:3100,http://localhost:3100,http://127.0.0.1:3000",
      },
    },
    {
      command: "pnpm exec next start -p 3100",
      cwd: webDir,
      url: "http://127.0.0.1:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
