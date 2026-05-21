// Deck share link helpers — encode a DeckExport JSON string into a URL fragment
// and decode it back on the receiving side. Pure client-side; no persistence,
// no new auth, no new server route.
//
// Why a URL fragment rather than a query string: fragments never leave the
// browser, so the deck JSON isn't logged in server access logs / proxies /
// referer headers. The receiving page reads `window.location.hash` after mount
// and immediately strips it via history.replaceState so refreshes don't double
// import.

export const DECK_SHARE_HASH_KEY = "deck";

// Practical guard against pathological deck sizes blowing past browser URL
// limits. 64 columns × ~256 bytes average config is comfortably within this
// envelope; real-world exports we've measured top out around 4 KB raw / 6 KB
// base64. Reject anything bigger so the share-link UX stays predictable.
export const MAX_SHARE_JSON_BYTES = 32 * 1024;

function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url: string): string {
  const padded = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? 0 : 4 - (padded.length % 4);
  return padded + "=".repeat(padding);
}

/**
 * Encode a deck-export JSON string as a base64url payload suitable for use as
 * a URL fragment (#deck=...). Throws when the input exceeds MAX_SHARE_JSON_BYTES
 * so callers can show a user-facing error instead of silently producing a link
 * that some browsers will truncate.
 */
export function encodeDeckShareHash(json: string): string {
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > MAX_SHARE_JSON_BYTES) {
    throw new Error(
      `Deck is too large to share via URL (${bytes.byteLength} bytes; limit ${MAX_SHARE_JSON_BYTES}). Use Export JSON instead.`,
    );
  }
  // String.fromCharCode is safe up to ~64k arg list — well above our 32 KB cap.
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return toBase64Url(btoa(binary));
}

/**
 * Inverse of encodeDeckShareHash. Returns the decoded JSON string, or `null`
 * when the input is empty, not valid base64url, or not valid UTF-8. Never
 * throws — callers branch on `null`.
 */
export function decodeDeckShareHash(fragment: string): string | null {
  if (!fragment) return null;
  try {
    const b64 = fromBase64Url(fragment);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Inspect a `window.location.hash` (or any string starting with optional `#`)
 * and pull out the encoded deck payload. Returns the raw base64url string, or
 * `null` when the hash doesn't match the `deck=<payload>` shape. Tolerates
 * other hash params separated by `&` (e.g. analytics IDs) so we don't crash
 * if a campaign tagger appended its own keys.
 */
export function readDeckShareFragment(hash: string): string | null {
  if (!hash) return null;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  for (const part of raw.split("&")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    if (key !== DECK_SHARE_HASH_KEY) continue;
    const value = part.slice(eq + 1);
    return value || null;
  }
  return null;
}

/**
 * Build a share URL for the deck JSON, anchored at `origin + pathname` so the
 * receiver lands on the same route the sharer was on (the canonical app shell).
 * Throws when the JSON exceeds MAX_SHARE_JSON_BYTES — propagate to the toast.
 */
export function buildDeckShareUrl(json: string, locationLike: { origin: string; pathname: string }): string {
  const encoded = encodeDeckShareHash(json);
  return `${locationLike.origin}${locationLike.pathname}#${DECK_SHARE_HASH_KEY}=${encoded}`;
}
