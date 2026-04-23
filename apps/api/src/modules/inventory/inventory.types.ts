import type { SafeUser } from "../auth/auth.schemas.js"
import { toCupDto, type CupDto } from "../cups/cups.types.js"
import { toLidDto, type LidDto } from "../lids/lids.types.js"
import type { InventoryBalanceSummary } from "./inventory.repository.js"
import { calculateAvailable } from "./inventory.rules.js"

export type InventoryBalanceDto =
  | {
      item_type: "cup"
      cup: CupDto
      lid: null
      on_hand: number
      reserved: number
      available: number
    }
  | {
      item_type: "lid"
      cup: null
      lid: LidDto
      on_hand: number
      reserved: number
      available: number
    }

export function toInventoryBalanceDto(
  balance: InventoryBalanceSummary,
  user: Pick<SafeUser, "role">,
): InventoryBalanceDto {
  if (balance.itemType === "cup") {
    return {
      item_type: "cup",
      cup: toCupDto(balance.cup, user),
      lid: null,
      on_hand: balance.onHand,
      reserved: balance.reserved,
      available: calculateAvailable(balance.onHand, balance.reserved),
    }
  }

  return {
    item_type: "lid",
    cup: null,
    lid: toLidDto(balance.lid, user),
    on_hand: balance.onHand,
    reserved: balance.reserved,
    available: calculateAvailable(balance.onHand, balance.reserved),
  }
}
