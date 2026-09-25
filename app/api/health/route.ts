import { jsonOk } from "@/lib/api/http";
import { getStorageBackend, getRedisUrl } from "@/lib/config/env";
import { getRedisInitError } from "@/lib/storage/redis";

export const runtime = "nodejs";

export async function GET() {
  const backend = getStorageBackend();
  return jsonOk({
    status: "ok",
    service: "agentproof",
    label: "research prototype - not production security infrastructure",
    storage: {
      configured: backend,
      redisUrlConfigured: Boolean(getRedisUrl()),
      redisInitError: getRedisInitError(),
    },
  });
}
