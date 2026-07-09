import { NextResponse } from "next/server";
import { getServerEntry } from "@/lib/columns/server-registry";
import {
  cacheKeyFor,
  cachedColumnFetch,
  ttlForMeta,
} from "@/lib/columns/fetch-cache";

// Grok calls are slow and expensive — don't cache, always fresh on refresh.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ type: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { type } = await context.params;
  const entry = getServerEntry(type);
  if (!entry) {
    return NextResponse.json(
      { error: `Unknown column type: ${type}` },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawConfig = body?.config ?? {};
  const cursor =
    body?.op === "loadMore" && typeof body?.cursor === "string"
      ? (body.cursor as string)
      : undefined;

  // Validate config against the plugin's Zod schema. Zod fills in defaults for
  // missing fields, so a fully-valid config is guaranteed before we hit the
  // fetcher. Bad input → 400 with a structured field-level error so the UI
  // can show actionable messages instead of generic "fetch failed".
  const parsed = entry.meta.schema.safeParse(rawConfig);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid config",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    // Coalesce identical concurrent fetches and reuse a fresh result for a few
    // seconds, so duplicate columns / "Refresh all" don't each hit upstream.
    const result = await cachedColumnFetch(
      cacheKeyFor(type, parsed.data, cursor),
      ttlForMeta(entry.meta),
      () => entry.fetch(parsed.data, cursor),
    );
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[api/columns/${type}]`, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
