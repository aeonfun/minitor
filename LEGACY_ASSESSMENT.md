# LEGACY_ASSESSMENT.md — Dimension #7: Deprecated / legacy / fallback code; make paths singular

Phase: ASSESSMENT (read-only). No source files were modified.

## Executive summary

This codebase is **remarkably clean** on the legacy/deprecated axis. The
investigation found:

- **0** `TODO` / `FIXME` / `XXX` / `HACK` / `WIP` markers anywhere in `.ts`/`.tsx`.
- **0** feature flags, **0** env-var gating (`*_FLAG`, `*_ENABLE`, `*_V2`,
  `*_LEGACY`, `*_BETA`, `*_EXPERIMENT` all return nothing).
- **0** `as any`, `@ts-ignore`, or `@ts-expect-error` escape hatches (the only
  eslint-disables are intentional `no-img-element` / `exhaustive-deps`).
- **0** commented-out code blocks (every `//` hit is prose).
- **0** `.bak` / `.old` / `.orig` / orphan files; working tree is clean.
- **0** version-gated branches. The deck export format is a single clean
  `version: 1` (`lib/deck-rules.ts:62`) consumed by a single
  `z.literal(DECK_EXPORT_VERSION)` (`app/actions.ts:517`). New fields are
  **additive optionals** (e.g. `deckColor`, `app/actions.ts:519-524`) — there is
  no migration code, no multi-version coercion, no v0→v1 upgrade path.

Almost every string matching `legacy` / `fallback` / `old` / `compat` is
**intentional graceful degradation that is real product behavior**, not
removable dead code. The codebase explicitly documents a "keyless dashboards are
a first-class use case" product decision (`lib/integrations/github-discussions.ts:13`),
which is why so many fetchers have a public-key/demo-key fallback.

There is essentially **one** genuinely removable legacy artifact (an unused
re-export alias) plus a handful of *defensive* dual-shape reads against external
APIs that should be **left alone** (cannot be verified safe without the live API
contract).

## Concrete findings

### F1 — Unused legacy type re-export `GHPRItemMeta` (REMOVABLE)
`lib/integrations/github.ts:5-9`

```ts
// Re-exported under the legacy `GHPRItemMeta`
// name in case external callers grew an import on it.
export type { GHPRMeta as GHPRItemMeta };
```

The comment itself states it exists speculatively "in case external callers grew
an import on it." A whole-repo grep for `GHPRItemMeta` returns **only** these two
lines (the comment and the export). There is no internal importer, no barrel
re-export, no dynamic/string reference. The real type `GHPRMeta` is owned by and
imported directly from `lib/columns/plugins/github-prs/plugin.ts`. This is a
zero-consumer back-compat alias for hypothetical external callers that do not
exist in this repo — the textbook "just in case" leftover. **Safe to delete the
comment + the `export type` line.**

> Contrast: `GHWatcherItemMeta` (`github.ts:593`) reads similarly but is the
> ACTUAL source type for `github-stars` / `github-forks` plugins
> (`plugins/github-stars/plugin.ts:4,12`, `.../server.ts:9,12`, and the forks
> equivalents). It is NOT legacy — do not touch it. Same for the `GHStarsMeta` /
> `GHForksMeta` aliases, which are the plugins' public meta contracts.

### F2 — Documentation comments that say "legacy" but gate nothing (NO-OP / cosmetic)
- `lib/integrations/github-discussions.ts:8` — "so its API surface (legacy
  callers) stays stable." Pure prose explaining why discussions live in a
  separate file from `github.ts`. No code branch. Could be reworded but there is
  nothing to remove.
- `lib/integrations/huggingface.ts:68,91` — handles HF "legacy single-segment
  ids" (old community models whose id is just `name` with no `owner/`). This is
  **live external-data handling**, not internal legacy. HF still serves such ids.
  Keep.
- `lib/integrations/polymarket.ts:40` — reads `volume24hr` with a `typeof` guard
  because the live Gamma API returns a *number* despite older schema docs typing
  it as a string. Defensive parse of an external feed. Keep.

### F3 — External-API dual-shape reads (DEFENSIVE — keep unless API verified)
`lib/integrations/farcaster.ts:170,188,208,227,244`

```ts
const casts = json.casts ?? json.result?.casts ?? [];
const fid   = json.user?.fid ?? json.result?.user?.fid;
```

These read both the Neynar v2 top-level envelope (`json.casts` / `json.user`) and
the older `json.result.*` envelope. The response interfaces
(`NeynarCastsResponse`, `NeynarUserLookupResponse`, `farcaster.ts:58-67`) declare
`result?` as optional precisely to support both. *In principle* this is a
candidate to collapse to the single current v2 shape — but it cannot be verified
safe from inside the repo, because the source of truth is Neynar's live response
and the column is used both with a user key and the rate-limited demo key (which
historically returned different envelopes). **Low confidence; recommend leaving
as-is** unless someone confirms the live contract.

### F4 — Graceful-degradation fallbacks that ARE product behavior (KEEP — do NOT remove)
These all surfaced in the marker grep but are intentional, user-facing behavior:
- `components/sidebar-01/nav-header.tsx:30-55` — `copyToClipboard` uses
  `navigator.clipboard` then falls back to the `document.execCommand("copy")`
  textarea trick on insecure-context / older browsers. Real degradation path.
- `lib/integrations/farcaster.ts:79-114` — `NEYNAR_API_KEY || DEMO_KEY` and
  `fallbackToDemoOn402`. Documented keyless-first product decision.
- `lib/integrations/github.ts` (~30 call sites) & `github-discussions.ts:11-14`
  — optional `GITHUB_TOKEN`; degrades to unauthenticated 60 req/hr. Product
  decision.
- `lib/integrations/xai.ts:50-51` — avatar URL fallback chain (unavatar →
  dicebear). Real avatar-resolution behavior.
- `lib/integrations/{coingecko,defillama,dexscreener}.ts` `num(v, fallback=0)` —
  numeric coercion helpers for untyped external JSON. Defensive parsing.
- `lib/integrations/arxiv.ts:123-149` — id/URL extraction fallbacks for varied
  Atom feed shapes. Defensive parsing.
- `components/deck/deck-board.tsx:127` — "tab-disappear fallback" that clears a
  stale color filter when its columns vanish. View-state correctness, not legacy.
- `lib/db/client.ts` — three-driver resolution (pglite/neon/postgres). This is a
  capability matrix, not legacy. The `catch {}` at `resolveDatabaseConfig`'s URL
  parse "falls through to postgres branch" intentionally.

### F5 — Import-time input coercion (NOT legacy — current-path sanitization)
`app/actions.ts:680-741` — `importDeck` coerces `pinned`, `tabGroup`, `color`,
`refreshIntervalSeconds`, keyword fields from hand-editable JSON. This defends
the *current* import path against tampered payloads; it is not back-compat for an
older format. Keep.

## Prioritized recommendations

| # | Recommendation | Confidence | Why |
|---|----------------|-----------|-----|
| L1 | Delete the unused `GHPRItemMeta` legacy re-export alias (comment + `export type { GHPRMeta as GHPRItemMeta }`) in `lib/integrations/github.ts:5-9`. Verified zero consumers repo-wide (only self-references). | **High** | True "just in case" leftover with no internal/dynamic/barrel reference; `GHPRMeta` is imported directly everywhere it's needed. tsc-safe (removing an unused type export changes no value semantics). |
| L2 | (Optional, cosmetic) Reword the "(legacy callers)" prose in `github-discussions.ts:8` since no legacy caller branch actually exists. | Low | Pure comment; no behavior. Skip unless doing a docs pass. |
| L3 | Consider collapsing the Neynar `json.result?.*` dual-shape reads in `farcaster.ts` to the single v2 envelope IF the live API contract is confirmed v2-only. | Low | Cannot verify safe from inside the repo; risks breaking the demo-key path. Do not do blind. |

## What NOT to do (guardrails honored)
- Do **not** remove `GHWatcherItemMeta` / `GHStarsMeta` / `GHForksMeta` — actively
  used plugin contracts (F1 note).
- Do **not** remove any `*_API_KEY || DEMO_KEY` / optional-`GITHUB_TOKEN` /
  `copyToClipboard` execCommand / `num(v, fallback)` paths — they are real
  graceful degradation (F4).
- `plugins/_template/` and `plugins/_newsnow/renderer.tsx` confirmed: `_template`
  is intentionally NOT in `manifest.ts`; `_newsnow/renderer` is imported by 6 hot
  plugins (toutiao, zhihu-hot, bilibili-hot, douyin-hot, weibo-hot, baidu-hot).
  Both KEEP.

## Net assessment
The "make paths singular" mandate finds almost nothing to do here: paths are
already singular. The single actionable, high-confidence removal is L1 (the dead
`GHPRItemMeta` alias). Everything else flagged by legacy/fallback markers is
deliberate product behavior or external-API defensiveness that must be preserved.
