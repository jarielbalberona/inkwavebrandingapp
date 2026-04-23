import type { Cup, Customer } from "../../db/schema/index.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { assertNoStaffRestrictedKeys, shapeRoleAwareResponse } from "../auth/role-safe-response.js"
import { toCustomerDto } from "../customers/customers.types.js"
import type { OrderWithRelations } from "./orders.repository.js"
import type {
  OrderLineItemProgressStage,
} from "./orders.schemas.js"
import type { ProgressEventWithRelations } from "./orders.repository.js"

interface OrderCupDto {
  id: string
  sku: string
  brand: string
  size: string
  dimension: string
  material: string | null
  color: string | null
}

interface BaseOrderItemDto {
  id: string
  cup: OrderCupDto
  quantity: number
  notes: string | null
  created_at: string
  updated_at: string
}

interface AdminOrderItemDto extends BaseOrderItemDto {
  cost_price: string
  sell_price: string
}

type StaffOrderItemDto = BaseOrderItemDto

interface BaseOrderDto {
  id: string
  order_number: string
  status: string
  customer: ReturnType<typeof toCustomerDto>
  items: Array<AdminOrderItemDto | StaffOrderItemDto>
  notes: string | null
  created_at: string
  updated_at: string
}

export type OrderDto = BaseOrderDto

export interface ProgressTotalsDto {
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
  const dto = shapeRoleAwareResponse(user, {
    admin: () => toAdminOrderDto(order, user),
    staff: () => toStaffOrderDto(order, user),
  })

  if (user.role === "staff") {
    assertNoStaffRestrictedKeys(dto)
  }

  return dto
}

function toAdminOrderDto(order: OrderWithRelations, user: SafeUser): OrderDto {
  return toBaseOrderDto(order, user, (item) => ({
    ...toBaseOrderItemDto(item),
    cost_price: item.costPrice,
    sell_price: item.sellPrice,
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
    status: order.status,
    customer: toCustomerDto(order.customer as Customer, user),
    items: order.items.map(mapItem),
    notes: order.notes ?? null,
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
  }
}

function toBaseOrderItemDto(item: OrderWithRelations["items"][number]): StaffOrderItemDto {
  return {
    id: item.id,
    cup: toCupDto(item.cup as Cup),
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
    brand: cup.brand,
    size: cup.size,
    dimension: cup.dimension,
    material: cup.material ?? null,
    color: cup.color ?? null,
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
