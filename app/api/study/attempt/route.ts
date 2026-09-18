import { NextResponse } from "next/server";
import { z } from "zod";
import { appendStudyAttempt } from "@/lib/study/store";

export const runtime = "nodejs";

const AttemptSchema = z.object({
  participantId: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, "anonymous_id_alphanumeric"),
  challengeId: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  success: z.boolean(),
  completionTimeMs: z.number().nonnegative(),
  retryCount: z.number().int().nonnegative().default(0),
  interactionEventCount: z.number().int().nonnegative().default(0),
  framesObserved: z.number().int().nonnegative().default(0),
  accessibilityPathUsed: z.boolean().default(false),
  abandoned: z.boolean().default(false),
});

/**
 * Record a single study attempt. Does not return individual peer results.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = AttemptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_fields", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const attempt = appendStudyAttempt(parsed.data);
  return NextResponse.json(
    {
      ok: true,
      attemptId: attempt.attemptId,
      // Echo only the caller's own attempt id — never list others.
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
