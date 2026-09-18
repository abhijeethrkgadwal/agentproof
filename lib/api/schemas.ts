import { z } from "zod";
import { ClientTelemetrySchema } from "@/lib/telemetry/events";

export const CreateChallengeRequestSchema = z.object({
  difficulty: z.number().int().min(1).max(5).optional().default(1),
  sessionId: z.string().uuid().optional(),
});

export const VerifyRequestSchema = z.object({
  challengeId: z.string().uuid(),
  token: z.string().min(1),
  selectedObjectId: z.string().min(1),
  telemetry: ClientTelemetrySchema.optional().default({}),
});

export type CreateChallengeRequest = z.infer<typeof CreateChallengeRequestSchema>;
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
