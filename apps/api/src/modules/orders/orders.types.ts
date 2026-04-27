import type { Cup, Customer, Lid, NonStockItem, ProductBundle } from "../../db/schema/index.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { shapePermissionAwareResponse } from "../auth/role-safe-response.js"
import { toCustomerDto } from "../customers/customers.types.js"
import type { OrderWithRelations, ProgressEventWithRelations } from "./orders.repository.js"
import type { OrderLineItemProgressStage } from "./orders.schemas.js"

interface OrderCupDto {
  id: string
  sku: string
  type: string
  brand: string
  diameter: string
  size: string
  color: string
}

interface OrderLidDto {
  id: string
  sku: string
  type: string
  brand: string
  diameter: string
  shape: string
  color: string
}

interface OrderNonStockItemDto {
  id: string
  name: string
  description: string | null
}

interface OrderCustomChargeDto {
  description_snapshot: string
}

interface OrderProductBundleDto {
  id: string
  name: string
  description: string | null
  /** Units of this cup per ordered bundle (set) */
  cup_qty_per_set: number
  /** Units of this lid per ordered bundle (set) */
  lid_qty_per_set: number
  cup: OrderCupDto | null
  lid: OrderLidDto | null
}

interface BaseOrderItemDto {
  id: string
  item_type: "cup" | "lid" | "non_stock_item" | "custom_charge" | "product_bundle"
  cup: OrderCupDto | null
  lid: OrderLidDto | null
  non_stock_item: OrderNonStockItemDto | null
  custom_charge: OrderCustomChargeDto | null
  product_bundle: OrderProductBundleDto | null
  description_snapshot: string
  quantity: number
  notes: string | null
  created_at: string
  updated_at: string
}

interface AdminOrderItemDto extends BaseOrderItemDto {
  unit_cost_price: string
  unit_sell_price: string
}

type StaffOrderItemDto = BaseOrderItemDto

interface BaseOrderDto {
  id: string
  order_number: string
  priority: number
  status: string
  customer: ReturnType<typeof toCustomerDto>
  items: Array<AdminOrderItemDto | StaffOrderItemDto>
  notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export type OrderDto = BaseOrderDto

export type OrderLineItemDerivedStatus =
  | "not_started"
  | "printed"
  | "qa_passed"
  | "packed"
  | "ready_for_release"
  | "released"
  | "completed"

export interface ProgressTotalsDto {
  line_item_status: OrderLineItemDerivedStatus
  total_printed: number
  total_qa_passed: number
  total_packed: number
  total_ready_for_release: number
  total_released: number
  remaining_balance: number
}

export interface OrderLineItemProgressEventDto {
  id: string
  order_line_item_id: string
  stage: OrderLineItemProgressStage
  quantity: number
  note: string | null
  event_date: string
  created_by: {
    id: string
    display_name: string | null
  } | null
  created_at: string
}

export function toOrderDto(order: OrderWithRelations, user: SafeUser): OrderDto {
  return shapePermissionAwareResponse(user, "orders.pricing.view", {
    allowed: () => toAdminOrderDto(order, user),
    restricted: () => toStaffOrderDto(order, user),
  })
}

function toAdminOrderDto(order: OrderWithRelations, user: SafeUser): OrderDto {
  return toBaseOrderDto(order, user, (item) => ({
    ...toBaseOrderItemDto(item),
    unit_cost_price: toMoneyString(item.unitCostPrice),
    unit_sell_price: toMoneyString(item.unitSellPrice),
  }))
}

function toStaffOrderDto(order: OrderWithRelations, user: SafeUser): OrderDto {
  return toBaseOrderDto(order, user, toBaseOrderItemDto)
}

function toBaseOrderDto(
  order: OrderWithRelations,
  user: SafeUser,
  mapItem: (item: OrderWithRelations["items"][number]) => AdminOrderItemDto | StaffOrderItemDto,
): OrderDto {
  return {
    id: order.id,
    order_number: order.orderNumber,
    priority: order.priority,
    status: order.status,
    customer: toCustomerDto(order.customer as Customer, user),
    items: order.items.map(mapItem),
    notes: order.notes ?? null,
    archived_at: order.archivedAt?.toISOString() ?? null,
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
  }
}

function toBaseOrderItemDto(item: OrderWithRelations["items"][number]): StaffOrderItemDto {
  if (item.itemType === "cup") {
    return {
      id: item.id,
      item_type: "cup",
      cup: toCupDto(item.cup as Cup),
      lid: null,
      non_stock_item: null,
      custom_charge: null,
      product_bundle: null,
      description_snapshot: item.descriptionSnapshot,
      quantity: item.quantity,
      notes: item.notes ?? null,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    }
  }

  if (item.itemType === "lid") {
    return {
      id: item.id,
      item_type: "lid",
      cup: null,
      lid: toLidDto(item.lid as Lid),
      non_stock_item: null,
      custom_charge: null,
      product_bundle: null,
      description_snapshot: item.descriptionSnapshot,
      quantity: item.quantity,
      notes: item.notes ?? null,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    }
  }

  if (item.itemType === "custom_charge") {
    return {
      id: item.id,
      item_type: "custom_charge",
      cup: null,
      lid: null,
      non_stock_item: null,
      custom_charge: {
        description_snapshot: item.descriptionSnapshot,
      },
      product_bundle: null,
      description_snapshot: item.descriptionSnapshot,
      quantity: item.quantity,
      notes: item.notes ?? null,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    }
  }

  if (item.itemType === "product_bundle") {
    return {
      id: item.id,
      item_type: "product_bundle",
      cup: null,
      lid: null,
      non_stock_item: null,
      custom_charge: null,
      product_bundle: toProductBundleDto(item.productBundle as ProductBundle),
      description_snapshot: item.descriptionSnapshot,
      quantity: item.quantity,
      notes: item.notes ?? null,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    }
  }

  return {
    id: item.id,
    item_type: "non_stock_item",
    cup: null,
    lid: null,
    non_stock_item: toNonStockItemDto(item.nonStockItem as NonStockItem),
    custom_charge: null,
    product_bundle: null,
    description_snapshot: item.descriptionSnapshot,
    quantity: item.quantity,
    notes: item.notes ?? null,
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
  }
}

function toCupDto(cup: Cup): OrderCupDto {
  return {
    id: cup.id,
    sku: cup.sku,
    type: cup.type,
    brand: cup.brand,
    diameter: cup.diameter,
    size: cup.size,
    color: cup.color,
  }
}

function toLidDto(lid: Lid): OrderLidDto {
  return {
    id: lid.id,
    sku: lid.sku,
    type: lid.type,
    brand: lid.brand,
    diameter: lid.diameter,
    shape: lid.shape,
    color: lid.color,
  }
}

function toNonStockItemDto(nonStockItem: NonStockItem): OrderNonStockItemDto {
  return {
    id: nonStockItem.id,
    name: nonStockItem.name,
    description: nonStockItem.description ?? null,
  }
}

function toProductBundleDto(
  productBundle: ProductBundle & { cup?: Cup | null; lid?: Lid | null },
): OrderProductBundleDto {
  return {
    id: productBundle.id,
    name: productBundle.name,
    description: productBundle.description ?? null,
    cup_qty_per_set: productBundle.cupQtyPerSet,
    lid_qty_per_set: productBundle.lidQtyPerSet,
    cup: productBundle.cupId && productBundle.cup ? toCupDto(productBundle.cup as Cup) : null,
    lid: productBundle.lidId && productBundle.lid ? toLidDto(productBundle.lid as Lid) : null,
  }
}

export function toProgressEventDto(
  event: ProgressEventWithRelations,
): OrderLineItemProgressEventDto {
  return {
    id: event.id,
    order_line_item_id: event.orderLineItemId,
    stage: event.stage,
    quantity: event.quantity,
    note: event.note ?? null,
    event_date: event.eventDate.toISOString(),
    created_by: event.createdByUser
      ? {
          id: event.createdByUser.id,
          display_name: event.createdByUser.displayName ?? null,
        }
      : null,
    created_at: event.createdAt.toISOString(),
  }
}

function toMoneyString(value: string): string {
  return Number(value).toFixed(2)
}
