/**
 * Runs after pnpm install so lint/typecheck/build work without extra manual steps.
 * - Builds @greencity/shared
 * - prisma generate (does NOT need a live database)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function runNodeScript(scriptPath, args, env = {}) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function runPnpm(args, env = {}) {
  // Prefer pnpm CLI JS entry to avoid Windows .cmd spawn EINVAL without shell.
  let pnpmJs;
  try {
    pnpmJs = require.resolve("pnpm/bin/pnpm.cjs");
  } catch {
    pnpmJs = null;
  }
  if (pnpmJs) {
    runNodeScript(pnpmJs, args, env);
    return;
  }
  const r = spawnSync("pnpm", args, {
    cwd: root,
    stdio: "inherit",
    // Windows needs shell for PATH .cmd resolution when package not local
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

const genUrl =
  process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0
    ? process.env.DATABASE_URL
    : "postgresql://generate:generate@127.0.0.1:5432/generate?schema=public";

runPnpm(["--filter", "@greencity/shared", "build"]);
runPnpm(["--filter", "api", "exec", "prisma", "generate"], {
  DATABASE_URL: genUrl,
});
