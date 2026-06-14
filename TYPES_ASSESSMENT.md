# TYPES_ASSESSMENT — Dimension #2: Consolidate shared type definitions

Phase: ASSESSMENT (read-only). No source files were modified. `npx tsc --noEmit`
verified green (0 errors) at assessment time.

> NOTE: A prior version of this file recommended consolidating `WalletTxMeta`,
> `BacklinkSource`/`BacklinksConfig`, `SubstackMeta`, and `GHPRMeta`. Those have
> ALREADY been done in the current tree (the integrations now import + re-export
> these from the plugin — see `blockscout.ts:2`, `github-backlinks.ts:2`,
> `substack.ts` re-export, `github.ts:2`). This assessment covers what is
> STILL duplicated.

## Current state

The codebase has a clean, intentional type hub at `lib/columns/types.ts` (the
plugin/column contracts: `FeedItem`, `PageResult`, `PluginMeta`, `ColumnUI`,
`ServerFetcher`, `Column`, `Deck`, etc.) and an established, correct
consolidation *pattern* for per-plugin renderer metadata:

> The plugin's `plugin.ts` OWNS its `XxxMeta` renderer contract; the matching
> `lib/integrations/*.ts` fetcher *imports* that type and re-exports it.

Already following this correctly:
- `lib/integrations/github.ts:2` imports `GHPRMeta` from the github-prs plugin,
  re-exports as `GHPRItemMeta`.
- `lib/integrations/blockscout.ts:2` imports + re-exports `WalletTxMeta`.
- `lib/integrations/substack.ts` re-exports `SubstackMeta`;
  `lib/integrations/github-backlinks.ts:2` re-exports `BacklinkSource`.
- Alias pattern (one def, aliased on reuse): `apple-reviews/plugin.ts:13` &
  `play-reviews/plugin.ts:13` alias `AppReviewMeta`; `github-stars/plugin.ts:12`
  & `github-forks/plugin.ts:12` alias `GHWatcherItemMeta`.

The problem: **most other plugins do NOT follow this pattern** — they define an
`XxxMeta` interface that is a second, independent copy of the `XxxMeta` in their
integration file. The copies are never cross-imported, so they can silently
drift. There is also a cluster of near-identical "column-without-items" /
"deck-export-payload" shapes across `app/actions.ts`, `use-deck-store.ts`, and
`lib/deck-templates.ts`, plus a hand-written DB row type that restates the
Drizzle schema. No file uses `InferSelectModel`/`$inferSelect` anywhere
(verified by whole-repo grep).

---

## Concrete problems

### P1 — 13 duplicated `*Meta` renderer-contract interfaces (integration ⇄ plugin)

Each pair defines the SAME interface twice. Field structure is identical
(verified by diffing each interface body with comments/blank-lines stripped).
They are never cross-imported, so an edit to one side is a silent type-safety
gap until the other is hand-updated.

| Type | Integration def | Plugin def |
|------|-----------------|------------|
| `PypiMeta` | `lib/integrations/pypi.ts:40` | `lib/columns/plugins/pypi/plugin.ts:12` |
| `CoingeckoMeta` | `lib/integrations/coingecko.ts:32` | `lib/columns/plugins/coingecko/plugin.ts:12` |
| `CratesMeta` | `lib/integrations/crates.ts:31` | `lib/columns/plugins/crates/plugin.ts:14` |
| `DefillamaMeta` | `lib/integrations/defillama.ts:28` | `lib/columns/plugins/defillama/plugin.ts:18` |
| `DevtoMeta` | `lib/integrations/devto.ts:60` | `lib/columns/plugins/devto/plugin.ts:12` |
| `DexscreenerMeta` | `lib/integrations/dexscreener.ts:31` | `lib/columns/plugins/dexscreener/plugin.ts:13` |
| `LobstersMeta` | `lib/integrations/lobsters.ts:116` | `lib/columns/plugins/lobsters/plugin.ts:12` |
| `NpmMeta` | `lib/integrations/npm.ts:24` | `lib/columns/plugins/npm/plugin.ts:14` |
| `PolymarketMeta` | `lib/integrations/polymarket.ts:53` | `lib/columns/plugins/polymarket/plugin.ts:12` |
| `ProductHuntMeta` | `lib/integrations/producthunt.ts:20` | `lib/columns/plugins/producthunt/plugin.ts:12` |
| `StackOverflowMeta` | `lib/integrations/stackoverflow.ts:47` | `lib/columns/plugins/stack-overflow/plugin.ts:12` |
| `ArxivMeta` | `lib/integrations/arxiv.ts:32` | `lib/columns/plugins/arxiv/plugin.ts:28` |
| `HuggingfaceMeta` | `lib/integrations/huggingface.ts:19` | `lib/columns/plugins/huggingface/plugin.ts:13` |

(`HuggingfaceMeta`: the only field difference is `resource: HuggingfaceResource`
in the integration vs `resource: HuggingfaceConfig["resource"]` in the plugin —
both resolve to the identical `"models" | "datasets" | "spaces"` union.)

Verified safe to consolidate:
- None of the 13 integration files import from their plugin yet (no existing
  cycle); none of the 13 `plugin.ts` files import from their integration (so the
  `integration → plugin` direction creates no cycle — `plugin.ts` is pure meta).
- The integration `*Meta` is referenced ONLY inside its own integration file
  (`FeedItem<XxxMeta>` return types); the plugin `*Meta` ONLY by that plugin's
  `server.ts`/`client.tsx`/`plugin.ts`. No external/hidden consumer (grepped the
  whole repo for each of the 13).
- Direction to use is the already-shipping one: integration imports the plugin's
  `XxxMeta` and re-exports it — mirroring github-prs / wallet-tx / substack.

### P2 — `GHActionRunMeta` vs `GHActionsMeta` duplication forces an unsafe cast

`lib/integrations/github.ts:891` (`GHActionRunMeta`) and
`lib/columns/plugins/github-actions/plugin.ts:18` (`GHActionsMeta`) are
structurally identical — the `status`/`conclusion` unions are the same members,
named via `GHActionStatus`/`GHActionConclusion` in the integration vs inlined in
the plugin. Because they are two types, `github-actions/server.ts:33` is forced
to launder the fetcher output through `items as unknown as FeedItem<GHActionsMeta>[]`
— an `as unknown as` double-cast whose own comment (`server.ts:26-31`) admits
"we could re-export the integration type." Consolidation removes a genuine
type-erasing cast, not just a redundant declaration — the single highest-value
case. (Best to also align the inlined plugin unions to reuse the exported
`GHActionStatus`/`GHActionConclusion`.)

### P3 — Column-row shape redefined ~5× (one app shape + literals)

The "a column's persisted fields, minus `items`" shape is written by hand in
multiple places kept in lockstep manually:

- `Column` — `lib/columns/types.ts:139` (canonical; adds `items` +
  `lastFetchedAt`).
- `ImportedDeckColumn` — `app/actions.ts:587` (`Column` minus
  `items`/`lastFetchedAt`, plus `id`).
- The inline literal in `importedDeckPatch` —
  `lib/store/use-deck-store.ts:325-339` — builds the `Column` field set from an
  `ImportedDeckColumn`, field-by-field.
- The optimistic-insert literals in `addColumn`
  (`use-deck-store.ts:610-613`) and `duplicateColumn`
  (`use-deck-store.ts:662-685`) build the same shape by hand.

A new persisted column field (history shows `tabGroup`, `pinned`, `color`, …)
must be threaded through `Column`, `ImportedDeckColumn`, the Zod
`importedColumnSchema` (`actions.ts:480`), the `importedDeckPatch` literal, AND
the two optimistic-insert literals — 5+ edit sites for one field. Duplication of
*structure*, not just a name.

### P4 — Deck-export payload shape duplicated across export / template / Zod

The DeckExport v1 payload is described three times:
- `DeckExport = z.infer<typeof importedDeckSchema>` — `app/actions.ts:516-529`.
- `DeckTemplateColumn` — `lib/deck-templates.ts:26-56` (= DeckExport's column
  shape minus `notifyWebhookUrl`).
- `DeckTemplatePayload` — `lib/deck-templates.ts:58-69` (= DeckExport minus
  `exportedAt`).

`deck-templates.ts`'s own header comment says templates "use the SAME schema as
Export/Import/Share" — yet the type is re-declared rather than derived.

### P5 — Hand-written DB row type duplicates the Drizzle schema

`ItemRow` — `app/actions.ts:39-47` — hand-types the `feed_items` row returned by
the raw `db.execute(sql\`…\`)` window query in `loadSnapshot`, restating columns
already in `lib/db/schema.ts:61-79` (`feedItems`). Because it's a raw-SQL result
(snake_case `column_id`, `created_at`) it can't be a clean `InferSelectModel`,
but the `author`/`meta` jsonb field types could reference the schema-derived
types instead of re-asserting them. This is the one place
`InferSelectModel`/`$inferSelect` would replace a hand-written row type. Lower
value than P1–P4 (single site, raw-SQL boundary).

### P6 — Thin dialog `Props` overlap (do NOT merge)

Seven+ dialog components each declare a local `interface Props` sharing
`{ open: boolean; onOpenChange: (open: boolean) => void }`
(`confirm-dialog.tsx:17`, `rename-dialog.tsx:16`, `deck-color-dialog.tsx:44`,
`version-history-dialog.tsx:18`, `import-deck-dialog.tsx:18`,
`configure-column-dialog.tsx:32`, `add-column-dialog.tsx:27`,
`settings-dialog.tsx:24`). The rest of each `Props` is dialog-specific. This is
coincidental overlap with a 2-field payload, not a shared concept — extracting a
`DialogControlProps` base saves little and couples independent components.
Documented so a later pass doesn't over-merge. Recommend NOT merging.

---

## Prioritized recommendations

1. **[High] T1 — Consolidate the 13 duplicate `*Meta` interfaces (P1).** Per
   pair, delete the integration-side copy, `import type { XxxMeta }` from the
   plugin, and re-export it for the integration's own consumers — exactly the
   github-prs / wallet-tx / substack pattern already in the tree. Pure
   structural dedupe, zero behavior change, no cycle risk (verified). tsc stays
   green (field-identical types).

2. **[High] T2 — Unify `GHActionRunMeta` / `GHActionsMeta`, drop the unsafe cast
   (P2).** Make `github-actions/plugin.ts` reuse the integration's
   `GHActionRunMeta` (+ exported `GHActionStatus`/`GHActionConclusion`), then
   replace `items as unknown as FeedItem<GHActionsMeta>[]`
   (`github-actions/server.ts:33`) with a direct return. Removes a real
   type-erasing double-cast — highest single-case payoff.

3. **[Medium] T3 — Derive the import/optimistic column shapes from one source
   (P3).** Define a single `PersistedColumnFields` (the `Column` fields minus
   `items`/`lastFetchedAt`) in `lib/columns/types.ts` and express
   `ImportedDeckColumn`, the `importedColumnSchema` inference target, and the
   `importedDeckPatch`/`addColumn`/`duplicateColumn` literals in terms of it.
   Medium — crosses the server-action ↔ store boundary; must preserve the
   store's `undefined` vs the DB's `null` semantics exactly.

4. **[Medium] T4 — Make templates derive from the DeckExport types (P4).**
   Express `DeckTemplateColumn`/`DeckTemplatePayload` as `Omit` over the
   `DeckExport` (`z.infer`) shape (template column = export column minus
   `notifyWebhookUrl`; template payload = export minus `exportedAt`). Honors the
   file's own "SAME schema as Export" claim. Medium — `DeckExport` lives in the
   `"use server"` `actions.ts`; a `import type` of it is allowed (types aren't
   runtime exports) but verify the client-side import boundary for templates.

5. **[Low] T5 — Replace the hand-written `ItemRow` with schema-derived types
   (P5).** Base the `author`/`meta`/column field types in `ItemRow`
   (`app/actions.ts:39`) on `InferSelectModel<typeof feedItems>` /
   `feedItems.$inferSelect`, keeping the snake_case raw-SQL field names. Low —
   single site, raw-SQL boundary, modest payoff.

6. **[Low / do-not-do] T6 — Dialog `Props` (P6).** Leave as-is; documented above
   as coincidental overlap, not a shared concept. Listed only to prevent a later
   over-merge.

## Confidence notes
- T1, T2 are High: I verified (whole-repo grep) no hidden consumers of the
  integration-side duplicates, no import cycles, identical field structures, and
  that the consolidation direction matches an already-shipping pattern in the
  same repo. tsc is green now and the changes are assignment-compatible.
- T3, T4 are Medium: the shapes are genuinely related but the edit crosses the
  server-action / store / DB-`null` boundary where `undefined` ↔ `null`
  semantics must be preserved exactly — more than a mechanical move.
- T5 is Low (single raw-SQL site). T6 is explicitly "do not merge."

---

## IMPLEMENTATION (phase 2) — applied 2026-06-14

All re-verified against the current tree before editing; `npx tsc --noEmit`
ends at 0 errors and `npx next build` succeeds (registry/server-registry parity
checks pass at module init). eslint unchanged at baseline (26 errors + 7 warns).

- **T1 — DONE (all 13).** Each integration now `import type { XxxMeta }` from
  its plugin and `export type { XxxMeta }` (mirroring the github-prs / wallet-tx
  / substack pattern); the local interface was deleted. The richer field doc
  comments that lived on the integration side (pypi, defillama, producthunt,
  arxiv) were moved onto the plugin-owned interface so no documentation was lost.
  huggingface: the plugin's `resource: HuggingfaceConfig["resource"]` is now the
  single definition; `HuggingfaceResource` stays in the integration (still used
  by 3 internal helpers).
- **T2 — DONE.** `GHActionsMeta` (+ new named `GHActionStatus` /
  `GHActionConclusion` field unions) is now owned by `github-actions/plugin.ts`;
  `github.ts` imports + re-exports them and aliases `GHActionRunMeta =
  GHActionsMeta`. The `items as unknown as FeedItem<GHActionsMeta>[]` double-cast
  in `github-actions/server.ts` is removed — the fetcher output now flows through
  directly (the unused `FeedItem` import was dropped too).
- **T3 — PARTIALLY DONE (the safe parts).** `ImportedDeckColumn` is now
  `Omit<Column, "items" | "lastFetchedAt">`; the `importedDeckPatch` literal in
  the store collapsed to `{ ...c, items: [] }`. The `addColumn` literal
  (`{ id, typeId, title, config, items: [] }`) was left as-is — it is the minimal
  new-column shape, not duplicated structure. The `duplicateColumn` literal was
  left as-is — it is intentional per-field selection with divergent semantics
  (config shallow-copy, deliberate `pinned: undefined`, documented color
  inheritance), NOT mechanical duplication. No `PersistedColumnFields` type was
  introduced: the Zod `importedColumnSchema` is the runtime validator and must
  stay hand-maintained (per-field bounds + comments); deriving it from a TS type
  is impossible and the reverse (`z.infer`) is already how `DeckExport` is built.
- **T4 — DONE.** `DeckTemplateColumn = Omit<DeckExport["columns"][number],
  "notifyWebhookUrl">` and `DeckTemplatePayload = Omit<DeckExport, "exportedAt" |
  "columns"> & { version; columns: DeckTemplateColumn[] }`, via a type-only
  `import type { DeckExport } from "@/app/actions"` (proven-safe pattern —
  version-history-dialog already type-imports from the "use server" actions
  module; the build confirms the client bundle stays clean).
- **T5 — SKIPPED (not a safe improvement).** Deriving `ItemRow.author` from
  `feedItems.$inferSelect` would type it as `unknown` (the schema's `author`
  jsonb has no `.$type<>()` annotation), which is WEAKER than the current
  `FeedItem["author"]`. The existing hand-typing carries strictly more type
  info than the schema would, so the "derive from schema" rec would regress
  precision. Left as-is.
- **T6 — NOT DONE (by design).** Dialog `Props` left untouched, as assessed.
