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
