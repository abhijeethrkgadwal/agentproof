import { NextResponse } from "next/server";
import { benchmarkByLevel, listLabRuns } from "@/lib/lab/runStore";
import { listAttackRuns, summarizeAttackRuns } from "@/lib/lab/attackStore";
import { AUTOMATION_COST_FORMULA } from "@/lib/lab/types";
import { aggregateStudyAttempts } from "@/lib/study/aggregate";
import { listStudyAttemptsInternal } from "@/lib/study/store";

export const runtime = "nodejs";

export async function GET() {
  const automatedLevels = [
    "l1_api_observer",
    "l2_browser",
    "l3_vision",
    "lab_v2",
  ] as const;

  return NextResponse.json(
    {
      formula: AUTOMATION_COST_FORMULA,
      disclaimer:
        "Automation Cost is a normalized experimental metric - not a universal security score.",
      humanObservations: {
        source: "study",
        label: "Observational pilot - not a scientific human-performance study.",
        aggregate: aggregateStudyAttempts(listStudyAttemptsInternal()),
        // Synthetic lab "human" rows are excluded from this block on purpose.
        syntheticPlaceholderBenchmarks: benchmarkByLevel(["human"]),
      },
      automatedAttacks: {
        benchmarks: benchmarkByLevel([...automatedLevels]),
        labV2: summarizeAttackRuns(listAttackRuns()),
      },
      // Flat list kept for older clients
      benchmarks: benchmarkByLevel(),
      totalRuns: listLabRuns().length,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
