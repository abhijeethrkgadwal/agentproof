import {
  ALLOWED_EVENT_TYPES,
  type ClientTelemetry,
  type TelemetryEvent,
} from "@/lib/telemetry/events";

/**
 * Sanitize client telemetry: drop unknown fields, cap arrays, strip PII-like keys.
 * Intentionally lenient - verify must not 400 solely because a drag session
 * produced many pointer events.
 */
export function sanitizeTelemetry(raw: unknown): ClientTelemetry {
  const data =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const rawEvents = Array.isArray(data.events) ? data.events : [];
  const events: TelemetryEvent[] = [];
  for (const item of rawEvents.slice(0, 100)) {
    if (!item || typeof item !== "object") continue;
    const event = item as Record<string, unknown>;
    const eventType = event.eventType;
    if (typeof eventType !== "string" || !ALLOWED_EVENT_TYPES.has(eventType)) {
      continue;
    }
    events.push({
      eventType: eventType as TelemetryEvent["eventType"],
      timestamp: typeof event.timestamp === "string" ? event.timestamp : undefined,
      challengeId:
        typeof event.challengeId === "string" ? event.challengeId : undefined,
      relativeTimeMs:
        typeof event.relativeTimeMs === "number" && event.relativeTimeMs >= 0
          ? event.relativeTimeMs
          : undefined,
      objectId: typeof event.objectId === "string" ? event.objectId : undefined,
    });
    if (events.length >= 50) break;
  }

  const completionTimeMs =
    typeof data.completionTimeMs === "number" && data.completionTimeMs >= 0
      ? Math.min(data.completionTimeMs, 600_000)
      : undefined;
  const interactionEventCount =
    typeof data.interactionEventCount === "number" &&
    data.interactionEventCount >= 0
      ? Math.min(Math.floor(data.interactionEventCount), 10_000)
      : events.length;
  const retryCount =
    typeof data.retryCount === "number" && data.retryCount >= 0
      ? Math.min(Math.floor(data.retryCount), 100)
      : 0;

  return {
    completionTimeMs,
    interactionEventCount,
    retryCount,
    startedAt: typeof data.startedAt === "string" ? data.startedAt : undefined,
    events,
  };
}
