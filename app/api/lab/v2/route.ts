import { NextResponse } from "next/server";
import { z } from "zod";
import {
  LAB_V2_ATTACKS,
  runAllLabV2Attacks,
  runLabV2Attack,
} from "@/lib/lab/attacks";
import { listAttackRuns, summarizeAttackRuns } from "@/lib/lab/attackStore";
import type { AttackName } from "@/lib/lab/types";

export const runtime = "nodejs";

const RunSchema = z.object({
  attack: z
    .enum([
      "frame_reconstruction_v2",
      "polling_optimisation",
      "timing_attack",
      "direct_api_attack",
      "state_inference",
      "replay_tampering",
      "all",
    ])
    .default("all"),
  difficulty: z.number().int().min(1).max(5).default(1),
  baseUrl: z.string().url().optional(),
});

export async function GET() {
  const runs = listAttackRuns();
  return NextResponse.json(
    {
      attacks: LAB_V2_ATTACKS,
      summary: summarizeAttackRuns(runs),
      runs: runs.slice(0, 100),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = RunSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const baseUrl = parsed.data.baseUrl ?? origin;
  const difficulty = parsed.data.difficulty;

  if (parsed.data.attack === "all") {
    const runs = await runAllLabV2Attacks({ baseUrl, difficulty });
    return NextResponse.json(
      { runs, summary: summarizeAttackRuns(runs) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const run = await runLabV2Attack(parsed.data.attack as AttackName, {
    baseUrl,
    difficulty,
  });
  return NextResponse.json(
    { runs: [run] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
