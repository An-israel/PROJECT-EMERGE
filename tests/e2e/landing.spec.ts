import { test, expect } from "@playwright/test";

/**
 * These run without a database — the landing page falls back to seeded
 * campaign constants, so they always execute in `pnpm verify`.
 */
test.describe("Landing page", () => {
  test("shows the campaign but never a total raised", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Project Emerge" }).first(),
    ).toBeVisible();
    await expect(page.getByText("Building Together. Rising Visibly.")).toBeVisible();

    // No total raised anywhere on the public page.
    const body = (await page.textContent("body"))?.toLowerCase() ?? "";
    expect(body).not.toContain("total raised");
    expect(body).not.toContain("raised so far");
    // The goal figure must not be exposed publicly.
    expect(body).not.toContain("100,000,000");
    expect(body).not.toContain("of ₦100,000,000");
  });

  test("clicking a tier carries it into sign up", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page
      .getByRole("link", { name: "Partner at this level" })
      .first()
      .click();
    await page.waitForURL(/\/signup\?tier=/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Become a Partner" }),
    ).toBeVisible();
  });

  test("hero and closing CTAs lead to sign up", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Become a Partner" }).first(),
    ).toHaveAttribute("href", "/signup");
  });
});
