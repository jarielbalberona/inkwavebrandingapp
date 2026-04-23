import type { Cup, Customer } from "../../db/schema/index.js"
import type { SafeUser } from "../auth/auth.schemas.js"
import { assertNoStaffRestrictedKeys, shapeRoleAwareResponse } from "../auth/role-safe-response.js"
import { toCustomerDto } from "../customers/customers.types.js"
import type { OrderWithRelations } from "./orders.repository.js"

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
