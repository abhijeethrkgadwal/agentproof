import { expect, test, type APIRequestContext } from "@playwright/test";

async function createChallenge(request: APIRequestContext) {
  const response = await request.post("/api/challenge", {
    data: { difficulty: 1 },
  });
  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  expect(json).not.toHaveProperty("groundTruth");
  expect(json).not.toHaveProperty("renderConfiguration");
  expect(JSON.stringify(json)).not.toContain("segments");
  return json;
}

test.describe("AgentProof e2e (Phase 3)", () => {
  test("landing and demo pages render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "AgentProof" })).toBeVisible();
    await page.getByRole("link", { name: "Try Demo" }).click();
    await expect(page.getByTestId("demo-link-temporal")).toBeVisible();
    await page.getByTestId("demo-link-temporal").click();
    await expect(page.getByTestId("challenge-widget")).toBeVisible();
    await expect(page.getByTestId("start-challenge")).toBeVisible();
  });

  test("issued payload has no motion segments", async ({ request }) => {
    const challenge = await createChallenge(request);
    expect(challenge.lifecycle).toBe("issued");
    expect(challenge.scene.objects[0]).not.toHaveProperty("segments");
  });

  test("verify before start is rejected", async ({ request }) => {
    const challenge = await createChallenge(request);
    const response = await request.post("/api/verify", {
      data: {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: challenge.scene.objects[0].id,
        telemetry: {},
      },
    });
    // Without completing start+active window
    expect([403, 409]).toContain(response.status());
  });

  test("incorrect selection after active window", async ({ request }) => {
    const challenge = await createChallenge(request);
    const start = await request.post("/api/challenge/start", {
      data: { challengeId: challenge.challengeId, token: challenge.token },
    });
    expect(start.ok()).toBeTruthy();

    // Wait for min active (~85% of duration). Duration is 5000ms → ~4.3s
    await new Promise((r) => setTimeout(r, 4500));

    const response = await request.post("/api/verify", {
      data: {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: challenge.scene.objects[0].id,
        telemetry: {
          completionTimeMs: 4500,
          interactionEventCount: 4,
        },
      },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    // May be verified true by luck if object_1 is correct — assert shape only if false
    expect(typeof body.verified).toBe("boolean");
    if (!body.verified) {
      expect(body.reason).toBe("incorrect_answer");
    }
  });

  test("replayed challenge", async ({ request }) => {
    const challenge = await createChallenge(request);
    await request.post("/api/challenge/start", {
      data: { challengeId: challenge.challengeId, token: challenge.token },
    });
    await new Promise((r) => setTimeout(r, 4500));

    // Exhaust challenge with a verify attempt
    const first = await request.post("/api/verify", {
      data: {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: challenge.scene.objects[0].id,
        telemetry: { completionTimeMs: 4500, interactionEventCount: 3 },
      },
    });
    expect(first.ok()).toBeTruthy();

    const second = await request.post("/api/verify", {
      data: {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: challenge.scene.objects[0].id,
        telemetry: {},
      },
    });
    expect(second.status()).toBe(409);
    expect((await second.json()).error).toBe("replay");
  });

  test("tampered challenge token", async ({ request }) => {
    const challenge = await createChallenge(request);
    const [body] = challenge.token.split(".");
    const tampered = `${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const response = await request.post("/api/verify", {
      data: {
        challengeId: challenge.challengeId,
        token: tampered,
        selectedObjectId: challenge.scene.objects[0].id,
      },
    });
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("invalid_signature");
  });

  test("expired challenge rejected (unit-covered; smoke session binding)", async ({
    request,
  }) => {
    const challenge = await createChallenge(request);
    expect(new Date(challenge.expiresAt).getTime()).toBeGreaterThan(Date.now());
    // Session-less verify must fail even if token is otherwise valid
    // (Playwright APIRequestContext may or may not store cookies — assert security reject)
    const response = await request.post("/api/verify", {
      headers: { cookie: "" },
      data: {
        challengeId: challenge.challengeId,
        token: challenge.token,
        selectedObjectId: challenge.scene.objects[0].id,
        telemetry: {},
      },
    });
    expect([403, 409]).toContain(response.status());
  });

  test("health endpoint", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      service: "agentproof",
    });
    expect(body.label).toContain("not production security");
  });

  test("human path UI: start reveals canvas poses", async ({ page }) => {
    await page.goto("/demo/temporal");
    await page.getByTestId("start-challenge").click();
    await expect(page.getByTestId("temporal-canvas")).toBeVisible();
    await expect(page.getByTestId("elapsed-label")).toBeVisible();
  });

  test("v0.2 natural challenge demos render", async ({ page }) => {
    for (const path of ["/demo/drag-avoid", "/demo/physical", "/demo/dynamic-path"]) {
      await page.goto(path);
      await expect(page.getByTestId("start-challenge")).toBeVisible();
    }
    await page.goto("/challenge-lab");
    await expect(page.getByTestId("lab-row-temporal")).toBeVisible();
    await expect(page.getByTestId("lab-row-drag_avoid")).toBeVisible();
  });
});
