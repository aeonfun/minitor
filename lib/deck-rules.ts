// Deck/column validation rules shared by the server actions (`app/actions.ts`)
// and the client store (`lib/store/use-deck-store.ts`).
//
// These are plain constants and synchronous helpers — NOT server actions. They
// used to live in `app/actions.ts`, but that file carries `"use server"`, and
// a "use server" module may only export async functions. Exporting a const or
// a sync function from it makes Turbopack reject the whole module ("only async
// functions are allowed to be exported in a 'use server' file"), which cascades
// into every importer failing to resolve any export. Hoisting them here keeps
// `app/actions.ts` exporting nothing but Server Actions, and lets the client
// import the real values directly instead of through an RPC boundary.

/**
 * Whitelisted auto-refresh cadences in seconds. Validated server-side so the
 * client can't schedule pathological sub-minute polling that would hammer
 * upstream rate limits. Keeping the allowlist short bounds the blast radius.
 */
export const REFRESH_INTERVAL_OPTIONS = [60, 300, 900, 3600] as const;
export type RefreshIntervalSeconds = (typeof REFRESH_INTERVAL_OPTIONS)[number];

const REFRESH_INTERVAL_SET = new Set<number>(REFRESH_INTERVAL_OPTIONS);

export function isAllowedRefreshInterval(
  value: unknown,
): value is RefreshIntervalSeconds {
  return typeof value === "number" && REFRESH_INTERVAL_SET.has(value);
}

/**
 * Hard cap on a tab-group label. Generous enough for a Title-Case section name
 * but tight enough to keep the tab bar readable and bound storage. Anything
 * longer is truncated server-side rather than rejected — the UI never silently
 * drops a paste.
 */
export const TAB_GROUP_MAX = 50;

/**
 * Hex-color regex applied to every persisted column/deck color. 6-hex form only
 * (`#rrggbb`); the 3-hex shorthand and named CSS colors are deliberately
 * rejected so the stored representation is canonical — round-tripping a
 * color through export → import → DB always gives the same string back.
 */
export const COLOR_HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Normalize an operator-entered color string. Returns the canonical
 * lowercased `#rrggbb` form when valid; `null` when empty after trim or
 * when the input doesn't match the hex pattern. The same normalizer is
 * applied by `updateColumnColor`, `duplicateColumn`, and `importDeck` so a
 * tampered or hand-edited payload can never smuggle anything but a pure
 * 6-hex string into the DB.
 */
export function normalizeColumnColor(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!COLOR_HEX_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/** Schema version stamped into every exported deck payload. */
export const DECK_EXPORT_VERSION = 1;
