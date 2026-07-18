/**
 * Delete users created by auth e2e (email contains @auth-ui-<suffix>.test).
 * Usage: node e2e/cleanup-auth-users.mjs <suffix>
 * Loads DATABASE_URL from monorepo-root .env when missing.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const suffix = process.argv[2];
if (!suffix) {
  console.error("usage: node cleanup-auth-users.mjs <suffix>");
  process.exit(2);
}

const webDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webDir, "../../..");
const envPath = path.join(repoRoot, ".env");
if (existsSync(envPath) && !process.env.DATABASE_URL) {
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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const require = createRequire(
  path.join(repoRoot, "apps/api/package.json"),
);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const marker = `@auth-ui-${suffix}.test`;

try {
  const result = await prisma.user.deleteMany({
    where: { email: { contains: marker } },
  });
  console.log(`cleanup: deleted ${result.count} users matching ${marker}`);
} finally {
  await prisma.$disconnect();
}
