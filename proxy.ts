import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

// Single-password login gate for hosted instances. Minitor has no per-user auth
// — decks and columns are global — so a public URL is a shared, editable
// dashboard for anyone who finds it. `MINITOR_PASSWORD` puts the whole app
// behind a proper /login page (a signed session cookie, verified here on every
// request). Leaving it unset is a no-op locally, so `./minitor` is unaffected.
//
// On a HOSTED deployment (the Docker image bakes `MINITOR_HOSTED=1`) a password
// is mandatory: if none is set we fail closed and serve a lock screen rather
// than expose an unprotected public instance.

const LOCKED_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Minitor — locked</title>
<style>html{color-scheme:light dark}body{margin:0;min-height:100vh;display:flex;
align-items:center;justify-content:center;font-family:ui-sans-serif,system-ui,
sans-serif;background:#0a0a0a;color:#ededed}main{max-width:32rem;padding:2rem;
text-align:center;line-height:1.6}code{background:#ffffff1a;padding:.15em .4em;
border-radius:.3em;font-family:ui-monospace,monospace}h1{font-size:1.25rem}</style>
</head><body><main><h1>This Minitor instance is locked</h1>
<p>A hosted deployment must set a login password. Set
<code>MINITOR_PASSWORD</code> in the environment and redeploy to enable the
login page.</p></main></body></html>`;

function isHosted(): boolean {
  const v = process.env.MINITOR_HOSTED;
  return v === "1" || v === "true";
}

export async function proxy(req: NextRequest) {
  const password = process.env.MINITOR_PASSWORD;
  const { pathname } = req.nextUrl;

  // No password configured.
  if (!password) {
    // Hosted with no password → never serve an unprotected public instance.
    if (isHosted()) {
      return new NextResponse(LOCKED_HTML, {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    // Local/dev with no gate → unaffected.
    return NextResponse.next();
  }

  // The login page and its server action must stay reachable while logged out.
  if (pathname === "/login") return NextResponse.next();

  // A valid session cookie is the price of admission everywhere else.
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, password)) {
    return NextResponse.next();
  }

  // Unauthenticated: APIs get a clean 401; page loads bounce to /login and
  // remember where the user was headed.
  if (pathname.startsWith("/api/")) {
    return new NextResponse("Authentication required.", { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname && pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Gate everything except Next internals, the health check (so platform probes
  // pass without credentials), the favicon, and static image assets (so the
  // login page can render the logo/icons before you're authenticated).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
