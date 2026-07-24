/**
 * Idempotent demo seed, safe to re-run: it restores the demo start state
 * (every seeded listing back to AVAILABLE, the seeded cleanup report back to
 * SUBMITTED, seeded reward points cleared) so the pitch can be rehearsed as
 * many times as needed. Resetting is scoped to seed-owned ids — rows a real
 * user created are never touched.
 *
 * The three accounts below share one operator-supplied seed-only password;
 * always set DEMO_PASSWORD when seeding anything shared or deployed.
 *
 * Reuses the real PasswordService (same argon2 params as login), the real
 * image pipeline, and the real object storage service so uploaded demo
 * photos stream exactly like a genuine upload would.
 */
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../src/auth/password.service';
import { extensionForMime, processImageUpload } from '../src/media/image-pipeline';
import { LocalObjectStorage } from '../src/storage/local-object-storage';
import { SupabaseObjectStorage } from '../src/storage/supabase-object-storage';
import type { ObjectStorage } from '../src/storage/storage.types';
import { loadEnv } from '../src/config/env';
import { findRuntimeRoot, repoRootEnvPath, resolveFromRepoRoot } from '../src/config/paths';

const CATEGORIES = [
  { name: 'Chai nhựa PET', minPricePerKgVnd: 1000, maxPricePerKgVnd: 1500 },
  { name: 'Giấy carton', minPricePerKgVnd: 2500, maxPricePerKgVnd: 3500 },
  { name: 'Lon nhôm', minPricePerKgVnd: 15000, maxPricePerKgVnd: 20000 },
  { name: 'Sắt vụn', minPricePerKgVnd: 5000, maxPricePerKgVnd: 7000 },
  { name: 'Chai thủy tinh', minPricePerKgVnd: 500, maxPricePerKgVnd: 1000 },
] as const;

const DEMO_LISTINGS = [
  {
    n: 1,
    categoryName: 'Chai nhựa PET',
    weightKg: 5.5,
    pricePerKgVnd: 1300,
    color: { r: 46, g: 125, b: 50 },
  },
  {
    n: 2,
    categoryName: 'Lon nhôm',
    weightKg: 3,
    pricePerKgVnd: 18000,
    color: { r: 158, g: 158, b: 158 },
  },
  {
    n: 3,
    categoryName: 'Giấy carton',
    weightKg: 12,
    pricePerKgVnd: 3000,
    color: { r: 141, g: 110, b: 99 },
  },
  {
    n: 4,
    categoryName: 'Sắt vụn',
    weightKg: 8,
    pricePerKgVnd: 6000,
    color: { r: 96, g: 125, b: 139 },
  },
] as const;

/// Report 1 stays SUBMITTED so a rehearsal always has one to verify on camera;
/// the rest are VERIFIED so the public feed shows a real cleaned-up history.
/// Each description matches what its photograph actually shows — a caption that
/// disagrees with its image reads as fabricated, which is worse than no photo.
const DEMO_CLEANUPS = [
  {
    n: 1,
    status: 'SUBMITTED',
    description:
      'Bãi rác tự phát ven kênh, đổ tràn ngay dưới biển cấm đổ rác của phường',
    ward: 'Phường Chánh Hưng',
    district: 'Quận 8',
    color: { r: 120, g: 144, b: 156 },
  },
  {
    n: 2,
    status: 'VERIFIED',
    description:
      'Rác thải sinh hoạt và xà bần dồn dọc lối đi bộ ven sông, lấn hết mặt đường',
    ward: 'Phường 22',
    district: 'Quận Bình Thạnh',
    color: { r: 141, g: 110, b: 99 },
  },
  {
    n: 3,
    status: 'VERIFIED',
    description: 'Rác vương vãi hai bên vỉa hè khu dân cư, cạnh lòng đường',
    ward: 'Phường Tân Phú',
    district: 'Thành phố Thủ Đức',
    color: { r: 96, g: 125, b: 139 },
  },
  {
    n: 4,
    status: 'VERIFIED',
    description: 'Túi rác chất đống sát chân tường ven đường trước khu chung cư',
    ward: 'Phường Tân Thới Nhất',
    district: 'Quận 12',
    color: { r: 109, g: 133, b: 116 },
  },
] as const;

const CLEANUP_CITY = 'TP. Hồ Chí Minh';

/**
 * Real photographs live in a gitignored folder (they are third-party press
 * images). When one is present it is used; otherwise the original flat-colour
 * tile is generated, so a fresh clone and CI both still seed successfully.
 */
async function demoPhoto(
  fileName: string,
  fallbackColor: { r: number; g: number; b: number },
): Promise<Buffer> {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), 'seed-assets', fileName);
  if (existsSync(path)) {
    // Downscale here rather than shipping a 2560px original: the API streams
    // these bytes on every card render.
    return sharp(await readFile(path))
      .resize(1280, 960, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 82 })
      .toBuffer();
  }
  return sharp({ create: { width: 64, height: 64, channels: 3, background: fallbackColor } })
    .png()
    .toBuffer();
}

function loadCanonicalEnv(): void {
  const repoRoot = findRuntimeRoot();
  const envPath = repoRootEnvPath(repoRoot);
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath, override: false });
  }
}

async function main() {
  loadCanonicalEnv();
  const env = loadEnv();
  // Local demo default so `pnpm db:seed` runs with zero setup. Override with
  // DEMO_PASSWORD on any shared/deployed database, where a publicly-known
  // password on an ADMIN account would let anyone tamper with the demo mid-pitch.
  const demoPassword = process.env.DEMO_PASSWORD ?? 'GreenCity-Demo-2026';

  // Seed the same object store the API will read from. Local for dev; supabase
  // when seeding a deploy so listing images land in persistent shared storage.
  if (env.STORAGE_DRIVER === 's3') {
    throw new Error('db:seed supports STORAGE_DRIVER=local or supabase (not the s3 stub)');
  }

  const prisma = new PrismaClient();
  const passwords = new PasswordService();
  const storage: ObjectStorage =
    env.STORAGE_DRIVER === 'supabase'
      ? new SupabaseObjectStorage({
          url: env.SUPABASE_URL ?? '',
          serviceKey: env.SUPABASE_SERVICE_KEY ?? '',
          bucket: env.SUPABASE_STORAGE_BUCKET,
        })
      : new LocalObjectStorage(
          resolveFromRepoRoot(env.STORAGE_LOCAL_DIR, findRuntimeRoot()),
        );

  try {
    const passwordHash = await passwords.hash(demoPassword);

    const admin = await prisma.user.upsert({
      where: { email: 'admin@greencity.demo' },
      create: {
        email: 'admin@greencity.demo',
        passwordHash,
        displayName: 'GreenCity Admin',
        roles: ['ADMIN'],
        status: 'ACTIVE',
      },
      update: { passwordHash, roles: ['ADMIN'], status: 'ACTIVE' },
    });
    const seller = await prisma.user.upsert({
      where: { email: 'seller@greencity.demo' },
      create: {
        email: 'seller@greencity.demo',
        passwordHash,
        displayName: 'Demo Seller',
        roles: ['USER'],
        status: 'ACTIVE',
      },
      update: { passwordHash, status: 'ACTIVE' },
    });
    const buyer = await prisma.user.upsert({
      where: { email: 'buyer@greencity.demo' },
      create: {
        email: 'buyer@greencity.demo',
        passwordHash,
        displayName: 'Demo Buyer',
        roles: ['USER'],
        status: 'ACTIVE',
      },
      update: { passwordHash, status: 'ACTIVE' },
    });

    const categories = new Map<string, { id: string; name: string }>();
    for (const c of CATEGORIES) {
      const row = await prisma.scrapCategory.upsert({
        where: { name: c.name },
        create: { ...c, active: true },
        update: {
          minPricePerKgVnd: c.minPricePerKgVnd,
          maxPricePerKgVnd: c.maxPricePerKgVnd,
          active: true,
        },
      });
      categories.set(c.name, row);
    }

    const now = new Date();
    const existingSub = await prisma.subscription.findFirst({
      where: {
        userId: buyer.id,
        status: 'ACTIVE',
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
    });
    if (!existingSub) {
      await prisma.subscription.create({
        data: {
          userId: buyer.id,
          status: 'ACTIVE',
          startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          note: 'Demo subscription — no real payment processed',
        },
      });
    }

    // Reset to the demo start state so the pitch can be rehearsed repeatedly:
    // a listing completed during a run-through would otherwise stay COMPLETED
    // and the reward moment could only ever be shown once. Scoped to seed-owned
    // ids by design — anything a real user created is left untouched.
    const seedListingIds = DEMO_LISTINGS.map((d) => `seed-listing-${d.n}`);
    const seedCleanupIds = DEMO_CLEANUPS.map((c) => `seed-cleanup-report-${c.n}`);
    await prisma.pointEntry.deleteMany({
      where: { referenceId: { in: [...seedListingIds, ...seedCleanupIds] } },
    });
    await prisma.reservation.deleteMany({
      where: { listingId: { in: seedListingIds } },
    });

    for (const d of DEMO_LISTINGS) {
      const mediaId = `seed-media-${d.n}`;
      // Always (re)write the file and reconcile the record: the metadata row can
      // survive a wiped storage dir, so gating the write on "record missing"
      // leaves a listing pointing at a file that no longer exists.
      const raw = await sharp({
        create: { width: 64, height: 64, channels: 3, background: d.color },
      })
        .png()
        .toBuffer();
      const processed = await processImageUpload(raw, 'image/png', `demo-${d.n}.png`);
      const objectKey = `media/${seller.id}/${mediaId}.${extensionForMime(processed.contentType)}`;
      await storage.putObject({
        key: objectKey,
        body: processed.buffer,
        contentType: processed.contentType,
      });
      const media = await prisma.mediaAsset.upsert({
        where: { id: mediaId },
        create: {
          id: mediaId,
          ownerId: seller.id,
          objectKey,
          contentType: processed.contentType,
          byteSize: processed.byteSize,
          width: processed.width,
          height: processed.height,
          originalName: `demo-${d.n}.png`,
        },
        update: {
          objectKey,
          contentType: processed.contentType,
          byteSize: processed.byteSize,
          width: processed.width,
          height: processed.height,
        },
      });

      const category = categories.get(d.categoryName);
      if (!category) throw new Error(`Seed category missing: ${d.categoryName}`);

      const scrapRequestId = `seed-scrap-request-${d.n}`;
      await prisma.scrapRequest.upsert({
        where: { id: scrapRequestId },
        create: {
          id: scrapRequestId,
          sellerId: seller.id,
          categoryId: category.id,
          estimatedWeightKg: d.weightKg,
          mediaAssetId: media.id,
          note: 'Seeded demo listing',
          status: 'ACCEPTED',
        },
        update: {},
      });

      const quoteId = `seed-quote-${d.n}`;
      await prisma.quote.upsert({
        where: { id: quoteId },
        create: {
          id: quoteId,
          scrapRequestId,
          pricePerKgVnd: d.pricePerKgVnd,
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
        update: {},
      });

      const listingId = `seed-listing-${d.n}`;
      await prisma.marketplaceListing.upsert({
        where: { id: listingId },
        create: {
          id: listingId,
          quoteId,
          scrapRequestId,
          sellerId: seller.id,
          categoryName: category.name,
          estimatedWeightKg: d.weightKg,
          sellerPricePerKgVnd: d.pricePerKgVnd,
          buyerPricePerKgVnd: d.pricePerKgVnd,
          mediaAssetId: media.id,
          status: 'AVAILABLE',
        },
        // Status is reset (not left alone) so re-seeding restores a sellable
        // marketplace after a rehearsal consumed a listing.
        update: { status: 'AVAILABLE' },
      });
    }

    for (const c of DEMO_CLEANUPS) {
      const mediaId = `seed-cleanup-media-${c.n}`;
      const raw = await demoPhoto(`photo-${c.n}.jpg`, c.color);
      const processed = await processImageUpload(raw, 'image/jpeg', `demo-cleanup-${c.n}.jpg`);
      const objectKey = `media/${buyer.id}/${mediaId}.${extensionForMime(processed.contentType)}`;
      await storage.putObject({
        key: objectKey,
        body: processed.buffer,
        contentType: processed.contentType,
      });
      const media = await prisma.mediaAsset.upsert({
        where: { id: mediaId },
        create: {
          id: mediaId,
          ownerId: buyer.id,
          objectKey,
          contentType: processed.contentType,
          byteSize: processed.byteSize,
          width: processed.width,
          height: processed.height,
          originalName: `demo-cleanup-${c.n}.jpg`,
        },
        update: {
          objectKey,
          contentType: processed.contentType,
          byteSize: processed.byteSize,
          width: processed.width,
          height: processed.height,
        },
      });

      const verifiedAt = c.status === 'VERIFIED' ? new Date() : null;
      await prisma.cleanupReport.upsert({
        where: { id: `seed-cleanup-report-${c.n}` },
        create: {
          id: `seed-cleanup-report-${c.n}`,
          reporterId: buyer.id,
          description: c.description,
          ward: c.ward,
          district: c.district,
          city: CLEANUP_CITY,
          mediaAssetId: media.id,
          status: c.status,
          verifiedAt,
        },
        update: { status: c.status, verifiedAt },
      });
    }

    const submitted = DEMO_CLEANUPS.filter((c) => c.status === 'SUBMITTED').length;
    // eslint-disable-next-line no-console
    console.log(
      `Seeded: admin=${admin.email} seller=${seller.email} buyer=${buyer.email}, ${CATEGORIES.length} categories, ${DEMO_LISTINGS.length} listings (all AVAILABLE), ${DEMO_CLEANUPS.length} cleanup reports (${submitted} SUBMITTED), seed reward points cleared`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
