import type { SafeUser } from "../auth/auth.schemas.js"
import { toCupDto, type CupDto } from "../cups/cups.types.js"
import type { InventoryBalanceSummary } from "./inventory.repository.js"
import { calculateAvailable } from "./inventory.rules.js"

export interface InventoryBalanceDto {
  cup: CupDto
  on_hand: number
  reserved: number
  available: number
}

export function toInventoryBalanceDto(
  balance: InventoryBalanceSummary,
  user: Pick<SafeUser, "role">,
): InventoryBalanceDto {
  return {
    cup: toCupDto(balance.cup, user),
    on_hand: balance.onHand,
    reserved: balance.reserved,
    available: calculateAvailable(balance.onHand, balance.reserved),
  }
}
