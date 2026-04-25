export interface ProductBundleCompositionInput {
  cupId?: string | null
  lidId?: string | null
  cupQtyPerSet: number
  lidQtyPerSet: number
}

export interface ProductBundleInventoryComponent {
  itemType: "cup" | "lid"
  itemId: string
  quantity: number
}

export function getProductBundleCompositionIssues(
  input: ProductBundleCompositionInput,
): string[] {
  const issues: string[] = []

  if (!input.cupId && !input.lidId) {
    issues.push("At least one cup or lid component is required.")
  }

  if (!input.cupId && input.cupQtyPerSet !== 0) {
    issues.push("Cup quantity must be 0 when no cup is selected.")
  }

  if (input.cupId && input.cupQtyPerSet <= 0) {
    issues.push("Cup quantity must be greater than 0 when a cup is selected.")
  }

  if (!input.lidId && input.lidQtyPerSet !== 0) {
    issues.push("Lid quantity must be 0 when no lid is selected.")
  }

  if (input.lidId && input.lidQtyPerSet <= 0) {
    issues.push("Lid quantity must be greater than 0 when a lid is selected.")
  }

  return issues
}

export function toProductBundleInventoryComponents(
  input: ProductBundleCompositionInput,
  setQuantity: number,
): ProductBundleInventoryComponent[] {
  if (!Number.isInteger(setQuantity) || setQuantity <= 0) {
    throw new Error("Set quantity must be a positive integer.")
  }

  const issues = getProductBundleCompositionIssues(input)

  if (issues.length > 0) {
    throw new Error(issues.join(" "))
  }

  const components: ProductBundleInventoryComponent[] = []

  if (input.cupId) {
    components.push({
      itemType: "cup",
      itemId: input.cupId,
      quantity: input.cupQtyPerSet * setQuantity,
    })
  }

  if (input.lidId) {
    components.push({
      itemType: "lid",
      itemId: input.lidId,
      quantity: input.lidQtyPerSet * setQuantity,
    })
  }

  return components
}
