/**
 * Optional API-key gate for challenge issuance.
 * - Missing key: allowed in `test` (demo/lab); rejected in `live`.
 * - Present but invalid/revoked: always rejected (P0 - no silent ignore).
 */
import { verifyApiKey } from "@/lib/developers/keys";

export type ApiKeyAuthResult =
  | {
      ok: true;
      projectId?: string;
      environment: "test" | "live";
      keyPresent: boolean;
    }
  | { ok: false; error: string; status: number };

export function resolveApiKeyFromRequest(
  request: Request,
  bodyApiKey?: string,
): string | undefined {
  const header =
    request.headers.get("x-agentproof-key") ??
    request.headers.get("X-AgentProof-Key");
  const raw = (header || bodyApiKey || "").trim();
  return raw.length > 0 ? raw : undefined;
}

export function authorizeChallengeRequest(input: {
  request: Request;
  bodyApiKey?: string;
  environment: "test" | "live";
  projectId?: string;
}): ApiKeyAuthResult {
  const secret = resolveApiKeyFromRequest(input.request, input.bodyApiKey);
  if (!secret) {
    if (input.environment === "live") {
      return {
        ok: false,
        error: "api_key_required_for_live",
        status: 401,
      };
    }
    return {
      ok: true,
      environment: "test",
      keyPresent: false,
      projectId: input.projectId,
    };
  }

  const verified = verifyApiKey(secret);
  if (!verified.ok) {
    return { ok: false, error: "invalid_api_key", status: 401 };
  }
  if (
    input.projectId &&
    input.projectId !== verified.projectId
  ) {
    return { ok: false, error: "api_key_project_mismatch", status: 403 };
  }
  if (input.environment === "live" && verified.environment !== "live") {
    return {
      ok: false,
      error: "test_key_not_valid_for_live",
      status: 403,
    };
  }
  return {
    ok: true,
    keyPresent: true,
    projectId: verified.projectId,
    environment: verified.environment,
  };
}
