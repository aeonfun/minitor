# SLOP_ASSESSMENT.md — Dimension #8: AI slop, stubs, larp, unhelpful comments

Phase: ASSESSMENT (read-only). No source files were modified in this pass.

> Note: this file previously held a PR-#21-era cleanup log whose line references
> have since rotted (the banner boxes in `github.ts`, the `// ignore` narration,
> the `types.ts` "Backwards-compat aliases" block, and the `relative-time.tsx:65`
> narration it listed no longer exist — already removed). This is a fresh
> assessment of the **current** tree.

## Executive summary

For the slop dimension this codebase is in excellent shape. A full sweep of all
242 `.ts`/`.tsx` files found:

- **Zero** `TODO`/`FIXME`/`XXX`/`HACK` comments.
- **Zero** "not implemented" / "coming soon" throws.
- **Zero** mock/fake/dummy/sample-data identifiers in product code.
- **Zero** narration-of-in-motion-work comments ("now we…", "changed to…",
  "this replaces…", "old code / new code"). The `instead of` / `rather than`
  phrasing that appears throughout documents deliberate design choices (the
  *why*) — keep-quality comments, not narration.
- **Zero** ceremonial banner boxes / empty section dividers (the prior cleanup
  removed them; the only dashed separators left, in `lib/deck-templates.ts`,
  head substantive per-template explanations, not empty `// --- Imports ---`).
- **Zero** redundant JSDoc: no `@param`/`@returns` ceremony anywhere; the
  `/** */` blocks (e.g. `lib/columns/types.ts`) document real invariants.
- **Zero** copy-paste comment slop across the ~70 plugin files — every comment
  line is unique (verified via `uniq -c`; all counts = 1).
- High comment density (`use-deck-store.ts` 231 comment lines, `actions.ts` 228)
  is *substantive*: wire-format contracts, drop-not-fail posture, server/client
  validation parity, the registry parity-check invariant. Assets, not slop.

There is essentially **one** real slop finding: a self-contained dead-code
island in `lib/integrations/farcaster.ts` kept alive only by a `void`-discard to
silence the linter. Everything else is Low / micro-nit.

The other top-level `*_ASSESSMENT.md` artifacts were not touched.

---

## Findings (with file:line references)

### F1 — Dead "kept for re-enable" code island in farcaster.ts  (the one real finding)

`lib/integrations/farcaster.ts` carries a cohesive cluster never reached by any
execution path, kept purely "for re-enable":

- `fetchTrending` — `farcaster.ts:195`
- `fetchChannel` — `farcaster.ts:212`
- `fetchSearch` — `farcaster.ts:248` (a one-line re-export of `fetchFarcasterSearch`)
- `fetchFarcaster` dispatcher — `farcaster.ts:253`
- exported types used ONLY by the above: `FCMode` (`farcaster.ts:18`),
  `FCWindow` (`farcaster.ts:19`)
- the linter-suppression statement `void fetchFarcaster;` — `farcaster.ts:284`
- four framing comments — `farcaster.ts:5`, `:192-193`, `:252`, `:283`

Verification performed:
- The farcaster plugin fetcher (`lib/columns/plugins/farcaster/server.ts`)
  imports ONLY `fetchFarcasterUser` and `fetchFarcasterSearch`.
- Repo-wide grep: nothing outside `farcaster.ts` references
  `fetchTrending` / `fetchChannel` / `fetchSearch` / `fetchFarcaster` /
  `FCMode` / `FCWindow`. (The names `fetchTrending`/`fetchChannel` also exist as
  unrelated module-private functions in `github.ts`, `youtube.ts`,
  `coingecko.ts`.)
- The "wire this back up in route.ts" comment (`:252`) is stale: there are zero
  farcaster references in `app/api/columns/[type]/route.ts`.
- `void fetchFarcaster;` (`:284`) is the tell-tale larp artifact — a no-op whose
  only job is to stop the unused-symbol lint from firing on dead code.

This is the textbook "stub kept around, suppressed with a void-discard" pattern,
and the dominant slop in the repo (~95 lines incl. comments).

Why NOT rated High for removal: intent is documented and defensible (a one-line
path back when the Neynar plan is upgraded). Removal is technically safe — tsc
stays green, the eslint count cannot rise, and there is **no** plugin-registry /
parity-check impact (this is an integration module, not a registered plugin) —
but deleting deliberately-parked product capability is an owner judgment call,
not a pure-mechanical cleanup. Hence Medium.

If the owner wants to keep the capability parked, the slop can still be cut by
removing just the `void fetchFarcaster;` suppressor (`:284`) + its comment
(`:283`); the cleanest honest outcome, though, is full removal (recover from git
history when actually re-enabling).

### F2 — `void mode;` unused-parameter suppression in producthunt.ts

`lib/integrations/producthunt.ts:152` — `fetchProductHuntPage(mode, …)` never
uses `mode` and discards it with `void mode;`. The comment (`:148-151`) explains
it is kept "as a type so future PH endpoints can plug in". Mild slop (unused
param + forward-looking placeholder), but `mode` is part of the public signature
callers pass, so it is NOT removable without touching the caller and the plugin
config shape, and the why is honestly documented. Low — a safe micro-change
would rename `_mode` to drop the `void`; near-zero value.

### F3 — Historical PR-number references inside comments

`lib/columns/types.ts:229` ("…column color labels, PR #61"),
`lib/store/use-deck-store.ts:677` ("PR #59's 'DnD across pin/unpin no-op' rule"),
`app/actions.ts:156` ("…from PR #61"), `app/actions.ts:369` ("…rule from PR #59").
Each anchors a real invariant to a PR for provenance. Mildly historical, but the
invariant text beside each is the load-bearing content and must be kept. Low —
at most drop the bare "PR #NN" tokens; not worth a dedicated change.

### F4 — `lib/deck-rules.ts:5` "used to live in app/actions.ts" framing

`lib/deck-rules.ts:1-11` correctly documents the real Next.js constraint that a
`"use server"` module may only export async functions (a genuine, non-obvious
gotcha that MUST be kept). The single phrase "They used to live in
`app/actions.ts`" (`:5`) is light historical narration but the natural way to
explain why the module exists. Low — optional reword to lead with the
constraint; not a priority.

---

## Things that look like slop but are NOT — KEEP (don't let another pass cut these)

- `console.log(json)` / `console.log(url)` — `components/sidebar-01/nav-header.tsx:85,110`.
  Intentional user-facing fallback: the paired toast literally tells the user to
  "paste the JSON manually from the console" when clipboard is blocked.
- `console.log("[minitor] webhook delivered …")` — `lib/columns/webhook.ts:150`.
  Operational delivery logging, prefixed and paired with `console.error` failure
  branches.
- `eslint-disable-next-line @next/next/no-img-element` across plugin clients
  (dexscreener/github-forks/youtube/coingecko/github-stars/github-prs/defillama)
  and `react-hooks/exhaustive-deps` at `components/column/column-card.tsx:191` —
  legitimate targeted suppressions.
- `eslint-disable-next-line @typescript-eslint/no-unused-vars` at
  `lib/columns/types.ts:67` — the `TMeta` phantom type param is structurally
  required.
- `void save()` / `void autoFetchColumn(...)` / `void onRefreshRef.current(...)`
  in components — idiomatic fire-and-forget promise discards.
- `_template/` (scaffolding, intentionally unreferenced) and
  `_newsnow/renderer.tsx` (shared renderer) — the numbered "1./2./3." comments
  in `_template/*` are the point of a template. KEEP per project safety rules.
- The dashed separators + per-template paragraphs in `lib/deck-templates.ts` —
  substantive, not ceremonial.
- The dense "why" comments in `use-deck-store.ts`, `actions.ts`, `types.ts`,
  every integration's drop-not-fail / wire-format notes, and the registry
  parity-check rationale — KEEP / sharpen, never strip.

---

## Prioritized recommendations

| # | Recommendation | Confidence |
|---|----------------|------------|
| R1 | Remove the dead farcaster re-enable island (`fetchTrending`, `fetchChannel`, `fetchSearch`, `fetchFarcaster`, `FCMode`, `FCWindow`, the `void fetchFarcaster;` suppressor, and the four re-enable comments) from `lib/integrations/farcaster.ts` — OR, if the owner wants the capability parked, at minimum drop the `void`-discard slop. Verified-unreferenced and parity-check-safe; Medium (not High) only because deleting documented intentional re-enable code is an owner judgment call. | Medium |
| R2 | (Optional, micro) Rename `mode` → `_mode` and drop `void mode;` at `lib/integrations/producthunt.ts:152`. | Low |
| R3 | (Optional, micro) Trim bare "PR #NN" provenance tokens in `types.ts:229`, `use-deck-store.ts:677`, `actions.ts:156`, `actions.ts:369` while keeping every invariant sentence. | Low |
| R4 | (Optional, micro) Reword the "used to live in app/actions.ts" framing in `lib/deck-rules.ts:5`, keeping the gotcha. | Low |

No High-confidence slop deletions exist: the codebase has no clear-cut,
risk-free slop to remove. R1 is the only material item and carries an
intent/judgment caveat that keeps it at Medium.
