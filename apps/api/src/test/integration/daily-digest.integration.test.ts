import { asc, eq } from "drizzle-orm"
import { describe, expect, test } from "vitest"

import * as schema from "../../db/schema/index.js"
import { DailyDigestAggregationRepository } from "../../modules/notifications/daily-digest-aggregation.repository.js"
import { DailyDigestAggregationService } from "../../modules/notifications/daily-digest-aggregation.service.js"
import { DailyDigestRecipientResolver } from "../../modules/notifications/daily-digest-recipient-resolver.js"
import { DailyDigestRunner } from "../../modules/notifications/daily-digest-runner.js"
import { DailyDigestRepository } from "../../modules/notifications/daily-digest.repository.js"
import { UsersRepository } from "../../modules/users/users.repository.js"
import { seedCup, seedCustomer } from "./fixtures.js"
import { getIntegrationDb, integrationAdmin, useIntegrationHarness } from "./harness.js"

describe("daily digest runner integration", () => {
  useIntegrationHarness()

  test("runner sends once, records attempts, and does not duplicate on rerun", async () => {
    const db = await getIntegrationDb()
    const [adminUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, integrationAdmin.email))
      .limit(1)

    expect(adminUser).toBeDefined()

    const customer = await seedCustomer()
    const cup = await seedCup({ minStock: 10 })
    const businessDate = "2026-04-28"
    const businessWindowStart = new Date("2026-04-27T16:00:00.000Z")
    const businessWindowMidpoint = new Date("2026-04-28T08:30:00.000Z")
    const businessWindowEnd = new Date("2026-04-28T15:59:00.000Z")

    const [order] = await db
      .insert(schema.orders)
      .values({
        orderNumber: "DIGEST-ORDER-001",
        customerId: customer.id,
        status: "pending",
        createdByUserId: adminUser?.id,
        createdAt: businessWindowMidpoint,
        updatedAt: businessWindowEnd,
      })
      .returning()

    expect(order).toBeDefined()

    await db.insert(schema.inventoryMovements).values({
      itemType: "cup",
      cupId: cup.id,
      movementType: "stock_in",
      quantity: 5,
      createdByUserId: adminUser?.id,
      createdAt: businessWindowStart,
    })

    const [invoice] = await db
      .insert(schema.invoices)
      .values({
        invoiceNumber: "DIGEST-INV-001",
        orderId: order!.id,
        orderNumberSnapshot: order!.orderNumber,
        customerId: customer.id,
        customerBusinessNameSnapshot: customer.businessName,
        customerContactPersonSnapshot: customer.contactPerson,
        customerContactNumberSnapshot: customer.contactNumber,
        customerEmailSnapshot: customer.email,
        customerAddressSnapshot: customer.address,
        status: "pending",
        subtotal: "500.00",
        totalAmount: "500.00",
        paidAmount: "250.00",
        remainingBalance: "250.00",
        createdByUserId: adminUser?.id,
        createdAt: businessWindowMidpoint,
        updatedAt: businessWindowEnd,
      })
      .returning()

    expect(invoice).toBeDefined()

    await db.insert(schema.invoicePayments).values({
      invoiceId: invoice!.id,
      amount: "250.00",
      paymentDate: businessWindowEnd,
      createdByUserId: adminUser?.id,
    })

    const sentTo: string[] = []

    const runner = new DailyDigestRunner({
      env: {
        emailProvider: "resend",
        resendApiKey: "test-key",
        resendFromEmail: "ops@inkwave.test",
        resendReplyToEmail: undefined,
        webOrigin: "https://app.inkwave.test",
      },
      repository: new DailyDigestRepository(db),
      aggregationService: new DailyDigestAggregationService(
        new DailyDigestAggregationRepository(db),
      ),
      recipientResolver: new DailyDigestRecipientResolver(new UsersRepository(db)),
      emailProvider: {
        async sendEmail(options) {
          sentTo.push(Array.isArray(options.to) ? options.to.join(",") : options.to)
          return {
            id: `email_${sentTo.length}`,
            provider: "resend" as const,
          }
        },
      },
      now: () => new Date("2026-04-28T09:30:00.000Z"),
    })

    const firstRun = await runner.runForBusinessDate(businessDate)
    const secondRun = await runner.runForBusinessDate(businessDate)

    expect(firstRun.status).toBe("succeeded")
    expect(firstRun.sentCount).toBe(1)
    expect(secondRun.status).toBe("already_succeeded")
    expect(sentTo).toEqual([integrationAdmin.email])

    const runs = await db.select().from(schema.notificationDigestRuns)
    const deliveries = await db.select().from(schema.notificationDigestDeliveries)
    const attempts = await db.select().from(schema.notificationDigestDeliveryAttempts)

    expect(runs).toHaveLength(1)
    expect(runs[0]?.status).toBe("succeeded")
    expect(runs[0]?.businessDate).toBe(businessDate)
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]?.status).toBe("sent")
    expect(deliveries[0]?.attemptCount).toBe(1)
    expect(deliveries[0]?.recipientEmail).toBe(integrationAdmin.email)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.status).toBe("sent")
    expect(attempts[0]?.attemptNumber).toBe(1)

    const thirdRun = await runner.runForBusinessDate(businessDate, { forceResend: true })

    expect(thirdRun.status).toBe("succeeded")
    expect(sentTo).toEqual([
      integrationAdmin.email,
      integrationAdmin.email,
    ])

    const attemptsAfterResend = await db
      .select()
      .from(schema.notificationDigestDeliveryAttempts)
      .orderBy(asc(schema.notificationDigestDeliveryAttempts.attemptNumber))

    expect(attemptsAfterResend).toHaveLength(2)
    expect(attemptsAfterResend[0]?.attemptNumber).toBe(1)
    expect(attemptsAfterResend[1]?.attemptNumber).toBe(2)
  })
})
