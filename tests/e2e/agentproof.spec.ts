import { expect, test, type APIRequestContext } from "@playwright/test";

type MotionSegment = { endMs: number; velocity: { x: number; y: number } };
type RenderObject = {
  id: string;
  start: { x: number; y: number };
  size: number;
  segments: MotionSegment[];
};

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

function findCorrectObject(objects: RenderObject[], required: number): string {
  const match = objects.find(
    (object) => countDirectionChanges(object.segments) === required,
  );
  if (!match) {
    throw new Error("Could not derive correct object from render config");
  }
  return match.id;
}

async function createChallenge(request: APIRequestContext) {
  const response = await request.post("/api/challenge", {
    data: { difficulty: 1 },
  });
  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  expect(json).not.toHaveProperty("groundTruth");
  return json;
}

test.describe("AgentProof e2e", () => {
  test("landing and demo pages render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "AgentProof" })).toBeVisible();
    await page.getByRole("link", { name: "Try Demo" }).click();
    await expect(page.getByTestId("challenge-widget")).toBeVisible();
    await expect(page.getByTestId("temporal-canvas")).toBeVisible();
  });

  test("normal successful interaction", async ({ page }) => {
    let challengePayload: {
      challengeId: string;
      token: string;
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
    await expect(page.getByTestId("temporal-canvas")).toBeVisible();
    await expect.poll(() => challengePayload !== null).toBeTruthy();

    const required =
      challengePayload!.renderConfiguration.requiredDirectionChanges;
    const correctId = findCorrectObject(
      challengePayload!.renderConfiguration.objects,
      required,
    );
    const object = challengePayload!.renderConfiguration.objects.find(
      (o) => o.id === correctId,
    )!;

    const canvas = page.getByTestId("temporal-canvas");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const scaleX = box!.width / challengePayload!.renderConfiguration.width;
    const scaleY = box!.height / challengePayload!.renderConfiguration.height;

    // Click near start position promptly (objects move; retry a few frames)
    let selected = false;
    for (let attempt = 0; attempt < 8 && !selected; attempt += 1) {
      await page.mouse.click(
        box!.x + object.start.x * scaleX,
        box!.y + object.start.y * scaleY,
      );
      const label = await page.getByTestId("selection-label").textContent();
      if (label?.includes(correctId)) selected = true;
      else await page.waitForTimeout(120);
    }
    expect(selected).toBeTruthy();

    await page.getByTestId("verify-button").click();
    await expect(page.getByTestId("verify-status")).toContainText("Verified", {
      timeout: 10_000,
    });
  });

  test("incorrect selection", async ({ request }) => {
    const challenge = await createChallenge(request);
    const required = challenge.renderConfiguration.requiredDirectionChanges;
    const correct = findCorrectObject(
      challenge.renderConfiguration.objects,
      required,
    );
    const wrong = challenge.renderConfiguration.objects.find(
      (o: RenderObject) => o.id !== correct,
    )!.id;

    const response = await request.post("/api/verify", {
      data: {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: wrong,
        telemetry: {
          completionTimeMs: 5000,
          interactionEventCount: 4,
        },
      },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.verified).toBe(false);
    expect(body.reason).toBe("incorrect_answer");
  });

  test("expired challenge", async ({ request }) => {
    // Server under Playwright uses AGENTPROOF_CHALLENGE_TTL_MS=8000.
    const challenge = await createChallenge(request);
    const required = challenge.renderConfiguration.requiredDirectionChanges;
    const correct = findCorrectObject(
      challenge.renderConfiguration.objects,
      required,
    );

    await new Promise((resolve) => setTimeout(resolve, 8500));

    const response = await request.post("/api/verify", {
      data: {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: correct,
        telemetry: { completionTimeMs: 100, interactionEventCount: 1 },
      },
    });
    expect(response.status()).toBe(410);
    expect((await response.json()).error).toBe("challenge_expired");
  });

  test("replayed challenge", async ({ request }) => {
    const challenge = await createChallenge(request);
    const required = challenge.renderConfiguration.requiredDirectionChanges;
    const correct = findCorrectObject(
      challenge.renderConfiguration.objects,
      required,
    );
    const first = await request.post("/api/verify", {
      data: {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: correct,
        telemetry: { completionTimeMs: 5600, interactionEventCount: 6 },
      },
    });
    expect((await first.json()).verified).toBe(true);

    const second = await request.post("/api/verify", {
      data: {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: correct,
        telemetry: {},
      },
    });
    expect(second.status()).toBe(409);
    expect((await second.json()).error).toBe("replay");
  });

  test("tampered challenge token", async ({ request }) => {
    const challenge = await createChallenge(request);
    const required = challenge.renderConfiguration.requiredDirectionChanges;
    const correct = findCorrectObject(
      challenge.renderConfiguration.objects,
      required,
    );
    const [body] = challenge.token.split(".");
    const tampered = `${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const response = await request.post("/api/verify", {
      data: {
        challengeId: challenge.challengeId,
        token: tampered,
        selectedObjectId: correct,
      },
    });
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("invalid_signature");
  });

  test("health endpoint", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(await response.json()).toEqual({
      status: "ok",
      service: "agentproof",
    });
  });
});
