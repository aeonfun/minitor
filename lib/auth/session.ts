// Session tokens for the hosted single-password login gate.
//
// Minitor has no per-user auth — decks and columns are global — so a hosted
// instance is protected by ONE shared password (`MINITOR_PASSWORD`). Logging in
// mints a signed, expiring token that we store in an HttpOnly cookie; the
// proxy verifies it on every request. There is no session store: the token
// is self-describing (an expiry + an HMAC over it), so it validates statelessly.
//
// The HMAC key IS the password. Two consequences we rely on:
//   - No separate secret to configure — "password in env" is the whole config.
//   - Rotating `MINITOR_PASSWORD` invalidates every existing session for free,
//     because old signatures no longer verify under the new key.
//
// Everything here uses only Web Crypto + TextEncoder + btoa, so the SAME module
// runs in the Edge proxy runtime and in Node server actions/route handlers.

export const SESSION_COOKIE = "minitor_session";

// How long a login lasts. Also the cookie Max-Age. A personal gate; long-lived
// is fine and avoids surprise logouts on an always-open dashboard tab.
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return base64url(new Uint8Array(sig));
}

// Constant-time for equal-length inputs. Length is allowed to leak via the early
// return — signatures are a fixed length here, so nothing sensitive leaks.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// `<expiryMs>.<sig>` where sig = HMAC-SHA256(password, "<expiryMs>").
export async function createSessionToken(
  password: string,
  now: number = Date.now(),
): Promise<string> {
  const payload = String(now + SESSION_TTL_MS);
  const sig = await hmac(password, payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  password: string,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const exp = Number(payload);
  if (!Number.isInteger(exp) || exp <= now) return false;

  const expected = await hmac(password, payload);
  return timingSafeEqual(sig, expected);
}

// A `next` redirect target is safe only if it's a same-origin, single-slash
// path — this blocks open redirects (`//evil.com`, `https://…`) from the
// `?next=` query param that the proxy round-trips through the login page.
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
