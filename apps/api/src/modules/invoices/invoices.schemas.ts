import { z } from "zod"

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value))

export const invoicesListQuerySchema = z
  .object({
    search: optionalText(160),
    customer_id: z.string().uuid().optional(),
    order_id: z.string().uuid().optional(),
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

export type InvoicesListQuery = z.infer<typeof invoicesListQuerySchema>
