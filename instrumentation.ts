/**
 * Next.js instrumentation — initialize storage backends on Node boot.
 * Activates Redis ChallengeStore / SessionStore / RateLimitStore when
 * AGENTPROOF_STORAGE_BACKEND=redis and AGENTPROOF_REDIS_URL is set.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;
  try {
    const { initStorageBackends } = await import(
      "@/lib/storage/challengeStore"
    );
    const result = await initStorageBackends();
    if (process.env.NODE_ENV !== "test") {
      console.info(
        `[agentproof] storage backend: ${result.backend} (redis=${result.redis})`,
      );
    }
  } catch (err) {
    console.warn(
      "[agentproof] storage init failed; using memory fallback",
      err instanceof Error ? err.message : err,
    );
  }
}
