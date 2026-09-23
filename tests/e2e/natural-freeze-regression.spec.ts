/**
 * Smoke: second-run obstacle/gate motion must change canvas pixels over time,
 * including after a first full run that would exhaust the old 60/min frame budget.
 */
import { expect, test } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const OUT = "/opt/cursor/artifacts/screenshots";

async function assertCanvasMotion(
  page: import("@playwright/test").Page,
  canvasTestId: string,
  samples = 3,
) {
  const canvas = page.getByTestId(canvasTestId);
  await expect(canvas).toBeVisible();
  let prev = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  let changes = 0;
  for (let i = 0; i < samples; i += 1) {
    await page.waitForTimeout(280);
    const next = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
    if (next !== prev) changes += 1;
    prev = next;
  }
  expect(changes).toBeGreaterThanOrEqual(2);
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
    // Burn ~4s of frame polls like a human first attempt
    await assertCanvasMotion(page, "drag-avoid-canvas", 4);
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: path.join(OUT, "drag-avoid-run1.png"),
      fullPage: true,
    });

    await page.getByTestId("reload-challenge").click();
    await expect(page.getByTestId("start-challenge")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("start-challenge").click();
    await assertCanvasMotion(page, "drag-avoid-canvas", 4);
    await page.screenshot({
      path: path.join(OUT, "drag-avoid-run2.png"),
      fullPage: true,
    });

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
    await assertCanvasMotion(page, "dynamic-path-canvas", 4);
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: path.join(OUT, "dynamic-path-run1.png"),
      fullPage: true,
    });

    await page.getByTestId("reload-challenge").click();
    await expect(page.getByTestId("start-challenge")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("start-challenge").click();
    await assertCanvasMotion(page, "dynamic-path-canvas", 4);
    await page.screenshot({
      path: path.join(OUT, "dynamic-path-run2.png"),
      fullPage: true,
    });
  });
});
