/**
 * Idempotent local demo seed. Local demo only — never run against a shared or
 * production database; the three accounts below share one operator-supplied
 * seed-only password.
 *
 * Reuses the real PasswordService (same argon2 params as login), the real
 * image pipeline, and the real object storage service so uploaded demo
 * photos stream exactly like a genuine upload would.
 */
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { PasswordService } from '../src/auth/password.service';
import { extensionForMime, processImageUpload } from '../src/media/image-pipeline';
import { LocalObjectStorage } from '../src/storage/local-object-storage';
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
] as const;

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
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('DEMO_PASSWORD must be at least 12 characters for db:seed');
  }

  if (env.STORAGE_DRIVER !== 'local') {
    // ponytail: seed only drives the local filesystem driver; add S3 support
    // if a seeded environment ever needs it.
    throw new Error('db:seed only supports STORAGE_DRIVER=local');
  }

  const prisma = new PrismaClient();
  const passwords = new PasswordService();
  const storage = new LocalObjectStorage(
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

    for (const d of DEMO_LISTINGS) {
      const mediaId = `seed-media-${d.n}`;
      let media = await prisma.mediaAsset.findUnique({ where: { id: mediaId } });
      if (!media) {
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
        media = await prisma.mediaAsset.create({
          data: {
            id: mediaId,
            ownerId: seller.id,
            objectKey,
            contentType: processed.contentType,
            byteSize: processed.byteSize,
            width: processed.width,
            height: processed.height,
            originalName: `demo-${d.n}.png`,
          },
        });
      }

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
        update: {},
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      `Seeded: admin=${admin.email} seller=${seller.email} buyer=${buyer.email}, ${CATEGORIES.length} categories, ${DEMO_LISTINGS.length} listings`,
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
