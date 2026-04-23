import { z } from "zod"

export const cupUsageReportQuerySchema = z
  .object({
    start_date: z.coerce.date().optional(),
    end_date: z.coerce.date().optional(),
  })
  .refine(
    (input) =>
      !input.start_date || !input.end_date || input.start_date.getTime() <= input.end_date.getTime(),
    {
      message: "start_date must be before or equal to end_date",
      path: ["end_date"],
    },
  )

export type CupUsageReportQuery = z.infer<typeof cupUsageReportQuerySchema>
