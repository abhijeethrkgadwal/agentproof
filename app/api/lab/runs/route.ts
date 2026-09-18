import { NextResponse } from "next/server";
import { z } from "zod";
import { runL1ApiObserver } from "@/lib/lab/agents/l1ApiObserver";
import { appendLabRun, listLabRuns } from "@/lib/lab/runStore";
import { computeAutomationCost } from "@/lib/lab/types";

export const runtime = "nodejs";

const HumanRunSchema = z.object({
  type: z.literal("human").optional(),
  difficulty: z.number().int().min(1).max(5).default(1),
  success: z.boolean(),
  timeToSolveMs: z.number().nonnegative(),
  apiCalls: z.number().int().nonnegative().default(0),
  framesObserved: z.number().int().nonnegative().default(0),
  actions: z.number().int().nonnegative().default(1),
  notes: z.string().optional(),
  challengeId: z.string().optional(),
});

const L1BatchSchema = z.object({
  type: z.literal("l1"),
  count: z.number().int().min(1).max(20).default(5),
  difficulty: z.number().int().min(1).max(5).default(1),
  baseUrl: z.string().url().optional(),
});

export async function GET() {
  return NextResponse.json(
    { runs: listLabRuns() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const asObj = body as { type?: string };

  if (asObj.type === "l1") {
    const parsed = L1BatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
    }
    const origin = new URL(request.url).origin;
    const baseUrl = parsed.data.baseUrl ?? origin;
    const runs = [];
    for (let i = 0; i < parsed.data.count; i += 1) {
      const result = await runL1ApiObserver({
        baseUrl,
        difficulty: parsed.data.difficulty,
      });
      runs.push(appendLabRun(result));
    }
    return NextResponse.json(
      { runs },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Default: record a human (or manual) baseline run
  const parsed = HumanRunSchema.safeParse({
    ...((body as object) ?? {}),
    type: "human",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_fields", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const run = appendLabRun({
    level: "human",
    difficulty: data.difficulty,
    challengeId: data.challengeId,
    status: data.success ? "success" : "failure",
    success: data.success,
    timeToSolveMs: data.timeToSolveMs,
    apiCalls: data.apiCalls,
    framesObserved: data.framesObserved,
    actions: data.actions,
    automationCost: computeAutomationCost({
      timeToSolveMs: data.timeToSolveMs,
      actions: data.actions,
      framesObserved: data.framesObserved,
    }),
    notes: data.notes ?? "manual/human baseline entry",
  });

  return NextResponse.json({ run }, { headers: { "Cache-Control": "no-store" } });
}
