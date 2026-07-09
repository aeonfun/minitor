import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optional single-password gate for hosted instances. Minitor has no per-user
// auth — decks and columns are global — so a public URL is a shared, editable
// dashboard for anyone who finds it. Setting `MINITOR_PASSWORD` turns on HTTP
// Basic Auth in front of the whole app; leaving it unset (the local/dev
// default) is a no-op, so `./minitor` is unaffected.
//
// Basic Auth is deliberately the simplest thing that works: stateless, no
// session store, prompts natively in every browser, and fine for a personal
// single-tenant instance. The username is ignored; only the password is checked.

function safeEqual(a: string, b: string): boolean {
  // Length is allowed to leak (early return); the byte comparison is otherwise
  // constant-time. Sufficient for a personal gate, not a public login form.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const password = process.env.MINITOR_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      const provided = sep === -1 ? decoded : decoded.slice(sep + 1);
      if (safeEqual(provided, password)) return NextResponse.next();
    } catch {
      // Malformed base64 — fall through to the 401 challenge.
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Minitor", charset="UTF-8"' },
  });
}

export const config = {
  // Gate everything except Next internals, the health check (so platform
  // probes pass without credentials), and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
