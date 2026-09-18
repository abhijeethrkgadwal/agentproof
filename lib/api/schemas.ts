import { z } from "zod";
import { ClientTelemetrySchema } from "@/lib/telemetry/events";

export const CreateChallengeRequestSchema = z.object({
  difficulty: z.number().int().min(1).max(5).optional().default(1),
  sessionId: z.string().min(8).max(64).optional(),
  environment: z.enum(["test", "live"]).optional().default("test"),
  projectId: z.string().min(1).max(128).optional(),
  apiKey: z.string().min(8).max(128).optional(),
});

export const VerifyRequestSchema = z.object({
  challengeId: z.string().uuid(),
  token: z.string().min(1),
  selectedObjectId: z.string().min(1),
  telemetry: ClientTelemetrySchema.optional().default({}),
});

export type CreateChallengeRequest = z.infer<typeof CreateChallengeRequestSchema>;
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
