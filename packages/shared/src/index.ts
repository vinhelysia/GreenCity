import { z } from "zod";

/** Shared health response (API + clients). */
export const HealthStatusSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  service: z.string(),
  timestamp: z.string(),
  checks: z
    .object({
      database: z.enum(["up", "down"]).optional(),
      postgis: z.enum(["up", "down"]).optional(),
    })
    .optional(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

/** Standard API error body. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const APP_NAME = "GreenCity" as const;

/** Cookie name for opaque session token (HttpOnly). */
export const SESSION_COOKIE_NAME = "gc_session" as const;

// ─── Identity enums (mirror Prisma; clients must not set privileged roles) ───

export const UserRoleSchema = z.enum(["USER", "ADMIN", "CLEANUP_PARTNER"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(["ACTIVE", "DISABLED", "PENDING"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const USER_ROLES = UserRoleSchema.options;
export const PRIVILEGED_ROLES = ["ADMIN", "CLEANUP_PARTNER"] as const satisfies readonly UserRole[];

// ─── Auth contracts ──────────────────────────────────────────────────────────

export const RegisterRequestSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(32)
    .regex(/^\+?[0-9\s-]+$/)
    .optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const PublicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  phone: z.string().nullable(),
  roles: z.array(UserRoleSchema),
  status: UserStatusSchema,
  createdAt: z.string(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const AuthMeResponseSchema = z.object({
  user: PublicUserSchema,
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;

export const AuthSessionResponseSchema = z.object({
  user: PublicUserSchema,
});
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;

// ─── Location contracts ──────────────────────────────────────────────────────

/** Exact location — owner/admin only; never serialize as public. */
export const LocationExactSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  label: z.string().nullable(),
  addressLine: z.string().nullable(),
  ward: z.string().nullable(),
  district: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LocationExactDto = z.infer<typeof LocationExactSchema>;

/** Public/coarse location — no street address, no exact coordinates. */
export const LocationPublicSchema = z.object({
  id: z.string(),
  approxLatitude: z.number(),
  approxLongitude: z.number(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  ward: z.string().nullable(),
  gridCell: z.string().nullable(),
});
export type LocationPublicDto = z.infer<typeof LocationPublicSchema>;

export const CreateLocationRequestSchema = z.object({
  label: z.string().trim().max(120).optional(),
  addressLine: z.string().trim().max(240).optional(),
  ward: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(2).default("VN"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type CreateLocationRequest = z.infer<typeof CreateLocationRequestSchema>;

// ─── Media contracts ─────────────────────────────────────────────────────────

export const MediaAssetPublicSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  contentType: z.string(),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  createdAt: z.string(),
  /** Application download path only — never file:// or absolute FS paths. */
  downloadPath: z.string(),
});
export type MediaAssetPublic = z.infer<typeof MediaAssetPublicSchema>;

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_MAX_DIMENSION = 4096;

// ─── Marketplace: published price list ───────────────────────────────────────

/**
 * Public price band for one material. GreenCity publishes the range up front so
 * a seller knows roughly what they will be paid before submitting anything, and
 * an admin quote must land inside it (server-enforced —
 * QUOTE_OUT_OF_PUBLISHED_RANGE). That turns "transparent pricing" from a claim
 * into a constraint.
 *
 * Invariant: minPricePerKgVnd <= maxPricePerKgVnd.
 *
 * Everything in this slice is priced per kilogram, so there is deliberately no
 * `unit` field. Per-item pricing later is a real change that deserves its own
 * migration rather than a default that quietly means "kg".
 */
export const ScrapCategorySchema = z.object({
  id: z.string(),
  /** Display name, e.g. "Chai nhựa PET". */
  name: z.string(),
  minPricePerKgVnd: z.number().int().positive(),
  maxPricePerKgVnd: z.number().int().positive(),
  active: z.boolean(),
});
export type ScrapCategory = z.infer<typeof ScrapCategorySchema>;

// ─── Marketplace: scrap request ──────────────────────────────────────────────

export const ScrapRequestStatusSchema = z.enum([
  "SUBMITTED",
  "QUOTED",
  "ACCEPTED",
  "REJECTED",
]);
export type ScrapRequestStatus = z.infer<typeof ScrapRequestStatusSchema>;

/**
 * Seller submits scrap for quotation. Status is assigned by the server and is
 * never accepted from a client, in line with the role/status rule on register.
 */
export const CreateScrapRequestSchema = z.object({
  categoryId: z.string().min(1),
  estimatedWeightKg: z.number().positive().max(1000),
  /**
   * Exactly one photo, required. It must already belong to the submitting
   * seller — a foreign asset id is rejected as MEDIA_NOT_OWNED, reported as 404
   * so the response does not confirm that the asset exists.
   */
  mediaAssetId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});
export type CreateScrapRequest = z.infer<typeof CreateScrapRequestSchema>;

// ─── Marketplace: quote ──────────────────────────────────────────────────────

/**
 * SUPERSEDED marks a quote replaced by a newer one on the same request. Quotes
 * are kept rather than overwritten so the price history stays auditable.
 */
export const QuoteStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
]);
export type QuoteStatus = z.infer<typeof QuoteStatusSchema>;

export const QuoteSchema = z.object({
  id: z.string(),
  scrapRequestId: z.string(),
  /** What GreenCity pays the seller per kg. Must sit inside the category band. */
  pricePerKgVnd: z.number().int().positive(),
  status: QuoteStatusSchema,
  createdAt: z.string(),
  acceptedAt: z.string().nullable(),
});
export type Quote = z.infer<typeof QuoteSchema>;

/** ADMIN only. The scrap request is identified by the route, not the body. */
export const CreateQuoteRequestSchema = z.object({
  pricePerKgVnd: z.number().int().positive(),
});
export type CreateQuoteRequest = z.infer<typeof CreateQuoteRequestSchema>;

/** Seller's own view of a request, including the quote awaiting their decision. */
export const ScrapRequestSchema = z.object({
  id: z.string(),
  sellerId: z.string(),
  category: ScrapCategorySchema,
  estimatedWeightKg: z.number().positive(),
  media: MediaAssetPublicSchema,
  note: z.string().nullable(),
  status: ScrapRequestStatusSchema,
  createdAt: z.string(),
  /** Latest non-superseded quote, or null before the first quote. */
  activeQuote: QuoteSchema.nullable(),
});
export type ScrapRequestDto = z.infer<typeof ScrapRequestSchema>;

export const ScrapRequestListSchema = z.object({
  requests: z.array(ScrapRequestSchema),
});
export type ScrapRequestList = z.infer<typeof ScrapRequestListSchema>;

// ─── Marketplace: listing ────────────────────────────────────────────────────

export const ListingStatusSchema = z.enum([
  "AVAILABLE",
  "RESERVED",
  "COMPLETED",
  "CANCELLED",
]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

/**
 * Buyer-facing listing.
 *
 * Deliberately omits sellerId, any seller contact detail, and any exact
 * location: a subscribed buyer browsing the market must not be able to identify
 * or contact the seller and settle off-platform. The row itself stores both the
 * seller-side and buyer-side price for accounting; only the buyer-side price is
 * ever serialized here.
 *
 * `isOwn` exists so the UI can hide the reserve action on a seller's own
 * listing. The server still rejects the attempt
 * (CANNOT_RESERVE_OWN_LISTING) — this only avoids offering an action that is
 * guaranteed to fail.
 */
export const MarketplaceListingSchema = z.object({
  id: z.string(),
  categoryName: z.string(),
  estimatedWeightKg: z.number().positive(),
  /** What the buyer pays per kg, snapshot taken when the listing was created. */
  buyerPricePerKgVnd: z.number().int().positive(),
  /** buyerPricePerKgVnd * estimatedWeightKg, rounded. Derived, never stored. */
  estimatedTotalVnd: z.number().int().nonnegative(),
  status: ListingStatusSchema,
  mediaDownloadPath: z.string(),
  isOwn: z.boolean(),
  createdAt: z.string(),
});
export type MarketplaceListing = z.infer<typeof MarketplaceListingSchema>;

export const MarketplaceListingListSchema = z.object({
  listings: z.array(MarketplaceListingSchema),
});
export type MarketplaceListingList = z.infer<typeof MarketplaceListingListSchema>;

// ─── Marketplace: reservation ────────────────────────────────────────────────

/**
 * At most one reservation per listing, enforced by a unique constraint on
 * listingId as well as by the conditional status update. Two buyers racing on
 * the same listing produce exactly one 201 and one 409 LISTING_NOT_AVAILABLE.
 */
export const ReservationSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  buyerId: z.string(),
  createdAt: z.string(),
});
export type Reservation = z.infer<typeof ReservationSchema>;

// ─── Marketplace: subscription gate ──────────────────────────────────────────

export const SubscriptionStatusSchema = z.enum([
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

/**
 * Eligibility to reserve a listing. Buyer is NOT a role — roles stay
 * USER/ADMIN/CLEANUP_PARTNER and this entity gates the behaviour instead.
 *
 * Carries no billing concepts on purpose: no plan tier, price, invoice, renewal
 * date or provider reference. Rows are seeded or created by an admin; there is
 * no self-serve purchase flow in this slice.
 *
 * Eligible means status is ACTIVE and startsAt <= now < expiresAt. Several rows
 * per user are allowed so history survives, and overlapping active rows are
 * harmless because eligibility is a query rather than a stored flag.
 */
export const SubscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: SubscriptionStatusSchema,
  startsAt: z.string(),
  expiresAt: z.string(),
  /** Demo labelling, e.g. "Demo subscription — no real payment processed". */
  note: z.string().nullable(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

/** Drives whether the UI offers the reserve action at all. */
export const SubscriptionStateSchema = z.object({
  eligible: z.boolean(),
  subscription: SubscriptionSchema.nullable(),
});
export type SubscriptionState = z.infer<typeof SubscriptionStateSchema>;

// ─── Marketplace: error codes ────────────────────────────────────────────────

/**
 * Returned in ApiErrorSchema.error.code. The frontend maps these to Vietnamese
 * messages; never branch on message text, which is free to change.
 */
export const MARKETPLACE_ERROR_CODES = [
  "CATEGORY_NOT_FOUND",
  "SCRAP_REQUEST_NOT_FOUND",
  "SCRAP_REQUEST_NOT_QUOTABLE",
  "MEDIA_NOT_OWNED",
  "QUOTE_NOT_PENDING",
  "QUOTE_OUT_OF_PUBLISHED_RANGE",
  "LISTING_NOT_AVAILABLE",
  "SUBSCRIPTION_REQUIRED",
  "CANNOT_RESERVE_OWN_LISTING",
  // A photo can back only one scrap request (MediaAsset.mediaAssetId is unique
  // at the DB level); resubmitting the same asset returns this.
  "MEDIA_ALREADY_USED",
] as const;
export type MarketplaceErrorCode = (typeof MARKETPLACE_ERROR_CODES)[number];

// ─── Cleanup reports ─────────────────────────────────────────────────────────

export const CleanupReportStatusSchema = z.enum([
  "SUBMITTED",
  "VERIFIED",
  "REJECTED",
]);
export type CleanupReportStatus = z.infer<typeof CleanupReportStatusSchema>;

export const CreateCleanupReportSchema = z.object({
  description: z.string().trim().min(10).max(1000),
  mediaAssetId: z.string().min(1),
  addressLine: z.string().trim().max(240).optional(),
  ward: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
});
export type CreateCleanupReport = z.infer<typeof CreateCleanupReportSchema>;

export const CleanupReportSchema = z.object({
  id: z.string(),
  reporterId: z.string(),
  description: z.string(),
  addressLine: z.string().nullable(),
  ward: z.string().nullable(),
  district: z.string().nullable(),
  city: z.string().nullable(),
  media: MediaAssetPublicSchema,
  status: CleanupReportStatusSchema,
  createdAt: z.string(),
});
export type CleanupReportDto = z.infer<typeof CleanupReportSchema>;

export const CleanupReportListSchema = z.object({
  reports: z.array(CleanupReportSchema),
});
export type CleanupReportList = z.infer<typeof CleanupReportListSchema>;

export const CLEANUP_ERROR_CODES = [
  "CLEANUP_REPORT_NOT_FOUND",
  "CLEANUP_REPORT_NOT_PENDING",
] as const;
export type CleanupErrorCode = (typeof CLEANUP_ERROR_CODES)[number];
