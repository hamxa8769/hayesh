import { z } from "zod"

/**
 * Client-side form schema for booking a free demo lesson. Mirrors the
 * server-side schema in app/api/demo-bookings/route.ts (kept separate
 * because the form works with a <input type="datetime-local"> string while
 * the API validates the ISO string produced from it), so validation
 * messages surface at the form layer before the request ever reaches the
 * server.
 */
export const demoBookingFormSchema = z
  .object({
    child_name: z
      .string()
      .trim()
      .min(2, "Enter your child's name")
      .max(100, "Keep it under 100 characters"),
    // Kept as a string (not z.coerce.number()) because the registered
    // <input type="number"> always hands react-hook-form a string, and
    // mixing z.coerce.number() into a union produced an `unknown` input
    // type that broke the zodResolver's generic inference. Range/format is
    // validated here as a string pattern; the numeric value is derived at
    // submit time in DemoBookingModal.tsx.
    child_age: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || (/^\d+$/.test(value) && Number(value) >= 3 && Number(value) <= 25),
        "Age must be between 3 and 25"
      )
      .optional(),
    subject: z
      .string()
      .trim()
      .min(1, "Select or enter a subject")
      .max(100, "Keep it under 100 characters"),
    scheduled_at: z.string().min(1, "Choose a date and time"),
    notes: z.string().trim().max(500, "Keep it under 500 characters").optional(),
  })
  .superRefine((values, ctx) => {
    const parsedDate = new Date(values.scheduled_at)
    if (Number.isNaN(parsedDate.getTime())) {
      ctx.addIssue({ code: "custom", path: ["scheduled_at"], message: "Enter a valid date and time" })
      return
    }
    if (parsedDate.getTime() <= Date.now()) {
      ctx.addIssue({ code: "custom", path: ["scheduled_at"], message: "Choose a time in the future" })
    }
  })

export type DemoBookingFormValues = z.infer<typeof demoBookingFormSchema>
