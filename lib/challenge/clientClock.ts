/** Wall-clock sample time relative to client challenge start (ms). */
export function clientSampleTimeMs(serverStartedAtMs: number): number {
  return Math.max(0, Date.now() - serverStartedAtMs);
}
