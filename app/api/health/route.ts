import { jsonOk } from "@/lib/api/http";

export const runtime = "nodejs";

export async function GET() {
  return jsonOk({ status: "ok", service: "agentproof" });
}
