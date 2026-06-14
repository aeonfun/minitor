# Circular Dependencies Assessment (Dimension #4)

**Phase:** Assessment (read-only). No source files were modified.
**Date:** 2026-06-14
**Verdict:** **No circular dependencies exist in the codebase.** Three independent
methods agree on zero cycles. There is no work to do here, and — importantly —
no false cycle to "fix". This document records the evidence so a later phase does
not waste effort re-deriving it, and flags the one structural invariant worth
protecting.

---

## 1. Method (and why the result is trustworthy)

The task warns that the `@/*` alias must resolve or cycles routed through aliased
imports stay invisible. I verified resolution works and cross-checked with a
second resolver and a hand-rolled SCC pass.

### 1a. madge via tsconfig alias (`@/* -> ./*`)
```
npx --yes madge@latest --circular --extensions ts,tsx --ts-config tsconfig.json --warning .
→ Processed 243 files (4 warnings)
→ ✔ No circular dependency found!
→ Skipped 4 files: server-only, tailwindcss, tw-animate-css, shadcn/tailwind.css
```
The 4 skipped files are **external packages / CSS**, not aliased internal modules.
Alias resolution provably works: dumping the JSON graph shows
`lib/columns/registry.ts` (which imports only `@/lib/...` paths) correctly
resolves to `lib/columns/plugins/manifest.ts` and `lib/columns/types.ts`, and
**no graph key starts with `@`** (i.e. every alias was rewritten to a real path).
The original "4 unresolved-import warnings" from a naive run are these same
external packages — they were never aliased imports and cannot hide an internal
cycle.

### 1b. madge via webpack alias resolver (independent cross-check)
A `webpackConfig` with `alias: { '@': <repo root> }` produced the same result:
```
→ ✔ No circular dependency found!
→ Skipped 11 files: zod, server-only, @neondatabase/serverless,
  @electric-sql/pglite, date-fns, tailwindcss, tw-animate-css,
  shadcn/tailwind.css, next-themes, class-variance-authority, cmdk
```
All 11 skips are `node_modules` packages — external, cannot form an internal cycle.

### 1c. Independent Tarjan SCC pass on the full alias-resolved graph
Exported the complete graph (`madge --json`, 243 nodes / 925 edges, all `@/`
aliases resolved) and ran Tarjan's strongly-connected-components algorithm:
```
SCCs with >1 node (true cycles): 0
Self-loops (file importing itself): 0
```

### Coverage notes
- **Type-only imports are included.** madge's detective captured `import type`
  edges (verified: `registry.ts -> types.ts` is a type-only import and appears in
  the graph). So even type-level cycles — the kind `isolatedModules` /
  `verbatimModuleSyntax` care about — would have surfaced. None exist.
- **No barrel files.** There are zero `index.ts` / `index.tsx` re-export barrels
  under `lib/`, `app/`, `components/`, `hooks/`, so there is no barrel
  mis-resolution that could mask a cycle.
- **No dynamic imports.** `grep` for `import(` across the source tree returns
  nothing — every internal edge is a static `import`, the easiest case to analyze
  exhaustively.

---

## 2. Why the predicted hotspots are clean (with refs)

The task anticipated two classic cycle shapes. Both are structurally impossible
as the code stands:

### `types <-> registry` — does not exist
- `lib/columns/types.ts` imports **zero internal modules**. Its only imports are
  external type packages (`lib/columns/types.ts:1-3`: `react`, `lucide-react`,
  `zod`). It is a pure leaf/sink, imported by **192 files** and importing none.
  This is exactly the discipline that kills the types↔registry cycle.
- The plugin layering is strictly one-directional:
  `plugin.ts` (pure meta) → `lib/columns/plugins/manifest.ts` →
  `lib/columns/registry.ts` (`registry.ts:13`) and
  `lib/columns/server-registry.ts` (`server-registry.ts:9`). No plugin file
  imports a registry; the registries import the manifest, the manifest imports
  the plugin metas. No back-edges.

### `store <-> components` — does not exist
- `lib/store/use-deck-store.ts` imports 6 modules
  (`app/actions.ts`, `lib/columns/api-client.ts`, `lib/columns/constants.ts`,
  `lib/columns/registry.ts`, `lib/columns/types.ts`, `lib/deck-rules.ts`) and
  **imports zero `components/` files**, while being imported by 14 components.
  Strictly one-directional (data flows up, never back down into the store).
- The adjacent `store -> actions -> store` risk is also clear:
  `app/actions.ts` imports only `lib/columns/{constants,keyword-match,types,webhook}`,
  `lib/db/{client,schema}`, `lib/deck-rules.ts`, `lib/env-keys.ts` — **it does not
  import the store**.
- `lib/deck-rules.ts` and `lib/columns/api-client.ts` are leaves
  (`api-client.ts` imports only the `types.ts` leaf), so neither can close a loop.

### Parity-check architecture is intact (and is not a cycle)
The three-file parity system (`manifest.ts` ⟶ `registry.ts:119-123`,
`server-registry.ts:115-128`) is a fan-in, not a cycle: both registries depend on
the manifest, the manifest depends on plugin metas, and nothing depends back on
the registries except leaf consumers (UI components, the API route). Do not
mistake the static-key registration for a dependency loop.

---

## 3. Concrete problems found

**None.** There are no circular dependencies, no self-loops, no type-only cycles,
and no near-cycles (no module pair that is one edge away from forming a loop in
the hotspots examined). The dependency graph is a clean DAG.

---

## 4. Prioritized recommendations

| # | Recommendation | Confidence |
|---|----------------|-----------|
| 1 | **Take no action.** No cycle exists; there is nothing to untangle. Any "fix" here would be a no-op at best or a behavior-changing edit at worst. | **High** |
| 2 | **Preserve the `types.ts`-is-a-leaf invariant.** The absence of the types↔registry cycle rests entirely on `lib/columns/types.ts` importing zero internal modules. A future change that makes `types.ts` import a runtime/registry module would likely introduce the first cycle. Worth a one-line comment or a lint guard, but this is optional hardening, not a defect. | **Medium** |
| 3 | **(Optional) Add a CI cycle guard.** A `madge --circular --ts-config tsconfig.json .` (or `dpdm`) check in CI would lock in the current clean state cheaply. Not required to fix anything today. | **Low** |

No `high`-confidence *change* is recommended because the only verified-safe
conclusion is that no change is needed.
