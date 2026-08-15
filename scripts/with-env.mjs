/**
 * Runs a command with the monorepo-root `.env` loaded into its environment.
 *
 * The Prisma CLI resolves `.env` from its own working directory, which is
 * `apps/api` for every workspace-filtered script. The root file the README
 * tells you to create is therefore invisible to it, and `pnpm db:migrate`
 * failed with "Environment variable not found: DATABASE_URL" on a setup that
 * followed the documentation exactly. The API server and the seed script both
 * load the root file themselves, so only the CLI steps were affected.
 *
 * This is the POSIX-and-Windows counterpart to `with-env.ps1`, which already
 * does the same thing for the PowerShell database scripts.
 *
 * Usage: node ./scripts/with-env.mjs <command> [...args]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

/**
 * A real shell environment wins over the file, matching dotenv's default and
 * the loader in main.ts: CI exports DATABASE_URL directly and must keep it.
 */
function loadRootEnv() {
  const envPath = path.join(root, ".env");
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

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("with-env: no command given");
  process.exit(2);
}

loadRootEnv();

/**
 * Prefer pnpm's JS entry point. Spawning `pnpm` by name on Windows resolves to
 * a `.cmd` shim, which fails with EINVAL unless a shell is involved — the same
 * reason scripts/prepare.mjs takes this route.
 */
function resolvePnpmEntry() {
  try {
    return require.resolve("pnpm/bin/pnpm.cjs");
  } catch {
    return null;
  }
}

const pnpmEntry = command === "pnpm" ? resolvePnpmEntry() : null;
const result = pnpmEntry
  ? spawnSync(process.execPath, [pnpmEntry, ...args], {
      cwd: root,
      stdio: "inherit",
      shell: false,
    })
  : spawnSync(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

if (result.error) {
  console.error(`with-env: could not run ${command}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
