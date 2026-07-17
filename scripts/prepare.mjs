/**
 * Runs after pnpm install so lint/typecheck/build work without extra manual steps.
 * - Builds @greencity/shared
 * - prisma generate (does NOT need a live database)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args, env = {}) {
  const r = spawnSync(pnpmCmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
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

run(["--filter", "@greencity/shared", "build"]);
run(["--filter", "api", "exec", "prisma", "generate"], {
  DATABASE_URL: genUrl,
});
