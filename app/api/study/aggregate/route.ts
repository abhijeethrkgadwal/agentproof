import { NextResponse } from "next/server";
import { aggregateStudyAttempts } from "@/lib/study/aggregate";
import { listStudyAttemptsInternal } from "@/lib/study/store";

export const runtime = "nodejs";

/**
 * Aggregate-only study stats. Never exposes individual participant rows.
 */
export async function GET() {
  const aggregate = aggregateStudyAttempts(listStudyAttemptsInternal());
  return NextResponse.json(
    { aggregate },
    { headers: { "Cache-Control": "no-store" } },
  );
}
