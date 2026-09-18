import { NextResponse } from "next/server";
import { benchmarkByLevel, listLabRuns } from "@/lib/lab/runStore";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      formula:
        "AutomationCost = timeToSolveMs/1000 + 0.5*actions + 0.1*framesObserved",
      benchmarks: benchmarkByLevel(),
      totalRuns: listLabRuns().length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
