import { describe, expect, it } from "vitest"

import {
  getAdminSessionCookie,
  getIntegrationRequest,
  getStaffSessionCookie,
  useIntegrationHarness,
} from "./harness.js"
import { seedCustomer, seedNonStockItem } from "./fixtures.js"

describe("customer archive integration", () => {
  useIntegrationHarness()

  it("hides archived customers from normal flows while preserving linked order history", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const staffCookie = await getStaffSessionCookie()
    const customer = await seedCustomer({
      customerCode: "ARCHIVE-CUST-001",
      businessName: "Archived Customer",
    })
    const nonStockItem = await seedNonStockItem({
      name: "Archived Customer Design Fee",
      costPrice: "100.00",
      defaultSellPrice: "250.00",
    })

    const createOrderResponse = await api
      .post("/orders")
      .set("Cookie", adminCookie)
      .send({
        customer_id: customer.id,
        line_items: [
          {
            item_type: "non_stock_item",
            non_stock_item_id: nonStockItem.id,
            quantity: 1,
          },
        ],
      })

    expect(createOrderResponse.status).toBe(201)

    const staffArchiveResponse = await api
      .post(`/customers/${customer.id}/archive`)
      .set("Cookie", staffCookie)
      .send({})

    expect(staffArchiveResponse.status).toBe(403)

    const archiveResponse = await api
      .post(`/customers/${customer.id}/archive`)
      .set("Cookie", adminCookie)
      .send({})

    expect(archiveResponse.status).toBe(200)
    expect(archiveResponse.body.customer.id).toBe(customer.id)

    const listResponse = await api
      .get("/customers?include_inactive=true&search=Archived%20Customer")
      .set("Cookie", adminCookie)

    expect(listResponse.status).toBe(200)
    expect(listResponse.body.customers).toEqual([])

    const detailResponse = await api
      .get(`/customers/${customer.id}`)
      .set("Cookie", adminCookie)

    expect(detailResponse.status).toBe(404)

    const updateResponse = await api
      .patch(`/customers/${customer.id}`)
      .set("Cookie", adminCookie)
      .send({ businessName: "Should Not Update" })

    expect(updateResponse.status).toBe(404)

    const newOrderResponse = await api
      .post("/orders")
      .set("Cookie", adminCookie)
      .send({
        customer_id: customer.id,
        line_items: [
          {
            item_type: "non_stock_item",
            non_stock_item_id: nonStockItem.id,
            quantity: 1,
          },
        ],
      })

    expect(newOrderResponse.status).toBe(404)
    expect(newOrderResponse.body.error).toBe("Customer not found")

    const existingOrderResponse = await api
      .get(`/orders/${createOrderResponse.body.order.id}`)
      .set("Cookie", adminCookie)

    expect(existingOrderResponse.status).toBe(200)
    expect(existingOrderResponse.body.order.customer).toMatchObject({
      id: customer.id,
      business_name: "Archived Customer",
    })
  })
})
