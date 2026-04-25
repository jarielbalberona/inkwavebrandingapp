export interface SellableProductPriceRuleRange {
  id?: string
  minQty: number
  maxQty: number | null
}

export function rangesOverlap(
  left: SellableProductPriceRuleRange,
  right: SellableProductPriceRuleRange,
): boolean {
  const leftMax = left.maxQty ?? Number.POSITIVE_INFINITY
  const rightMax = right.maxQty ?? Number.POSITIVE_INFINITY

  return left.minQty <= rightMax && right.minQty <= leftMax
}

export function findOverlappingRange(
  candidate: SellableProductPriceRuleRange,
  existingRanges: readonly SellableProductPriceRuleRange[],
): SellableProductPriceRuleRange | null {
  return (
    existingRanges.find((existingRange) => {
      if (candidate.id && existingRange.id === candidate.id) {
        return false
      }

      return rangesOverlap(candidate, existingRange)
    }) ?? null
  )
}

export function findMatchingActiveRange<T extends SellableProductPriceRuleRange>(
  quantity: number,
  activeRanges: readonly T[],
): T | null {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive integer.")
  }

  const matches = activeRanges.filter((range) => {
    const maxQty = range.maxQty ?? Number.POSITIVE_INFINITY
    return range.minQty <= quantity && quantity <= maxQty
  })

  if (matches.length === 0) {
    return null
  }

  if (matches.length > 1) {
    throw new Error("Multiple active price rules match the requested quantity.")
  }

  return matches[0] ?? null
}
