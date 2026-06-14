# DEDUPE_ASSESSMENT — Dimension #1: Deduplicate & consolidate (DRY where it reduces complexity)

Phase: ASSESSMENT (read-only). No source files were modified. `npx tsc --noEmit` was confirmed green before and is untouched.

## Already done (verified, do NOT re-recommend)
A prior dedup pass already landed and was re-verified during this assessment:
- `formatCompactCount` lives in `lib/utils.ts:8` and is used ~78×; **zero** local `compact()` remain in plugins/shared/sidebar.
- `identiconUrl` is in `lib/utils.ts:17`; **zero** inline `api.dicebear.com/9.x/identicon` URLs remain outside it.
- `truncateText` is in `lib/utils.ts:21` (5 import sites).
This assessment covers the **next layer** the prior pass did not touch.

## Current state — what's already DRY (sets the bar)
- **Date formatting is fully centralized** via `components/relative-time.tsx`: 32 client.tsx use `RelativeTime`; **zero** local date formatters.
- **`lib/columns/plugins/_newsnow/renderer.tsx`** is the model abstraction: `makeNewsNowItemRenderer({icon,accent,badgeLabel})` + `NewsNowConfigHint`, consumed by 6 hot-board plugins whose client.tsx are ~30 trivial lines each. **This is the template for the fixes below.**
- **`lib/columns/shared/`** has `LinkItem` (7 plugins) and `TweetItem` (2 plugins).
- **`lib/columns/paginate.ts`** (`pageFromCursor`/`sliceForPage`) is shared by 24 server fetchers.
- **`lib/deck-rules.ts`** already exports the canonical refresh/tab-group/color constants; `app/actions.ts` + `use-deck-store.ts` import them correctly.
- The api route (`app/api/columns/[type]/route.ts`) is the single config-validation chokepoint — no dup there.

The remaining duplication clusters in: **plugin client.tsx renderers**, **plugin server.ts fetchers**, **integration HTML/number helpers**, and a small **color/tab-group constant re-declaration in two dialogs** despite a canonical source already existing.

---

## Concrete problems (with file:line references)

### A. Color + tab-group constants re-declared in two dialogs (canonical source already exists)
`lib/deck-rules.ts` exports `COLOR_HEX_RE` (:43), `normalizeColumnColor` (:53 — trim → empty→null → regex→null → lowercase), `TAB_GROUP_MAX` (:35). Yet two dialogs re-declare byte-equivalent copies instead of importing:
- `components/column/configure-column-dialog.tsx:40` `COLOR_HEX_RE`, `:46` `normalizeHexColor` (identical body to `normalizeColumnColor`), `:39` `TAB_GROUP_MAX`, `:42` `normalizeTabGroup` (= `.replace(/\s+/g," ").trim().slice(0,TAB_GROUP_MAX)`, the exact logic at `app/actions.ts:312` and `use-deck-store.ts:800`).
- `components/dialogs/deck-color-dialog.tsx:21` `COLOR_HEX_RE`, `:23` `normalizeHexColor`.
- The 8-entry `COLOR_SWATCHES` palette is duplicated verbatim: `configure-column-dialog.tsx:58` and `deck-color-dialog.tsx:33` (a comment at deck-color-dialog.tsx:30 literally says "Same eight presets as the column-color picker" — a manual keep-in-sync note = drift risk).

### B. `formatPriceUsd` — byte-identical across two plugins
`lib/columns/plugins/coingecko/client.tsx:76` and `lib/columns/plugins/dexscreener/client.tsx:85` are identical (verified by diff ignoring comments): same 5-branch `$0 / >=1000 / >=1 / >=0.01 / sub-cent toPrecision(3)` body.

### C. Percent-change "pill" JSX — identical across three crypto plugins
`<span … style={{color: up ? "#10b981" : "#ef4444"}}>{up ? <ArrowUpRight/> : <ArrowDownRight/>}{pct.toFixed(2)}%</span>` is byte-identical in:
- `coingecko/client.tsx:204-214`, `dexscreener/client.tsx:176-186`, `defillama/client.tsx:170-181`.
- (`wallet-tx` imports `ArrowUpRight` too but uses it as a tx-direction icon at line 108 — NOT this pill; do not lump it in.)

### D. "Source badge" JSX block — same shape in 13 plugins
`<span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 …"><span className="grid size-3.5 place-items-center rounded-[3px] …">{icon|char}</span>{label}</span>`, parameterized only by background-color, inner icon/char, and label. 13 client.tsx: coingecko, dexscreener, devto, crates, defillama, hacker-news, lobsters, huggingface, npm, polymarket, producthunt, pypi, stack-overflow. The inner-square className is identical across npm:105 / crates:88 / pypi:89. `_newsnow` already proves the factory for exactly this.

### E. Server-fetcher pagination boilerplate — two near-identical idioms, ~17 sites
1. **0-based page + `{items,hasMore}` wrap** (12 sites): coingecko, crates, devto, npm, pypi, huggingface, arxiv, hacker-news, lobsters, stack-overflow, polymarket, defillama. All do:
   `const page = cursor ? Number(cursor) || 0 : 0; const r = await fetchXPage(…, PAGE_SIZE, page); return { items: r.items, nextCursor: r.hasMore ? String(page+1) : undefined };`
   (e.g. `coingecko/server.ts:11-24`, `crates/server.ts:11-18`, `npm/server.ts:11-18`.)
2. **1-based page + `items.length === PAGE_SIZE`** (5 sites): `github-issues/server.ts:16-26`, `github-prs/server.ts:11-23`, `github-search/server.ts:14-24`, `github-trending/server.ts:14-25`, `github-releases/server.ts:30-38` (variant: uses `all.length` after a prerelease filter). `cursor ? Number(cursor) || 1 : 1` + `items.length === PAGE_SIZE ? String(page+1) : undefined` is copy-pasted.
   Note: `pageFromCursor` (`paginate.ts:13`) already encapsulates idiom-1's cursor parse but none of these 17 fetchers use it.

### F. github-stars / github-forks server.ts — essentially identical
`github-stars/server.ts` and `github-forks/server.ts` differ only by the imported fetcher (`fetchStargazers` vs `fetchForks`) and type names; both trim repo, throw `"Repository is required (owner/repo)."`, call `fetchX(repo, PAGE_SIZE, cursor)`. That same guard string recurs in `github-releases/server.ts:18` and `github-actions/server.ts:18`.

### G. NewsNow server.ts — 6 near-identical fetchers
weibo/zhihu/douyin/bilibili/toutiao/baidu `server.ts` differ only by the platform string (`"weibo"`, `"zhihu"`, …) and type names; all call `fetchNewsNow(platform, 50)` then `sliceForPage(items, cursor)`. (The client side is already factored via `_newsnow`; the server side is not.)

### H. HTML-entity decode / strip-HTML helpers in integrations
- `decodeEntities` defined in 4 files; **byte-identical** in `rss.ts` and `arxiv.ts` (same `NAMED_ENTITIES` map + same 3-`replace` body). `stackoverflow.ts:68` and `pypi.ts:63` are variants with overlapping-but-narrower entity lists.
- `stripHtml`/`stripTags` defined in 5 files; `lobsters.ts:63` and `polymarket.ts:126` are **byte-identical** (polymarket's comment says "strip it the same way Lobsters does"). `mastodon.ts:76` is a richer `<a>`/`<p>`-aware variant.
- `NAMED_ENTITIES` const duplicated in `rss.ts` + `arxiv.ts`.

### I. Integration fetch + `!res.ok` throw boilerplate — ~30 sites
`const res = await fetch(url, {…}); if (!res.ok) throw new Error(\`X ${res.status}: …slice(0,200)\`); return await res.json()` recurs ~30× across integrations — **5× inside `github.ts` alone**, where a `ghFetch<T>` helper already exists at `github.ts:97` but `searchCode`:481, stargazers:653/725, `fetchWorkflowRuns`:972 bypass it with inline re-implementations. Each external call site varies in headers/error-prefix/slice length, so cross-file consolidation is coupling-prone.

### J. ConfigForm "Mode <Select> + conditional <Input> + helper <p>" scaffold
22 client.tsx import the shadcn `Select` cluster and build the same Label/Select shape; 16 use the `mode: v as XConfig["mode"]` cast; helper-text `<p className="text-xs text-muted-foreground">` appears 63×. Structure is similar but option lists + help copy are all distinct — **weakest** candidate.

---

## Prioritized recommendations

1. **[HIGH]** Import `COLOR_HEX_RE` / `normalizeColumnColor` / `TAB_GROUP_MAX` (and the tab-group normalizer) from `@/lib/deck-rules` in both color dialogs; hoist the 8-entry `COLOR_SWATCHES` palette into one shared const. Bodies verified equivalent; canonical source already imported elsewhere. Removes a hand-maintained "keep in sync" comment. (§A)
2. **[HIGH]** Extract `formatPriceUsd` (byte-identical) to a shared module; import in coingecko + dexscreener. Do NOT fold in polymarket/wallet-tx `formatUsd` — different rounding (Rec 8). (§B)
3. **[HIGH]** Extract a `<PctChangePill value={pct} />` shared component for the identical pill in coingecko/dexscreener/defillama; wallet-tx excluded. (§C)
4. **[HIGH]** Extract `decodeEntities` + `NAMED_ENTITIES` to a shared text-util; migrate rss + arxiv (exact). stackoverflow/pypi optional (their entity lists are subsets — verify each). (§H)
5. **[HIGH]** Share the byte-identical `stripHtml` between lobsters + polymarket; leave mastodon's richer variant alone. (§H)
6. **[MEDIUM]** A `pageWrap`-style helper for the 12 "0-based page + {items,hasMore}" fetchers, plus a sibling for the 5 GitHub `items.length === PAGE_SIZE` fetchers. MEDIUM: per-source 0/1-based offset differs, and lobsters/polymarket/defillama do pre-call massaging that must stay in the closure. (§E)
7. **[MEDIUM]** A `makeSourceBadge({bg,accent,icon|char,label})` factory mirroring `makeNewsNowItemRenderer` for the 13-plugin badge. MEDIUM: some use a Lucide icon, some a literal char, and npm/crates/pypi share a `text-[9px] font-bold` inner-square variant — the factory must take both shapes. (§D)
8. **[MEDIUM]** Optionally consolidate compact-USD `formatUsd` (polymarket vs wallet-tx) behind a parameterized helper — but the precision rules are deliberately different, so only if the options stay readable; otherwise leave (premature-abstraction risk). (§ formatUsd variants)
9. **[MEDIUM]** Tiny factories: `makeRepoWatcherServer(fetcher,label)` for github-stars/forks (+ reuse the repo guard) and `makeNewsNowServer(platform)` for the 6 hot-board servers (mirror the already-factored client side). Small LOC, high structural-clarity payoff, zero behavior change. (§F, §G)
10. **[LOW]** First make `github.ts`'s `searchCode`/stargazers/`fetchWorkflowRuns` use the existing in-file `ghFetch<T>` (safe internal win). A cross-integration `fetchJson` helper is LOW/likely-premature given per-API header/error variance. (§I)
11. **[LOW] Do NOT** consolidate `plugin.ts` meta or the 22 ConfigForm Select scaffolds — declarative metadata and per-plugin-unique option/help copy; a generic abstraction would need so much config it wouldn't reduce complexity, and would obscure the parity-checked registry (Safety Rule #1). Listed to prevent over-abstraction. (§J)

---

## Safety notes
- All recs preserve user-facing behavior (Rule #5) and touch no manifest/registry/server-registry keys or the parity check (Rule #1).
- `_template/` and `_newsnow/` untouched as sources (Rule #2); `_newsnow` cited only as the pattern to imitate.
- Recs 1–5 are exact-equivalence moves (HIGH, grepped repo-wide). Recs 6–9 are uniform-shape factories with minor per-site variance (MEDIUM). Recs 10–11 are coupling-prone / premature (LOW / don't-do).
