export type HttpJar = { cookie: string; apiCalls: number };

export function parseSetCookie(headers: Headers): string | undefined {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    const list = anyHeaders.getSetCookie();
    if (list.length) return list.map((c) => c.split(";")[0]).join("; ");
  }
  const single = headers.get("set-cookie");
  if (single) return single.split(";")[0];
  return undefined;
}

export async function labPost(
  baseUrl: string,
  jar: HttpJar,
  path: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  jar.apiCalls += 1;
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jar.cookie ? { cookie: jar.cookie } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  const set = parseSetCookie(res.headers);
  if (set) jar.cookie = set;
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
