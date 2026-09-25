import { NextResponse } from "next/server";
import { createVisionAgentStub } from "@/lib/lab/agents/l3VisionStub";

export const runtime = "nodejs";

/** L3 stub probe - confirms interface exists; does not run a model. */
export async function GET() {
  const agent = createVisionAgentStub();
  const decision = await agent.analyze({
    challengeId: "stub",
    instruction: "stub",
    difficulty: 1,
    frames: [],
  });
  return NextResponse.json(
    {
      level: "l3_vision",
      agent: { id: agent.id, status: agent.status },
      sampleDecision: decision,
      integrated: false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
