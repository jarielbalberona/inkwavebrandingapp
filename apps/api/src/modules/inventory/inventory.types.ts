import type { SafeUser } from "../auth/auth.schemas.js"
import { toCupDto, type CupDto } from "../cups/cups.types.js"
import { toLidDto, type LidDto } from "../lids/lids.types.js"
import { toPaperBowlDto } from "../paper-bowls/paper-bowls.types.js"
import type { InventoryBalanceSummary } from "./inventory.repository.js"
import { calculateAvailable } from "./inventory.rules.js"

export type InventoryBalanceDto =
  | {
      item_type: "cup"
      cup: CupDto
      lid: null
      paper_bowl: null
      on_hand: number
      reserved: number
      available: number
    }
  | {
      item_type: "lid"
      cup: null
      lid: LidDto
      paper_bowl: null
      on_hand: number
      reserved: number
      available: number
    }
  | {
      item_type: "paper_bowl"
      cup: null
      lid: null
      paper_bowl: ReturnType<typeof toPaperBowlDto>
      on_hand: number
      reserved: number
      available: number
    }

export function toInventoryBalanceDto(
  balance: InventoryBalanceSummary,
  user: Pick<SafeUser, "role" | "permissions">,
): InventoryBalanceDto {
  if (balance.itemType === "cup") {
    return {
      item_type: "cup",
      cup: toCupDto(balance.cup, user),
      lid: null,
      paper_bowl: null,
      on_hand: balance.onHand,
      reserved: balance.reserved,
      available: calculateAvailable(balance.onHand, balance.reserved),
    }
  }

  if (balance.itemType === "lid") {
    return {
    item_type: "lid",
    cup: null,
    lid: toLidDto(balance.lid, user),
    paper_bowl: null,
    on_hand: balance.onHand,
    reserved: balance.reserved,
    available: calculateAvailable(balance.onHand, balance.reserved),
    }
  }

  return {
    item_type: "paper_bowl",
    cup: null,
    lid: null,
    paper_bowl: toPaperBowlDto(balance.paperBowl, user),
    on_hand: balance.onHand,
    reserved: balance.reserved,
    available: calculateAvailable(balance.onHand, balance.reserved),
  }
}
