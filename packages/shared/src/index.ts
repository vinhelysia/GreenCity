import { z } from "zod";

/** Shared health response (API + clients). */
export const HealthStatusSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  service: z.string(),
  timestamp: z.string(),
  checks: z
    .object({
      database: z.enum(["up", "down"]).optional(),
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
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const APP_NAME = "GreenCity" as const;
