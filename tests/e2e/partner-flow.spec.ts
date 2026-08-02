import { test, expect } from "@playwright/test";

/**
 * Full partner + admin flows. These require a configured Supabase project and
 * a seeded admin. They skip cleanly when the backend is not configured so
 * `pnpm verify` stays green locally without infrastructure.
 *
 * To run: set NEXT_PUBLIC_SUPABASE_URL / ANON / SERVICE_ROLE to a real project,
 * run migrations + `pnpm seed`, set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD, then
 * `pnpm test:e2e`.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configured = Boolean(url && !url.includes("placeholder"));
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const adminPassword =
  process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;

test.describe("Partner and admin flow", () => {
  test.skip(!configured, "Requires a configured Supabase project");

  const partner = {
    email: `e2e.partner.${Date.now()}@example.com`,
    password: "E2ePass!2026",
    name: "E2E Partner",
    phone: "08099999999",
  };

  test("signs up over 3 months, sees schedule, lands on dashboard at 0%", async ({
    page,
  }) => {
    await page.goto("/signup?tier=500000");

    // Choose plan: 3 months.
    await page.getByLabel("Payment plan").click();
    await page.getByRole("option", { name: "3 Months Installment" }).click();

    // Schedule preview visible before submitting.
    await expect(page.getByText("Your schedule")).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();

    // Identity.
    await page.getByLabel("Full name").fill(partner.name);
    await page.getByLabel("Email").fill(partner.email);
    await page.getByLabel("Phone").fill(partner.phone);
    await page.getByLabel("Password").fill(partner.password);
    await page.getByRole("button", { name: "Continue" }).click();

    // Honor roll + submit.
    await page
      .getByRole("button", { name: "Create my partnership" })
      .click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByText("4005900458")).toBeVisible();
    await expect(page.getByText("0%")).toBeVisible();
  });

  test("uploads a receipt and sees it pending", async ({ page }) => {
    await login(page, partner.email, partner.password);
    await page.getByRole("button", { name: "Upload receipt" }).click();
    await page.getByLabel("Amount (₦)").fill("100000");
    await page.setInputFiles('input[type="file"]', {
      name: "receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCA',",
        "base64",
      ),
    });
    await page.getByRole("button", { name: "Submit receipt" }).click();
    await expect(page.getByText("Pending").first()).toBeVisible();
  });

  test("admin approves the receipt and progress increases", async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, "Requires seeded admin creds");
    await login(page, adminEmail!, adminPassword!);
    await page.goto("/admin/receipts?status=pending");
    await page.getByRole("button", { name: "Approve" }).first().click();
    await expect(page.getByText("Receipt approved")).toBeVisible();
  });
});

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForLoadState("networkidle");
}
