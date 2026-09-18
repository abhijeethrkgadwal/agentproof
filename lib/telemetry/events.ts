import { z } from "zod";

export const TelemetryEventSchema = z.object({
  timestamp: z.string().datetime().optional(),
  eventType: z.enum([
    "challenge_created",
    "challenge_started",
    "object_selected",
    "challenge_completed",
    "challenge_failed",
    "verification_requested",
  ]),
  challengeId: z.string().optional(),
  relativeTimeMs: z.number().nonnegative().optional(),
  objectId: z.string().optional(),
});

export const ClientTelemetrySchema = z.object({
  completionTimeMs: z.number().nonnegative().optional(),
  interactionEventCount: z.number().int().nonnegative().optional(),
  retryCount: z.number().int().nonnegative().optional(),
  startedAt: z.string().optional(),
  events: z.array(TelemetryEventSchema).max(100).optional(),
});

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export type ClientTelemetry = z.infer<typeof ClientTelemetrySchema>;

export const ALLOWED_EVENT_TYPES = new Set([
  "challenge_created",
  "challenge_started",
  "object_selected",
  "challenge_completed",
  "challenge_failed",
  "verification_requested",
]);
