import { eq } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import * as schema from "../../db/schema/index.js"
import {
  getAdminSessionCookie,
  getIntegrationDb,
  getIntegrationRequest,
  useIntegrationHarness,
} from "./harness.js"
import {
  seedCup,
  seedCustomer,
  seedLid,
  seedNonStockItem,
} from "./fixtures.js"

describe("inventory, order, and invoice integration", () => {
  useIntegrationHarness()

  it("records stock intake and exposes truthful cup ledger balances", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const cup = await seedCup()

    const intakeResponse = await api
      .post("/inventory/stock-intake")
      .set("Cookie", adminCookie)
      .send({
        itemType: "cup",
        cupId: cup.id,
        quantity: 120,
        note: "Initial cup intake",
        reference: "INTAKE-001",
      })

    expect(intakeResponse.status).toBe(201)
    expect(intakeResponse.body.movement.movementType).toBe("stock_in")
    expect(intakeResponse.body.movement.quantity).toBe(120)
    expect(intakeResponse.body.movement.cupId).toBe(cup.id)

    const balanceResponse = await api
      .get(`/inventory/balances/${cup.id}`)
      .set("Cookie", adminCookie)

    expect(balanceResponse.status).toBe(200)
    expect(balanceResponse.body.balance).toMatchObject({
      item_type: "cup",
      on_hand: 120,
      reserved: 0,
      available: 120,
    })

    const movementsResponse = await api
      .get("/inventory/movements")
      .query({ cup_id: cup.id })
      .set("Cookie", adminCookie)

    expect(movementsResponse.status).toBe(200)
    expect(movementsResponse.body.movements).toHaveLength(1)
    expect(movementsResponse.body.movements[0]).toMatchObject({
      item_type: "cup",
      movement_type: "stock_in",
      quantity: 120,
      order_id: null,
      order_item_id: null,
      note: "Initial cup intake",
      reference: "INTAKE-001",
    })
  })

  it("reserves tracked inventory on order creation without creating fake non-stock movements", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const customer = await seedCustomer()
    const cup = await seedCup()
    const lid = await seedLid()
    const nonStockItem = await seedNonStockItem()
    const db = await getIntegrationDb()

    await stockIntake(api, adminCookie, {
      itemType: "cup",
      cupId: cup.id,
      quantity: 40,
    })
    await stockIntake(api, adminCookie, {
      itemType: "lid",
      lidId: lid.id,
      quantity: 30,
    })

    const createOrderResponse = await api
      .post("/orders")
      .set("Cookie", adminCookie)
      .send({
        customer_id: customer.id,
        notes: "Integration reservation test",
        line_items: [
          { item_type: "cup", cup_id: cup.id, quantity: 12 },
          { item_type: "lid", lid_id: lid.id, quantity: 8 },
          { item_type: "non_stock_item", non_stock_item_id: nonStockItem.id, quantity: 3 },
        ],
      })

    expect(createOrderResponse.status).toBe(201)
    expect(createOrderResponse.body.order.status).toBe("pending")
    expect(
      createOrderResponse.body.order.items.map((item: { item_type: string }) => item.item_type),
    ).toEqual(["cup", "lid", "non_stock_item"])

    const cupBalance = await getCupBalance(api, adminCookie, cup.id)
    expect(cupBalance).toMatchObject({
      item_type: "cup",
      on_hand: 40,
      reserved: 12,
      available: 28,
    })

    const lidBalance = await getLidBalance(api, adminCookie, lid.id)
    expect(lidBalance).toMatchObject({
      item_type: "lid",
      on_hand: 30,
      reserved: 8,
      available: 22,
    })

    const movementsForOrder = await db.query.inventoryMovements.findMany({
      where: eq(schema.inventoryMovements.orderId, createOrderResponse.body.order.id),
      orderBy: (inventoryMovements, { asc }) => [asc(inventoryMovements.createdAt)],
    })

    expect(movementsForOrder).toHaveLength(2)
    expect(
      movementsForOrder.map((movement) => ({
        itemType: movement.itemType,
        movementType: movement.movementType,
        quantity: movement.quantity,
      })),
    ).toEqual([
      { itemType: "cup", movementType: "reserve", quantity: 12 },
      { itemType: "lid", movementType: "reserve", quantity: 8 },
    ])
  })

  it("consumes cup stock on printed progress and releases the remainder on cancellation", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const customer = await seedCustomer()
    const cup = await seedCup()
    const db = await getIntegrationDb()

    await stockIntake(api, adminCookie, {
      itemType: "cup",
      cupId: cup.id,
      quantity: 20,
    })

    const createOrderResponse = await api
      .post("/orders")
      .set("Cookie", adminCookie)
      .send({
        customer_id: customer.id,
        line_items: [{ item_type: "cup", cup_id: cup.id, quantity: 10 }],
      })

    expect(createOrderResponse.status).toBe(201)

    const cupLineItem = findOrderItem(createOrderResponse.body.order.items, "cup")

    const printedResponse = await api
      .post(`/order-line-items/${cupLineItem.id}/progress-events`)
      .set("Cookie", adminCookie)
      .send({
        stage: "printed",
        quantity: 4,
        note: "Printed first batch",
        event_date: new Date("2026-04-24T09:00:00.000Z").toISOString(),
      })

    expect(printedResponse.status).toBe(201)
    expect(printedResponse.body.order_status).toBe("in_progress")
    expect(printedResponse.body.totals).toMatchObject({
      total_printed: 4,
      remaining_balance: 10,
      line_item_status: "printed",
    })

    const balanceAfterPrint = await getCupBalance(api, adminCookie, cup.id)
    expect(balanceAfterPrint).toMatchObject({
      on_hand: 16,
      reserved: 6,
      available: 10,
    })

    const cancelResponse = await api
      .patch(`/orders/${createOrderResponse.body.order.id}/cancel`)
      .set("Cookie", adminCookie)

    expect(cancelResponse.status).toBe(200)
    expect(cancelResponse.body.order.status).toBe("canceled")

    const finalBalance = await getCupBalance(api, adminCookie, cup.id)
    expect(finalBalance).toMatchObject({
      on_hand: 16,
      reserved: 0,
      available: 16,
    })

    const movementsForOrder = await db.query.inventoryMovements.findMany({
      where: eq(schema.inventoryMovements.orderId, createOrderResponse.body.order.id),
      orderBy: (inventoryMovements, { asc }) => [asc(inventoryMovements.createdAt)],
    })

    expect(
      movementsForOrder.map((movement) => ({
        movementType: movement.movementType,
        quantity: movement.quantity,
      })),
    ).toEqual([
      { movementType: "reserve", quantity: 10 },
      { movementType: "consume", quantity: 4 },
      { movementType: "release_reservation", quantity: 6 },
    ])
  })

  it("generates immutable mixed-item invoice snapshots and serves the PDF route", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const customer = await seedCustomer({
      businessName: "Snapshot Customer",
      customerCode: "SNAP-001",
    })
    const cup = await seedCup({
      defaultSellPrice: "15.00",
      costPrice: "8.50",
    })
    const lid = await seedLid({
      defaultSellPrice: "5.00",
      costPrice: "2.50",
    })
    const nonStockItem = await seedNonStockItem({
      name: "Layout Fee",
      defaultSellPrice: "7.50",
      costPrice: "3.00",
    })
    const db = await getIntegrationDb()

    await stockIntake(api, adminCookie, {
      itemType: "cup",
      cupId: cup.id,
      quantity: 10,
    })
    await stockIntake(api, adminCookie, {
      itemType: "lid",
      lidId: lid.id,
      quantity: 10,
    })

    const createOrderResponse = await api
      .post("/orders")
      .set("Cookie", adminCookie)
      .send({
        customer_id: customer.id,
        notes: "Invoice snapshot integration test",
        line_items: [
          { item_type: "cup", cup_id: cup.id, quantity: 2 },
          { item_type: "lid", lid_id: lid.id, quantity: 3 },
          { item_type: "non_stock_item", non_stock_item_id: nonStockItem.id, quantity: 1 },
        ],
      })

    expect(createOrderResponse.status).toBe(201)

    const orderId = createOrderResponse.body.order.id as string
    const cupLineItem = findOrderItem(createOrderResponse.body.order.items, "cup")
    const lidLineItem = findOrderItem(createOrderResponse.body.order.items, "lid")

    await postProgressEvent(api, adminCookie, cupLineItem.id, "printed", 2)
    await postProgressEvent(api, adminCookie, cupLineItem.id, "qa_passed", 2)
    await postProgressEvent(api, adminCookie, cupLineItem.id, "packed", 2)
    await postProgressEvent(api, adminCookie, cupLineItem.id, "ready_for_release", 2)
    await postProgressEvent(api, adminCookie, cupLineItem.id, "released", 2)
    await postProgressEvent(api, adminCookie, lidLineItem.id, "packed", 3)
    await postProgressEvent(api, adminCookie, lidLineItem.id, "ready_for_release", 3)
    const lidReleasedResponse = await postProgressEvent(
      api,
      adminCookie,
      lidLineItem.id,
      "released",
      3,
    )

    expect(lidReleasedResponse.status).toBe(201)
    expect(lidReleasedResponse.body.order_status).toBe("completed")

    const invoiceResponse = await api
      .post(`/orders/${orderId}/invoice`)
      .set("Cookie", adminCookie)

    expect(invoiceResponse.status).toBe(201)
    expect(invoiceResponse.body.invoice.status).toBe("pending")
    expect(invoiceResponse.body.invoice.subtotal).toBe("52.50")
    expect(
      invoiceResponse.body.invoice.items.map((item: { item_type: string }) => item.item_type),
    ).toEqual(["cup", "lid", "non_stock_item"])

    const invoiceId = invoiceResponse.body.invoice.id as string
    const cupInvoiceItem = invoiceResponse.body.invoice.items.find(
      (item: { item_type: string }) => item.item_type === "cup",
    )
    expect(cupInvoiceItem?.unit_price).toBe("15.00")

    await db
      .update(schema.cups)
      .set({
        defaultSellPrice: "99.00",
      })
      .where(eq(schema.cups.id, cup.id))

    await db
      .update(schema.customers)
      .set({
        businessName: "Changed Customer Name",
      })
      .where(eq(schema.customers.id, customer.id))

    const invoiceDetailResponse = await api
      .get(`/invoices/${invoiceId}`)
      .set("Cookie", adminCookie)

    expect(invoiceDetailResponse.status).toBe(200)
    expect(invoiceDetailResponse.body.invoice.status).toBe("pending")
    expect(invoiceDetailResponse.body.invoice.customer.business_name).toBe("Snapshot Customer")
    expect(
      invoiceDetailResponse.body.invoice.items.find(
        (item: { item_type: string }) => item.item_type === "cup",
      )?.unit_price,
    ).toBe("15.00")

    const persistedInvoiceItems = await db.query.invoiceItems.findMany({
      where: eq(schema.invoiceItems.invoiceId, invoiceId),
      orderBy: (invoiceItems, { asc }) => [asc(invoiceItems.createdAt)],
    })

    expect(persistedInvoiceItems.map((item) => item.itemType)).toEqual([
      "cup",
      "lid",
      "non_stock_item",
    ])

    const pdfResponse = await api
      .get(`/invoices/${invoiceId}/pdf`)
      .set("Cookie", adminCookie)

    expect(pdfResponse.status).toBe(200)
    expect(pdfResponse.headers["content-type"]).toContain("application/pdf")
    expect(pdfResponse.headers["content-disposition"]).toContain(
      `${invoiceResponse.body.invoice.invoice_number}.pdf`,
    )

    const duplicateInvoiceResponse = await api
      .post(`/orders/${orderId}/invoice`)
      .set("Cookie", adminCookie)

    expect(duplicateInvoiceResponse.status).toBe(409)
    expect(duplicateInvoiceResponse.body.error).toBe("Invoice already exists for this order")
  })

  it("keeps custom_charge out of inventory movements and product-oriented reports", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const customer = await seedCustomer()
    const cup = await seedCup({
      defaultSellPrice: "15.00",
      costPrice: "8.50",
    })
    const db = await getIntegrationDb()

    await stockIntake(api, adminCookie, {
      itemType: "cup",
      cupId: cup.id,
      quantity: 20,
    })

    const createOrderResponse = await api
      .post("/orders")
      .set("Cookie", adminCookie)
      .send({
        customer_id: customer.id,
        notes: "Custom charge reporting isolation test",
        line_items: [
          { item_type: "cup", cup_id: cup.id, quantity: 2 },
          {
            item_type: "custom_charge",
            description_snapshot: "Rush fee",
            quantity: 1,
            unit_sell_price: "500.00",
            unit_cost_price: "120.00",
          },
        ],
      })

    expect(createOrderResponse.status).toBe(201)
    expect(
      createOrderResponse.body.order.items.map((item: { item_type: string }) => item.item_type),
    ).toEqual(["cup", "custom_charge"])

    const movementsForOrder = await db.query.inventoryMovements.findMany({
      where: eq(schema.inventoryMovements.orderId, createOrderResponse.body.order.id),
      orderBy: (inventoryMovements, { asc }) => [asc(inventoryMovements.createdAt)],
    })

    expect(movementsForOrder).toHaveLength(1)
    expect(movementsForOrder[0]).toMatchObject({
      itemType: "cup",
      movementType: "reserve",
      quantity: 2,
    })

    const cupLineItem = findOrderItem(createOrderResponse.body.order.items, "cup")

    await postProgressEvent(api, adminCookie, cupLineItem.id, "printed", 2)
    await postProgressEvent(api, adminCookie, cupLineItem.id, "qa_passed", 2)
    await postProgressEvent(api, adminCookie, cupLineItem.id, "packed", 2)
    await postProgressEvent(api, adminCookie, cupLineItem.id, "ready_for_release", 2)
    const releasedResponse = await postProgressEvent(api, adminCookie, cupLineItem.id, "released", 2)

    expect(releasedResponse.status).toBe(201)
    expect(releasedResponse.body.order_status).toBe("completed")

    const cupUsageResponse = await api
      .get("/reports/cup-usage")
      .set("Cookie", adminCookie)

    expect(cupUsageResponse.status).toBe(200)
    expect(cupUsageResponse.body.report.total_consumed_quantity).toBe(2)
    expect(cupUsageResponse.body.report.items).toHaveLength(1)
    expect(cupUsageResponse.body.report.items[0]).toMatchObject({
      cup: {
        id: cup.id,
        sku: cup.sku,
      },
      consumed_quantity: 2,
    })

    const salesCostResponse = await api
      .get("/reports/sales-cost-visibility")
      .set("Cookie", adminCookie)

    expect(salesCostResponse.status).toBe(200)
    expect(salesCostResponse.body.report.totals).toMatchObject({
      released_quantity: 2,
      sell_total: "30.00",
      cost_total: "17.00",
      gross_profit: "13.00",
    })
    expect(salesCostResponse.body.report.items).toHaveLength(1)
    expect(salesCostResponse.body.report.items[0]).toMatchObject({
      cup: {
        id: cup.id,
        sku: cup.sku,
      },
      released_quantity: 2,
      sell_total: "30.00",
      cost_total: "17.00",
      gross_profit: "13.00",
    })
  })

  it("rejects fulfillment progress events for custom_charge line items", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const customer = await seedCustomer()

    const createOrderResponse = await api
      .post("/orders")
      .set("Cookie", adminCookie)
      .send({
        customer_id: customer.id,
        line_items: [
          {
            item_type: "custom_charge",
            description_snapshot: "Rush fee",
            quantity: 1,
            unit_sell_price: "500.00",
          },
        ],
      })

    expect(createOrderResponse.status).toBe(201)
    expect(createOrderResponse.body.order.status).toBe("completed")

    const customChargeLineItem = findOrderItem(createOrderResponse.body.order.items, "custom_charge")

    const progressResponse = await api
      .post(`/order-line-items/${customChargeLineItem.id}/progress-events`)
      .set("Cookie", adminCookie)
      .send({
        stage: "printed",
        quantity: 1,
        event_date: new Date("2026-04-24T09:00:00.000Z").toISOString(),
      })

    expect(progressResponse.status).toBe(409)
    expect(progressResponse.body.error).toBe(
      "Non-stock and custom charge line items do not support fulfillment progress events",
    )
  })
})

async function stockIntake(
  api: Awaited<ReturnType<typeof getIntegrationRequest>>,
  adminCookie: string[],
  input:
    | { itemType: "cup"; cupId: string; quantity: number }
    | { itemType: "lid"; lidId: string; quantity: number },
) {
  const response = await api
    .post("/inventory/stock-intake")
    .set("Cookie", adminCookie)
    .send({
      ...input,
      note: "Integration stock intake",
      reference: "INT-STOCK",
    })

  expect(response.status).toBe(201)
}

async function getCupBalance(
  api: Awaited<ReturnType<typeof getIntegrationRequest>>,
  adminCookie: string[],
  cupId: string,
) {
  const response = await api
    .get(`/inventory/balances/${cupId}`)
    .set("Cookie", adminCookie)

  expect(response.status).toBe(200)

  return response.body.balance
}

async function getLidBalance(
  api: Awaited<ReturnType<typeof getIntegrationRequest>>,
  adminCookie: string[],
  lidId: string,
) {
  const response = await api
    .get("/inventory/balances")
    .query({ item_type: "lid" })
    .set("Cookie", adminCookie)

  expect(response.status).toBe(200)

  const balance = response.body.balances.find(
    (item: { item_type: string; lid: { id: string } | null }) =>
      item.item_type === "lid" && item.lid?.id === lidId,
  )

  if (!balance) {
    throw new Error(`Expected lid balance for ${lidId}`)
  }

  return balance
}

function findOrderItem(
  items: Array<{ id: string; item_type: string }>,
  itemType: "cup" | "lid" | "non_stock_item" | "custom_charge",
) {
  const item = items.find((entry) => entry.item_type === itemType)

  if (!item) {
    throw new Error(`Expected ${itemType} order item`)
  }

  return item
}

async function postProgressEvent(
  api: Awaited<ReturnType<typeof getIntegrationRequest>>,
  adminCookie: string[],
  orderLineItemId: string,
  stage:
    | "printed"
    | "qa_passed"
    | "packed"
    | "ready_for_release"
    | "released",
  quantity: number,
) {
  return api
    .post(`/order-line-items/${orderLineItemId}/progress-events`)
    .set("Cookie", adminCookie)
    .send({
      stage,
      quantity,
      event_date: new Date("2026-04-24T09:00:00.000Z").toISOString(),
    })
}
