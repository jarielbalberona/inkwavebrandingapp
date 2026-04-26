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

export const salesCostVisibilityReportQuerySchema = z
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

export const commercialSalesReportItemTypeSchema = z.enum([
  "product_bundle",
  "cup",
  "lid",
  "non_stock_item",
  "custom_charge",
])

export const commercialSalesReportQuerySchema = z
  .object({
    start_date: z.coerce.date().optional(),
    end_date: z.coerce.date().optional(),
    item_type: commercialSalesReportItemTypeSchema.optional(),
    product_bundle_id: z.string().uuid().optional(),
  })
  .refine(
    (input) =>
      !input.start_date || !input.end_date || input.start_date.getTime() <= input.end_date.getTime(),
    {
      message: "start_date must be before or equal to end_date",
      path: ["end_date"],
    },
  )
  .refine(
    (input) => !input.product_bundle_id || !input.item_type || input.item_type === "product_bundle",
    {
      message: "product_bundle_id can only be used with product_bundle item_type",
      path: ["product_bundle_id"],
    },
  )

export type CupUsageReportQuery = z.infer<typeof cupUsageReportQuerySchema>
export type SalesCostVisibilityReportQuery = z.infer<typeof salesCostVisibilityReportQuerySchema>
export type CommercialSalesReportQuery = z.infer<typeof commercialSalesReportQuerySchema>
export type CommercialSalesReportItemType = z.infer<typeof commercialSalesReportItemTypeSchema>
