import { expect, test, type Page } from "@playwright/test"

const adminEmail = "admin.e2e@inkwave.test"
const adminPassword = "E2eAdminPassword123!"

test("admin can sign in and create a customer from the real UI", async ({ page }) => {
  await loginAsAdmin(page)

  await page.getByRole("link", { name: "Customers" }).click()
  await expect(page).toHaveURL(/\/customers$/)
  await expect(page.getByLabel("Search customers")).toBeVisible()

  await page.getByRole("button", { name: "Create Customer" }).click()
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Create Customer" })).toBeVisible()

  const suffix = Date.now().toString().slice(-6)
  const businessName = `E2E Customer ${suffix}`

  await page.getByLabel("Business name").fill(businessName)
  await page.getByLabel("Contact person").fill("E2E Browser Contact")
  await page.getByLabel("Contact number").fill("09175551234")
  await page.getByLabel("Email").fill(`customer-${suffix}@inkwave.test`)
  await page.getByLabel("Address").fill("E2E Browser Address")
  await page.getByLabel("Notes").fill("Created by Playwright smoke")

  await page.getByRole("button", { name: "Create Customer" }).click()

  await expect(page.getByText(businessName)).toBeVisible()
})

test("admin can open the seeded invoice detail page", async ({ page }) => {
  await loginAsAdmin(page)

  await page.getByRole("link", { name: "Invoices" }).click()
  await expect(page).toHaveURL(/\/invoices$/)
  await expect(page.getByLabel("Search invoices")).toBeVisible()
  await expect(page.getByText("E2E Invoice Customer")).toBeVisible()

  await page.getByRole("link", { name: "View" }).first().click()

  await expect(page).toHaveURL(/\/invoices\//)
  await expect(page.getByText("Invoice Detail")).toBeVisible()
  await expect(page.getByText("E2E Invoice Customer")).toBeVisible()
  await expect(page.getByText("Invoice Items")).toBeVisible()
})

async function loginAsAdmin(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(adminEmail)
  await page.getByLabel("Password").fill(adminPassword)
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText("Operational Notes")).toBeVisible()
}
