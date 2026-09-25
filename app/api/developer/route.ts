import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createApiKey,
  createProject,
  listApiKeys,
  listProjects,
  revokeApiKey,
} from "@/lib/developers/keys";

export const runtime = "nodejs";

const CreateProjectSchema = z.object({
  action: z.literal("create_project"),
  name: z.string().min(1).max(80),
});

const CreateKeySchema = z.object({
  action: z.literal("create_key"),
  projectId: z.string().min(1),
  environment: z.enum(["test", "live"]).default("test"),
});

const RevokeSchema = z.object({
  action: z.literal("revoke_key"),
  keyId: z.string().min(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (projectId) {
    return NextResponse.json(
      { projectId, keys: listApiKeys(projectId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { projects: listProjects() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = (body as { action?: string }).action;
  if (action === "create_project") {
    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
    }
    return NextResponse.json({ project: createProject(parsed.data.name) });
  }
  if (action === "create_key") {
    const parsed = CreateKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
    }
    const result = createApiKey(parsed.data);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      key: {
        keyId: result.record.keyId,
        projectId: result.record.projectId,
        environment: result.record.environment,
        prefix: result.record.prefix,
        createdAt: result.record.createdAt,
      },
      secret: result.secret,
      warning: "Store the secret now - it will not be shown again.",
    });
  }
  if (action === "revoke_key") {
    const parsed = RevokeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
    }
    return NextResponse.json({ ok: revokeApiKey(parsed.data.keyId) });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
