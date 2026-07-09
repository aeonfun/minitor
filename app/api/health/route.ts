import { NextResponse } from "next/server";

// Unauthenticated liveness probe for platform health checks (Railway / Render /
// compose). Excluded from the password gate in `middleware.ts` so a probe never
// needs credentials. `force-dynamic` keeps it from being statically cached.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
