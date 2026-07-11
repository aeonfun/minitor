// Deck/column validation rules shared by the server actions (`app/actions.ts`)
// and the client store (`lib/store/use-deck-store.ts`).
//
// These are plain constants and synchronous helpers — NOT server actions. They
// can't live in `app/actions.ts` because that file carries `"use server"`, and
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
 * Canonicalize a tab-group label: collapse internal whitespace runs to a single
 * space, trim, and cap at `TAB_GROUP_MAX`. Returns the (possibly empty) string;
 * callers decide whether an empty result means `null`/`undefined` on the wire.
 * The same rule runs in `updateColumnTabGroup`, `importDeck`, the client store,
 * and the configure dialog so "AI", " AI " and "AI  " always bucket together.
 */
export function normalizeTabGroup(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, TAB_GROUP_MAX);
}

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

/**
 * The shared preset color palette offered by both the column-color picker
 * (configure-column-dialog) and the deck-color picker (deck-color-dialog).
 * Tuned to read distinctly against both the light and dark surface tones used
 * elsewhere in the app (no near-whites, no near-blacks). The empty (no-color)
 * state is offered as a "Clear" affordance separately rather than as a swatch —
 * a "no color" swatch and a real color swatch read the same in the row and
 * would confuse the operator. Both surfaces share this one const so the column
 * and deck color rows stay visually coherent (e.g. the same orange for a "DeFi"
 * deck and a DeFi column).
 */
export const COLOR_SWATCHES: { value: string; label: string }[] = [
  { value: "#f97316", label: "Orange" }, // DeFi / on-chain default
  { value: "#22c55e", label: "Green" },  // markets / portfolio
  { value: "#3b82f6", label: "Blue" },   // dev / GitHub
  { value: "#a855f7", label: "Purple" }, // social
  { value: "#ec4899", label: "Pink" },   // creators / video
  { value: "#eab308", label: "Yellow" }, // news / alerts-adjacent
  { value: "#06b6d4", label: "Cyan" },   // research / AI
  { value: "#94a3b8", label: "Slate" },  // archival / low-priority
];

/** Schema version stamped into every exported deck payload. */
export const DECK_EXPORT_VERSION = 1;
