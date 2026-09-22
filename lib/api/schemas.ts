import { z } from "zod";

export const ChallengeTypeSchema = z.enum([
  "temporal",
  "drag_avoid",
  "physical",
  "dynamic_path",
]);

export const CreateChallengeRequestSchema = z.object({
  difficulty: z.number().int().min(1).max(5).optional().default(1),
  challengeType: ChallengeTypeSchema.optional().default("temporal"),
  sessionId: z.string().min(8).max(64).optional(),
  environment: z.enum(["test", "live"]).optional().default("test"),
  projectId: z.string().min(1).max(128).optional(),
  apiKey: z.string().min(8).max(128).optional(),
});

export const InteractionSampleSchema = z.object({
  t: z.number().nonnegative(),
  x: z.number(),
  y: z.number(),
  objectId: z.string().optional(),
  kind: z.enum(["move", "down", "up", "collision"]).optional(),
});

export const InteractionPayloadSchema = z.object({
  samples: z.array(InteractionSampleSchema).max(2000).optional().default([]),
  finalPositions: z
    .record(
      z.string(),
      z.object({
        x: z.number(),
        y: z.number(),
        rotation: z.number().optional(),
      }),
    )
    .optional(),
  accessibleAnswers: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

/**
 * Loose telemetry intake — sanitizeTelemetry() enforces allowlists/caps.
 * Strict ClientTelemetrySchema here rejected valid drag sessions once
 * object_moved events exceeded 100.
 */
export const VerifyTelemetryIntakeSchema = z
  .object({
    completionTimeMs: z.number().nonnegative().optional(),
    interactionEventCount: z.number().int().nonnegative().optional(),
    retryCount: z.number().int().nonnegative().optional(),
    startedAt: z.string().optional(),
    events: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
  })
  .passthrough()
  .optional()
  .default({});

export const VerifyRequestSchema = z.object({
  challengeId: z.string().uuid(),
  token: z.string().min(1),
  selectedObjectId: z.string().min(1).optional(),
  interaction: InteractionPayloadSchema.optional(),
  telemetry: VerifyTelemetryIntakeSchema,
}).superRefine((value, ctx) => {
  if (!value.selectedObjectId && !value.interaction) {
    ctx.addIssue({
      code: "custom",
      message: "selectedObjectId_or_interaction_required",
      path: ["selectedObjectId"],
    });
  }
});

export type CreateChallengeRequest = z.infer<typeof CreateChallengeRequestSchema>;
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
