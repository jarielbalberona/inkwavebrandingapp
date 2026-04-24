import { describe, expect, it } from "vitest"

import {
  getAdminSessionCookie,
  getIntegrationRequest,
  getStaffSessionCookie,
  useIntegrationHarness,
} from "./harness.js"
import {
  seedCup,
  seedCustomer,
  seedNonStockItem,
} from "./fixtures.js"

describe("authorization integration", () => {
  useIntegrationHarness()

  it("rejects staff on admin-only stock intake", async () => {
    const api = await getIntegrationRequest()
    const staffCookie = await getStaffSessionCookie()
    const adminCookie = await getAdminSessionCookie()
    const cup = await seedCup()

    const staffResponse = await api
      .post("/inventory/stock-intake")
      .set("Cookie", staffCookie)
      .send({
        itemType: "cup",
        cupId: cup.id,
        quantity: 10,
      })

    expect(staffResponse.status).toBe(403)
    expect(staffResponse.body.error).toBe("Admin role required")

    const adminResponse = await api
      .post("/inventory/stock-intake")
      .set("Cookie", adminCookie)
      .send({
        itemType: "cup",
        cupId: cup.id,
        quantity: 10,
      })

    expect(adminResponse.status).toBe(201)
  })

  it("returns customer contact data only to admins", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const staffCookie = await getStaffSessionCookie()
    const customer = await seedCustomer({
      customerCode: "AUTH-CUST-001",
      businessName: "Authorization Customer",
      contactPerson: "Private Contact",
      contactNumber: "09171234567",
      email: "private.customer@inkwave.test",
      address: "Hidden Address",
      notes: "Hidden Notes",
    })

    const adminResponse = await api
      .get(`/customers/${customer.id}`)
      .set("Cookie", adminCookie)

    expect(adminResponse.status).toBe(200)
    expect(adminResponse.body.customer).toMatchObject({
      id: customer.id,
      customer_code: "AUTH-CUST-001",
      business_name: "Authorization Customer",
      contact_person: "Private Contact",
      contact_number: "09171234567",
      email: "private.customer@inkwave.test",
      address: "Hidden Address",
      notes: "Hidden Notes",
    })

    const staffResponse = await api
      .get(`/customers/${customer.id}`)
      .set("Cookie", staffCookie)

    expect(staffResponse.status).toBe(200)
    expect(staffResponse.body.customer).toMatchObject({
      id: customer.id,
      customer_code: "AUTH-CUST-001",
      business_name: "Authorization Customer",
    })
    expect(staffResponse.body.customer).not.toHaveProperty("contact_person")
    expect(staffResponse.body.customer).not.toHaveProperty("contact_number")
    expect(staffResponse.body.customer).not.toHaveProperty("email")
    expect(staffResponse.body.customer).not.toHaveProperty("address")
    expect(staffResponse.body.customer).not.toHaveProperty("notes")
  })

  it("returns order pricing only to admins", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const staffCookie = await getStaffSessionCookie()
    const customer = await seedCustomer({
      businessName: "Order Authorization Customer",
      contactPerson: "Order Contact",
      email: "order.customer@inkwave.test",
    })
    const nonStockItem = await seedNonStockItem({
      name: "Authorization Layout Fee",
      costPrice: "4.00",
      defaultSellPrice: "12.50",
    })

    const createOrderResponse = await api
      .post("/orders")
      .set("Cookie", adminCookie)
      .send({
        customer_id: customer.id,
        line_items: [
          { item_type: "non_stock_item", non_stock_item_id: nonStockItem.id, quantity: 2 },
        ],
      })

    expect(createOrderResponse.status).toBe(201)

    const orderId = createOrderResponse.body.order.id as string

    const adminOrderResponse = await api
      .get(`/orders/${orderId}`)
      .set("Cookie", adminCookie)

    expect(adminOrderResponse.status).toBe(200)
    expect(adminOrderResponse.body.order.customer.contact_person).toBe("Order Contact")
    expect(adminOrderResponse.body.order.customer.email).toBe("order.customer@inkwave.test")
    expect(adminOrderResponse.body.order.items[0]).toMatchObject({
      item_type: "non_stock_item",
      unit_cost_price: "4.00",
      unit_sell_price: "12.50",
    })

    const staffOrderResponse = await api
      .get(`/orders/${orderId}`)
      .set("Cookie", staffCookie)

    expect(staffOrderResponse.status).toBe(200)
    expect(staffOrderResponse.body.order.customer).not.toHaveProperty("contact_person")
    expect(staffOrderResponse.body.order.customer).not.toHaveProperty("email")
    expect(staffOrderResponse.body.order.items[0]).not.toHaveProperty("unit_cost_price")
    expect(staffOrderResponse.body.order.items[0]).not.toHaveProperty("unit_sell_price")
  })

  it("rejects staff when creating orders with custom_charge line items", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const staffCookie = await getStaffSessionCookie()
    const customer = await seedCustomer({
      businessName: "Custom Charge Authorization Customer",
    })

    const staffResponse = await api
      .post("/orders")
      .set("Cookie", staffCookie)
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

    expect(staffResponse.status).toBe(403)
    expect(staffResponse.body.error).toBe("Admin role required")

    const adminResponse = await api
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

    expect(adminResponse.status).toBe(201)
    expect(adminResponse.body.order.items[0]).toMatchObject({
      item_type: "custom_charge",
      description_snapshot: "Rush fee",
      unit_sell_price: "500.00",
    })
  })

  it("rejects staff on invoice routes while preserving admin access", async () => {
    const api = await getIntegrationRequest()
    const adminCookie = await getAdminSessionCookie()
    const staffCookie = await getStaffSessionCookie()
    const customer = await seedCustomer({
      businessName: "Invoice Authorization Customer",
    })
    const nonStockItem = await seedNonStockItem({
      name: "Invoice Authorization Fee",
      costPrice: "2.00",
      defaultSellPrice: "9.50",
    })

    const createOrderResponse = await api
      .post("/orders")
      .set("Cookie", adminCookie)
      .send({
        customer_id: customer.id,
        line_items: [
          { item_type: "non_stock_item", non_stock_item_id: nonStockItem.id, quantity: 1 },
        ],
      })

    expect(createOrderResponse.status).toBe(201)

    const orderId = createOrderResponse.body.order.id as string

    const staffGenerateResponse = await api
      .post(`/orders/${orderId}/invoice`)
      .set("Cookie", staffCookie)

    expect(staffGenerateResponse.status).toBe(403)
    expect(staffGenerateResponse.body.error).toBe("Admin role required")

    const adminGenerateResponse = await api
      .post(`/orders/${orderId}/invoice`)
      .set("Cookie", adminCookie)

    expect(adminGenerateResponse.status).toBe(201)

    const invoiceId = adminGenerateResponse.body.invoice.id as string

    const adminListResponse = await api
      .get("/invoices")
      .set("Cookie", adminCookie)

    expect(adminListResponse.status).toBe(200)
    expect(adminListResponse.body.invoices).toHaveLength(1)

    const staffListResponse = await api
      .get("/invoices")
      .set("Cookie", staffCookie)

    expect(staffListResponse.status).toBe(403)
    expect(staffListResponse.body.error).toBe("Admin role required")

    const staffDetailResponse = await api
      .get(`/invoices/${invoiceId}`)
      .set("Cookie", staffCookie)

    expect(staffDetailResponse.status).toBe(403)
    expect(staffDetailResponse.body.error).toBe("Admin role required")

    const staffOrderInvoiceResponse = await api
      .get(`/orders/${orderId}/invoice`)
      .set("Cookie", staffCookie)

    expect(staffOrderInvoiceResponse.status).toBe(403)
    expect(staffOrderInvoiceResponse.body.error).toBe("Admin role required")

    const staffPdfResponse = await api
      .get(`/invoices/${invoiceId}/pdf`)
      .set("Cookie", staffCookie)

    expect(staffPdfResponse.status).toBe(403)
    expect(staffPdfResponse.body.error).toBe("Admin role required")

    const adminDetailResponse = await api
      .get(`/invoices/${invoiceId}`)
      .set("Cookie", adminCookie)

    expect(adminDetailResponse.status).toBe(200)
    expect(adminDetailResponse.body.invoice.id).toBe(invoiceId)
  })
})
