import { z } from "zod"

/**
 * Validates the editable subset of `public.sellers` columns exposed on the
 * seller profile page: display_name, tagline, avatar_url, skills, languages,
 * portfolio_urls, response_time_hrs.
 */
export const sellerProfileSchema = z.object({
  display_name: z.string().trim().min(2, "At least 2 characters").max(80, "Keep it under 80 characters"),
  tagline: z.string().trim().max(140, "Keep it under 140 characters").optional(),
  avatar_url: z
    .union([z.string().trim().url("Must be a valid URL"), z.literal("")])
    .optional(),
  skills: z.array(z.string().trim().min(1)).max(20, "Up to 20 skills"),
  languages: z.array(z.string().trim().min(1)).max(10, "Up to 10 languages"),
  portfolio_urls: z.array(z.string().trim().url("Must be a valid URL")).max(10, "Up to 10 links"),
  response_time_hrs: z
    .number()
    .finite("Enter a valid number")
    .int("Whole numbers only")
    .min(1, "Minimum 1 hour")
    .max(168, "Max 168 hours (1 week)"),
})

export type SellerProfileValues = z.infer<typeof sellerProfileSchema>

export const RESPONSE_TIME_OPTIONS_HRS = [1, 2, 4, 8, 12, 24, 48, 72] as const
