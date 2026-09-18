import { expect, test } from "@playwright/test";

type MotionSegment = { endMs: number; velocity: { x: number; y: number } };
type RenderObject = { id: string; segments: MotionSegment[]; start: { x: number; y: number } };

function countDirectionChanges(segments: MotionSegment[]): number {
  if (segments.length <= 1) return 0;
  let changes = 0;
  for (let i = 1; i < segments.length; i += 1) {
    const prev = segments[i - 1]!.velocity;
    const curr = segments[i]!.velocity;
    const a1 = Math.atan2(prev.y, prev.x);
    const a2 = Math.atan2(curr.y, curr.x);
    let delta = Math.abs(a2 - a1);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    if (delta > Math.PI / 6) changes += 1;
  }
  return changes;
}

function derive(objects: RenderObject[], required: number): string {
  const match = objects.find(
    (o) => countDirectionChanges(o.segments) === required,
  );
  if (!match) throw new Error("derive failed");
  return match.id;
}

/**
 * Attack 8: Playwright automation solves without intended human visual interaction.
 * Derives answer from intercepted API payload, then verifies via API (no watching).
 */
test.describe("red-team Playwright offline solve", () => {
  test("solve via API only after intercepting challenge (no visual reasoning)", async ({
    request,
  }) => {
    const created = await request.post("/api/challenge", {
      data: { difficulty: 1 },
    });
    expect(created.ok()).toBeTruthy();
    const challenge = await created.json();
    expect(challenge).not.toHaveProperty("groundTruth");

    const t0 = Date.now();
    const correctId = derive(
      challenge.renderConfiguration.objects,
      challenge.renderConfiguration.requiredDirectionChanges,
    );
    const verify = await request.post("/api/verify", {
      data: {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: correctId,
        telemetry: {
          completionTimeMs: 10,
          interactionEventCount: 0,
          events: [],
        },
      },
    });
    const elapsed = Date.now() - t0;
    const body = await verify.json();
    expect(body.verified).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  });

  test("solve in browser UI by clicking derived object (no watching animation)", async ({
    page,
  }) => {
    let challengePayload: {
      renderConfiguration: {
        requiredDirectionChanges: number;
        objects: RenderObject[];
        width: number;
        height: number;
      };
    } | null = null;

    await page.route("**/api/challenge", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      challengePayload = json;
      await route.fulfill({ response, json });
    });

    await page.goto("/demo");
    await expect.poll(() => challengePayload !== null).toBeTruthy();

    const required =
      challengePayload!.renderConfiguration.requiredDirectionChanges;
    const correctId = derive(
      challengePayload!.renderConfiguration.objects,
      required,
    );
    const object = challengePayload!.renderConfiguration.objects.find(
      (o) => o.id === correctId,
    )!;

    const canvas = page.getByTestId("temporal-canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const scaleX = box!.width / challengePayload!.renderConfiguration.width;
    const scaleY = box!.height / challengePayload!.renderConfiguration.height;

    // Click start position immediately — do not wait to "observe" motion
    await page.mouse.click(
      box!.x + object.start.x * scaleX,
      box!.y + object.start.y * scaleY,
    );
    await expect(page.getByTestId("selection-label")).toContainText(correctId);
    await page.getByTestId("verify-button").click();
    await expect(page.getByTestId("verify-status")).toContainText("Verified", {
      timeout: 10_000,
    });
  });
});
