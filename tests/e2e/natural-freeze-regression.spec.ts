/**
 * Smoke: second-run obstacle/gate motion must change canvas pixels over time.
 * Run: npx playwright test tests/e2e/natural-freeze-regression.spec.ts
 */
import { expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const OUT = "/opt/cursor/artifacts/screenshots";

async function assertCanvasMotion(page: import("@playwright/test").Page, canvasTestId: string) {
  const canvas = page.getByTestId(canvasTestId);
  await expect(canvas).toBeVisible();
  const a = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  await page.waitForTimeout(350);
  const b = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  expect(a).not.toEqual(b);
}

test.describe("natural challenge freeze regression", () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true });
  });

  test("drag-avoid obstacles keep moving on second New challenge", async ({
    page,
  }) => {
    await page.goto("/demo/drag-avoid");
    await page.getByTestId("start-challenge").click();
    await assertCanvasMotion(page, "drag-avoid-canvas");
    await page.screenshot({
      path: path.join(OUT, "drag-avoid-run1.png"),
      fullPage: true,
    });

    await page.getByTestId("reload-challenge").click();
    await expect(page.getByTestId("start-challenge")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("start-challenge").click();
    await assertCanvasMotion(page, "drag-avoid-canvas");
    await page.screenshot({
      path: path.join(OUT, "drag-avoid-run2.png"),
      fullPage: true,
    });

    // Verify unlocks after ~1.2s even without finishing goal (samples needed —
    // use accessible nudges to generate samples quickly).
    await page.getByTestId("toggle-accessible").click();
    await page.getByRole("button", { name: "Right" }).click();
    await page.getByRole("button", { name: "Right" }).click();
    await page.waitForTimeout(1300);
    await expect(page.getByTestId("verify-button")).toBeEnabled({
      timeout: 5000,
    });
  });

  test("dynamic-path gates keep moving on second New challenge", async ({
    page,
  }) => {
    await page.goto("/demo/dynamic-path");
    await page.getByTestId("start-challenge").click();
    await assertCanvasMotion(page, "dynamic-path-canvas");
    await page.screenshot({
      path: path.join(OUT, "dynamic-path-run1.png"),
      fullPage: true,
    });

    await page.getByTestId("reload-challenge").click();
    await expect(page.getByTestId("start-challenge")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("start-challenge").click();
    await assertCanvasMotion(page, "dynamic-path-canvas");
    await page.screenshot({
      path: path.join(OUT, "dynamic-path-run2.png"),
      fullPage: true,
    });
  });
});
