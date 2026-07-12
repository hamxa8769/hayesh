import { z } from "zod"

/**
 * Real gig categories shown in Step 1 of the gig creation wizard.
 * These are display strings only — `gigs.category` is a free-text column,
 * so no enum exists in the schema to import from.
 */
export const GIG_CATEGORIES = [
  "Programming & Tech",
  "Design",
  "Writing & Translation",
  "Video & Animation",
  "Digital Marketing",
  "Music & Audio",
  "Business",
  "Data",
] as const

export type GigCategory = (typeof GIG_CATEGORIES)[number]

export type GigTierKey = "basic" | "standard" | "premium"

export const GIG_TIERS: { key: GigTierKey; label: string }[] = [
  { key: "basic", label: "Basic" },
  { key: "standard", label: "Standard" },
  { key: "premium", label: "Premium" },
]

const tierSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(80, "Keep it under 80 characters"),
  description: z.string().trim().min(10, "Describe what's included").max(600, "Keep it under 600 characters"),
  price_pkr: z.number().finite("Enter a valid price").int("Whole numbers only").min(100, "Minimum ₨100"),
  price_usd: z.number().finite("Enter a valid price").min(1, "Minimum $1"),
  delivery_days: z.number().finite("Enter valid days").int("Whole days only").min(1, "At least 1 day").max(90, "Max 90 days"),
  revisions: z.number().finite("Enter a valid number").int("Whole numbers only").min(0, "Cannot be negative").max(50, "Max 50 revisions"),
  features: z.array(z.string().trim().min(1)).min(1, "Add at least one feature"),
})

export const gigFaqEntrySchema = z.object({
  question: z.string().trim().min(1, "Question is required"),
  answer: z.string().trim().min(1, "Answer is required"),
})

export const gigWizardSchema = z.object({
  title: z.string().trim().min(10, "At least 10 characters").max(120, "Keep it under 120 characters"),
  category: z.string().min(1, "Choose a category"),
  subcategory: z.string().trim().max(80, "Keep it under 80 characters").optional(),
  tags: z.array(z.string().trim().min(1)).max(10, "Up to 10 tags"),
  description: z.string().trim().min(50, "At least 50 characters").max(3000, "Keep it under 3000 characters"),
  basic: tierSchema,
  standard: tierSchema,
  premium: tierSchema,
  premiumUnlimitedRevisions: z.boolean(),
  gallery_urls: z.array(z.string().trim().url("Must be a valid URL")).max(12, "Up to 12 images"),
  faq: z.array(gigFaqEntrySchema).max(10, "Up to 10 FAQ items"),
})

export type GigWizardValues = z.infer<typeof gigWizardSchema>
export type GigTierValues = z.infer<typeof tierSchema>

export const STEP_LABELS = ["Overview", "Pricing", "Gallery & FAQ", "Review"] as const

export const STEP_FIELDS: Record<number, (keyof GigWizardValues)[]> = {
  1: ["title", "category", "subcategory", "tags", "description"],
  2: ["basic", "standard", "premium", "premiumUnlimitedRevisions"],
  3: ["gallery_urls", "faq"],
}
