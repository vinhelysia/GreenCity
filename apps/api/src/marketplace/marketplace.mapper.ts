import type {
  MediaAsset,
  MarketplaceListing as MarketplaceListingRow,
  Quote,
  ScrapCategory,
  ScrapRequest,
  Subscription,
} from '@prisma/client';
import type {
  MarketplaceListing,
  MediaAssetPublic,
  Quote as QuoteDto,
  ScrapCategory as ScrapCategoryDto,
  ScrapRequestDto,
  Subscription as SubscriptionDto,
} from '@greencity/shared';

export function toCategoryDto(category: ScrapCategory): ScrapCategoryDto {
  return {
    id: category.id,
    name: category.name,
    minPricePerKgVnd: category.minPricePerKgVnd,
    maxPricePerKgVnd: category.maxPricePerKgVnd,
    active: category.active,
  };
}

export function toMediaPublicDto(media: MediaAsset): MediaAssetPublic {
  return {
    id: media.id,
    ownerId: media.ownerId,
    contentType: media.contentType,
    byteSize: media.byteSize,
    width: media.width,
    height: media.height,
    createdAt: media.createdAt.toISOString(),
    downloadPath: `/media/${media.id}/content`,
  };
}

export function toQuoteDto(quote: Quote): QuoteDto {
  return {
    id: quote.id,
    scrapRequestId: quote.scrapRequestId,
    pricePerKgVnd: quote.pricePerKgVnd,
    status: quote.status,
    createdAt: quote.createdAt.toISOString(),
    acceptedAt: quote.acceptedAt ? quote.acceptedAt.toISOString() : null,
  };
}

export function toScrapRequestDto(
  request: ScrapRequest & {
    category: ScrapCategory;
    media: MediaAsset;
    quotes: Quote[];
  },
): ScrapRequestDto {
  return {
    id: request.id,
    sellerId: request.sellerId,
    category: toCategoryDto(request.category),
    estimatedWeightKg: request.estimatedWeightKg,
    media: toMediaPublicDto(request.media),
    note: request.note,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    activeQuote: request.quotes[0] ? toQuoteDto(request.quotes[0]) : null,
  };
}

/**
 * Buyer-facing listing DTO. mediaDownloadPath always points at the
 * marketplace-specific photo route (never /media/:id/content) — that route's
 * visibility follows listing state, not asset ownership.
 */
export function toListingDto(
  listing: MarketplaceListingRow,
  viewerId: string | null,
): MarketplaceListing {
  return {
    id: listing.id,
    categoryName: listing.categoryName,
    estimatedWeightKg: listing.estimatedWeightKg,
    buyerPricePerKgVnd: listing.buyerPricePerKgVnd,
    estimatedTotalVnd: Math.round(
      listing.buyerPricePerKgVnd * listing.estimatedWeightKg,
    ),
    status: listing.status,
    mediaDownloadPath: `/marketplace/listings/${listing.id}/photo`,
    isOwn: viewerId !== null && viewerId === listing.sellerId,
    createdAt: listing.createdAt.toISOString(),
  };
}

export function toSubscriptionDto(subscription: Subscription): SubscriptionDto {
  return {
    id: subscription.id,
    userId: subscription.userId,
    status: subscription.status,
    startsAt: subscription.startsAt.toISOString(),
    expiresAt: subscription.expiresAt.toISOString(),
    note: subscription.note,
  };
}
