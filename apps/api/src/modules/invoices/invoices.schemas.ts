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

const moneyAmountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive money value")
  .transform((value) => Number(value).toFixed(2))
  .refine((value) => Number(value) > 0, "Amount must be greater than zero")

export const createInvoicePaymentSchema = z.object({
  amount: moneyAmountSchema,
  payment_date: z.coerce.date(),
  note: optionalText(1000),
})

export type CreateInvoicePaymentInput = z.infer<typeof createInvoicePaymentSchema>
