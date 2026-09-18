import { NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store" };

export function jsonOk<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    status: 200,
    ...init,
    headers: { ...NO_STORE, ...(init?.headers ?? {}) },
  });
}

export function jsonError(
  status: number,
  error: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error, ...(details ? { details } : {}) },
    { status, headers: NO_STORE },
  );
}

export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  return request.headers.get("x-real-ip") ?? "local";
}
