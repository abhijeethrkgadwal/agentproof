import { expect, test } from "@playwright/test";

test.describe("Phase 6 study + accessible", () => {
  test("study consent and anonymous id flow", async ({ page }) => {
    await page.goto("/study");
    await expect(page.getByTestId("study-consent")).toBeVisible();
    await expect(
      page.getByText("Observational pilot - not a scientific human-performance study.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByTestId("study-consent-check").check();
    await page.getByTestId("study-consent-continue").click();
    await page.getByTestId("study-participant-id").fill("pilot_e2e_1");
    await page.getByTestId("study-start-pilot").click();
    await expect(page.getByTestId("study-start-challenge")).toBeVisible();
  });

  test("accessible demo renders and issues challenge", async ({ page }) => {
    await page.goto("/demo/accessible");
    await expect(
      page.getByRole("heading", { name: "Watch, then choose" }),
    ).toBeVisible();
    await expect(
      page.getByText("Not a WCAG certification", { exact: false }),
    ).toBeVisible();
    await expect(page.getByTestId("a11y-start")).toBeVisible({ timeout: 10000 });
  });

  test("lab dashboard separates human and automated sections", async ({
    page,
  }) => {
    await page.goto("/lab");
    await expect(page.getByTestId("human-observations")).toBeVisible();
    await expect(page.getByTestId("automated-attacks")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "HUMAN OBSERVATIONS" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "AUTOMATED ATTACKS" }),
    ).toBeVisible();
  });
});
