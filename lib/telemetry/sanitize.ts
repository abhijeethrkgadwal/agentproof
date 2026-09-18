import {
  ALLOWED_EVENT_TYPES,
  ClientTelemetrySchema,
  type ClientTelemetry,
  type TelemetryEvent,
} from "@/lib/telemetry/events";

/**
 * Sanitize client telemetry: drop unknown fields, cap arrays, strip PII-like keys.
 */
export function sanitizeTelemetry(raw: unknown): ClientTelemetry {
  const parsed = ClientTelemetrySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return {
      completionTimeMs: undefined,
      interactionEventCount: 0,
      retryCount: 0,
      events: [],
    };
  }

  const data = parsed.data;
  const events: TelemetryEvent[] = (data.events ?? [])
    .filter((event) => ALLOWED_EVENT_TYPES.has(event.eventType))
    .slice(0, 50)
    .map((event) => ({
      eventType: event.eventType,
      timestamp: event.timestamp,
      challengeId: event.challengeId,
      relativeTimeMs: event.relativeTimeMs,
      objectId: event.objectId,
    }));

  return {
    completionTimeMs:
      typeof data.completionTimeMs === "number"
        ? Math.min(data.completionTimeMs, 600_000)
        : undefined,
    interactionEventCount:
      typeof data.interactionEventCount === "number"
        ? Math.min(data.interactionEventCount, 10_000)
        : events.length,
    retryCount:
      typeof data.retryCount === "number" ? Math.min(data.retryCount, 100) : 0,
    startedAt: data.startedAt,
    events,
  };
}
