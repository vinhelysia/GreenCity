/**
 * Delete the full scrap→listing→reservation chain a marketplace e2e run created,
 * plus its throwaway seller (email contains @market-<suffix>.test).
 * Usage: node e2e/cleanup-marketplace.mjs <suffix>
 *
 * MarketplaceListing and Reservation use onDelete: Restrict (deliberate — a
 * stray user delete must not wipe a listing or reservation), so this deletes
 * bottom-up by hand rather than relying on cascade. Seeded accounts
 * (buyer@greencity.demo and its subscription) are never touched.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const suffix = process.argv[2];
if (!suffix) {
  console.error("usage: node cleanup-marketplace.mjs <suffix>");
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

const require = createRequire(path.join(repoRoot, "apps/api/package.json"));
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const marker = `@market-${suffix}.test`;

try {
  const sellers = await prisma.user.findMany({
    where: { email: { contains: marker } },
    select: { id: true },
  });
  const sellerIds = sellers.map((s) => s.id);

  if (sellerIds.length > 0) {
    const listings = await prisma.marketplaceListing.findMany({
      where: { sellerId: { in: sellerIds } },
      select: { id: true },
    });
    const listingIds = listings.map((l) => l.id);

    // Bottom-up: reservation, listing, quote, scrap request, then the seller.
    const res = await prisma.reservation.deleteMany({
      where: { listingId: { in: listingIds } },
    });
    await prisma.marketplaceListing.deleteMany({
      where: { sellerId: { in: sellerIds } },
    });
    await prisma.quote.deleteMany({
      where: { scrapRequest: { sellerId: { in: sellerIds } } },
    });
    await prisma.scrapRequest.deleteMany({
      where: { sellerId: { in: sellerIds } },
    });
    const users = await prisma.user.deleteMany({
      where: { id: { in: sellerIds } },
    });
    console.log(
      `cleanup: ${users.count} sellers, ${listings.length} listings, ${res.count} reservations for ${marker}`,
    );
  } else {
    console.log(`cleanup: nothing matching ${marker}`);
  }
} finally {
  await prisma.$disconnect();
}
