import { useEffect, useMemo, useState } from "react"

import { Navigate } from "@tanstack/react-router"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { useCurrentUser } from "@/features/auth/hooks/use-auth"
import { appPermissions, getDefaultAuthorizedRoute, hasPermission } from "@/features/auth/permissions"
import type { ProductBundle } from "@/features/product-bundles/api/product-bundles-client"
import { useProductBundlesQuery } from "@/features/product-bundles/hooks/use-product-bundles"
import type {
  SellableProductPriceRule,
  SellableProductPriceRulePayload,
} from "@/features/sellable-product-price-rules/api/sellable-product-price-rules-client"
import {
  useCreateSellableProductPriceRuleMutation,
  useSellableProductPriceRulesQuery,
  useUpdateSellableProductPriceRuleMutation,
} from "@/features/sellable-product-price-rules/hooks/use-sellable-product-price-rules"

const pricingRuleFormSchema = z
  .object({
    product_bundle_id: z.string().uuid("Select a bundle."),
    min_qty: z.number().int().positive(),
    has_max_qty: z.boolean(),
    max_qty: z.number().int().positive(),
    unit_price: z.number().nonnegative(),
    is_active: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.has_max_qty && values.max_qty < values.min_qty) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max_qty"],
        message: "Max quantity must be greater than or equal to min quantity.",
      })
    }
  })

type PricingRuleFormValues = z.infer<typeof pricingRuleFormSchema>

const emptyFormValues: PricingRuleFormValues = {
  product_bundle_id: "",
  min_qty: 1,
  has_max_qty: true,
  max_qty: 999,
  unit_price: 0,
  is_active: true,
}

export function SellableProductPriceRulesPage() {
  const currentUser = useCurrentUser()
  const productBundlesQuery = useProductBundlesQuery()
  const pricingRulesQuery = useSellableProductPriceRulesQuery()
  const createPricingRule = useCreateSellableProductPriceRuleMutation()
  const updatePricingRule = useUpdateSellableProductPriceRuleMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [bundleFilter, setBundleFilter] = useState("all")
  const canViewPricingRules = hasPermission(
    currentUser.data,
    appPermissions.sellableProductPriceRulesView,
  )
  const canManagePricingRules = hasPermission(
    currentUser.data,
    appPermissions.sellableProductPriceRulesManage,
  )
  const selectedRule = useMemo(
    () => pricingRulesQuery.data?.find((rule) => rule.id === selectedRuleId) ?? null,
    [pricingRulesQuery.data, selectedRuleId],
  )
  const visibleRules = useMemo(
    () => filterAndSortPricingRules(pricingRulesQuery.data ?? [], bundleFilter),
    [bundleFilter, pricingRulesQuery.data],
  )

  const form = useForm<PricingRuleFormValues>({
    resolver: zodResolver(pricingRuleFormSchema),
    defaultValues: emptyFormValues,
  })

  const hasMaxQty = useWatch({ control: form.control, name: "has_max_qty" })

  useEffect(() => {
    if (!dialogOpen) {
      return
    }

    form.reset(selectedRule ? toFormValues(selectedRule) : getEmptyFormValues(productBundlesQuery.data ?? []))
  }, [dialogOpen, form, productBundlesQuery.data, selectedRule])

  if (currentUser.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading access...</p>
  }

  if (!canViewPricingRules) {
    const fallbackRoute = getDefaultAuthorizedRoute(currentUser.data)

    if (fallbackRoute && fallbackRoute !== "/products") {
      return <Navigate to={fallbackRoute} />
    }

    return (
      <Alert>
        <AlertDescription>Pricing-rule visibility requires pricing-rule-view permission.</AlertDescription>
      </Alert>
    )
  }

  async function onSubmit(values: PricingRuleFormValues) {
    setSubmitError(null)

    const payload: SellableProductPriceRulePayload = {
      product_bundle_id: values.product_bundle_id,
      min_qty: values.min_qty,
      max_qty: values.has_max_qty ? values.max_qty : null,
      unit_price: values.unit_price.toFixed(2),
      is_active: values.is_active,
    }

    try {
      if (selectedRule) {
        await updatePricingRule.mutateAsync({ id: selectedRule.id, payload })
      } else {
        await createPricingRule.mutateAsync(payload)
      }

      setDialogOpen(false)
      setSelectedRuleId(null)
      form.reset(getEmptyFormValues(productBundlesQuery.data ?? []))
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save pricing rule.")
    }
  }

  function openCreateDialog() {
    setSelectedRuleId(null)
    setDialogOpen(true)
  }

  function openDetailDialog(rule: SellableProductPriceRule) {
    setSelectedRuleId(rule.id)
    setDialogOpen(true)
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <CardTitle>Pricing Rules</CardTitle>
            <CardDescription>Default quantity-tier pricing for commercial bundles.</CardDescription>
          </div>
          {canManagePricingRules ? <Button onClick={openCreateDialog}>Create Pricing Rule</Button> : null}
        </CardHeader>
        <CardContent className="grid gap-4">
          {pricingRulesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading pricing rules...</p>
          ) : null}

          {pricingRulesQuery.isError ? (
            <Alert>
              <AlertDescription>
                {pricingRulesQuery.error instanceof Error
                  ? pricingRulesQuery.error.message
                  : "Unable to load pricing rules."}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2 sm:max-w-sm">
            <Label htmlFor="pricing-bundle-filter">Bundle</Label>
            <Select value={bundleFilter} onValueChange={setBundleFilter}>
              <SelectTrigger id="pricing-bundle-filter">
                <SelectValue placeholder="All bundles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All bundles</SelectItem>
                {(productBundlesQuery.data ?? []).map((bundle) => (
                  <SelectItem key={bundle.id} value={bundle.id}>
                    {bundle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!pricingRulesQuery.isLoading && pricingRulesQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pricing rules found. Admins can create default pricing tiers after bundles exist.
            </p>
          ) : null}

          {visibleRules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bundle</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>Unit price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRules.map((rule) => (
                  <TableRow
                    key={rule.id}
                    className={canManagePricingRules ? "cursor-pointer" : undefined}
                    onClick={() => {
                      if (canManagePricingRules) {
                        openDetailDialog(rule)
                      }
                    }}
                  >
                    <TableCell className="font-medium">
                      {formatBundleName(rule.product_bundle_id, productBundlesQuery.data ?? [])}
                    </TableCell>
                    <TableCell>{formatRange(rule)}</TableCell>
                    <TableCell>{rule.unit_price}</TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? "default" : "secondary"}>
                        {rule.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setSelectedRuleId(null)
            setSubmitError(null)
            form.reset(getEmptyFormValues(productBundlesQuery.data ?? []))
          }
        }}
      >
        <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedRule ? "Edit Pricing Rule" : "Create Pricing Rule"}</DialogTitle>
            <DialogDescription>Define the default unit price for a bundle quantity tier.</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              {submitError ? (
                <Alert>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}

              <FormField
                control={form.control}
                name="product_bundle_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bundle</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bundle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(productBundlesQuery.data ?? []).map((bundle) => (
                          <SelectItem key={bundle.id} value={bundle.id}>
                            {bundle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="min_qty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min qty</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={field.value}
                          onChange={(event) => field.onChange(Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_qty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max qty</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          disabled={!hasMaxQty}
                          value={field.value}
                          onChange={(event) => field.onChange(Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="has_max_qty"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-md border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    </FormControl>
                    <FormLabel className="m-0">Bounded range</FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={field.value}
                        onChange={(event) => field.onChange(Number(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-md border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    </FormControl>
                    <FormLabel className="m-0">Active</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false)
                    setSelectedRuleId(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createPricingRule.isPending || updatePricingRule.isPending}>
                  {selectedRule ? "Save Pricing Rule" : "Create Pricing Rule"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function getEmptyFormValues(bundles: ProductBundle[]): PricingRuleFormValues {
  return {
    ...emptyFormValues,
    product_bundle_id: bundles[0]?.id ?? "",
  }
}

function toFormValues(rule: SellableProductPriceRule): PricingRuleFormValues {
  return {
    product_bundle_id: rule.product_bundle_id,
    min_qty: rule.min_qty,
    has_max_qty: rule.max_qty !== null,
    max_qty: rule.max_qty ?? rule.min_qty,
    unit_price: Number(rule.unit_price),
    is_active: rule.is_active,
  }
}

function filterAndSortPricingRules(
  rules: SellableProductPriceRule[],
  bundleFilter: string,
): SellableProductPriceRule[] {
  return [...rules]
    .filter((rule) => bundleFilter === "all" || rule.product_bundle_id === bundleFilter)
    .sort((left, right) => {
      const bundleSort = left.product_bundle_id.localeCompare(right.product_bundle_id)
      return bundleSort === 0 ? left.min_qty - right.min_qty : bundleSort
    })
}

function formatBundleName(productBundleId: string, bundles: ProductBundle[]): string {
  return bundles.find((bundle) => bundle.id === productBundleId)?.name ?? "Bundle not found"
}

function formatRange(rule: SellableProductPriceRule): string {
  return rule.max_qty === null ? `${rule.min_qty}+` : `${rule.min_qty}-${rule.max_qty}`
}
