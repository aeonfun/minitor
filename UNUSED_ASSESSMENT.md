# UNUSED CODE ASSESSMENT (Dimension #3)

Phase: ASSESSMENT (read-only). No source changed. Tooling: `npx --yes knip@latest`
(config-free), cross-checked with repo-wide `grep` for every candidate including
dynamic/string refs, re-exports, and the plugin registries.

Baselines confirmed at assessment time: `npx tsc --noEmit` -> 0 errors;
`npx eslint` -> 33 problems (26 errors, 7 warnings).

> NOTE: the prior contents of this file were STALE — they described files that no
> longer exist (`components/deck/deck-tabs.tsx`, `lib/integrations/telegram.ts`,
> `@tabler/icons-react`, `AvatarGroup`, …) and even mis-stated that
> `getChainInfo`/`explorerAddressUrl` were "used internally" (they are not).
> This rewrite reflects the CURRENT tree.

---

## TL;DR — the headline

knip output, decoded against the actual tree:

- **Unused files (3):** all under `lib/columns/plugins/_template/` — INTENTIONAL
  scaffolding, KEEP (safety rule #2). Nothing else is an unused file.
- **Unlisted dependencies (53):** every one is `server-only`, a package that ships
  transitively with Next.js. FALSE POSITIVE — not in `package.json` on purpose,
  nothing to remove.
- **Unused exports (107) / unused exported types (18):** the overwhelming majority
  are **not dead code**. They are values/types that ARE referenced inside their own
  module; only the `export` keyword is redundant (knip can't see that they have no
  *cross-file* importer). Removing the `export` is mechanical, low-value churn and
  in two cases (`schema`, `"use server"`) is load-bearing convention. Only **3**
  exports are genuinely dead (no caller anywhere, including their own file).

So the real, safe deletion surface here is small: **3 dead functions.** Everything
else is either intentional, a false positive, or an `export`-keyword tidy that the
project's conventions argue against.

---

## HIGH confidence — genuinely dead, safe to delete

Each verified with `grep -rn "<sym>"` across `*.ts/*.tsx/*.mjs/*.js/*.json/*.md`
(excluding `node_modules`/`package-lock.json`): the ONLY hit is the declaration
itself — zero callers, no re-export, no dynamic/string reference.

| # | Symbol | Location | Notes |
|---|--------|----------|-------|
| U1 | `getTemplate(id)` | `lib/deck-templates.ts:296` | Consumers of `deck-templates` (`app/gallery/page.tsx`, `components/dialogs/templates-dialog.tsx`, `components/onboarding/welcome.tsx`) import `TEMPLATES` / `templateAsImportJson` / types — never `getTemplate`. No internal caller either. |
| U2 | `getChainInfo(chain)` | `lib/integrations/blockscout.ts:49` | Wraps `CHAINS[chain]`. No caller anywhere. The only blockscout symbol the `wallet-tx` plugin imports is `fetchAddressTransactions` (`lib/columns/plugins/wallet-tx/server.ts:16`). Removing it leaves `CHAINS`/`ChainInfo` still live (read by `explorerTxUrl` L54, fetch L116, L216), so no orphan cascade. |
| U3 | `explorerAddressUrl(chain, address)` | `lib/integrations/blockscout.ts:57` | Sibling of `explorerTxUrl` (which IS used at L256). The address variant has zero callers. Same no-orphan reasoning as U2. |

These three are independent, self-contained removals. After deleting them, re-run
`tsc --noEmit` (expect 0) and `eslint` (expect <= 33).

---

## MEDIUM confidence — `export`-keyword tidy only (code is LIVE, not dead)

knip lists these as "unused exports", but each is referenced **inside its own file**.
The function/const/type is NOT dead — only the `export` is unnecessary because no
other module imports it. Down-scoping to file-private is safe and would shrink the
public surface, but it is pure churn with no behavior change and modest value. Do
NOT "delete" these — at most drop the `export` keyword.

Representative verified set (hit counts are intra-file references):

- `pageFromCursor` `lib/columns/paginate.ts:13` — called by `sliceForPage` (L24) in same file. (Other plugins import `sliceForPage`, never `pageFromCursor`.)
- `captureDeckSnapshot` `app/actions.ts:774` — called 5x within `actions.ts` (L195/396/457/467/745). **CAUTION:** this lives in a `"use server"` file, so each export is a server-action RPC endpoint. No client imports it, so down-scoping is *probably* safe, but it touches the server-action boundary (safety rule #5) — treat as MEDIUM, verify no client `import { captureDeckSnapshot }` before touching.
- `WEBHOOK_TIMEOUT_MS` `lib/columns/webhook.ts:10` — used at L136.
- `LOCAL_PGLITE_DIR` `lib/db/client.ts:21` — used at L44.
- `resolveDatabaseConfig` `lib/db/client.ts:33` — used at L59.
- `REFRESH_INTERVAL_OPTIONS` `lib/deck-rules.ts:18` — used at L19/L21.
- `COLOR_HEX_RE` `lib/deck-rules.ts:43` — used at L57. (Two components define their OWN local `COLOR_HEX_RE` copies — a DEDUPE concern, not an UNUSED one.)
- `MAX_SHARE_JSON_BYTES` `lib/deck-share.ts:17` — used at L37/L39.
- `SUPPORTED_CHAINS` `lib/integrations/blockscout.ts:16` — feeds `Chain` type (L28).
- `explorerTxUrl` — actually USED cross-nothing but used internally at L256; knip did NOT flag it, listed here only to contrast with U2/U3.
- `isValidEvmAddress` (L107->L211), `encodeCursor` (L125->L275), `decodeCursor` (L131->L217) `lib/integrations/blockscout.ts` — all used internally.
- `parseCategoryFilter` `lib/integrations/defillama.ts:172` — used L193.
- `normalizeRepo` `lib/integrations/github-backlinks.ts:27` — used L90.
- `parseRepo` `lib/integrations/github-discussions.ts:82` — used L135.
- `DiscussionsDisabledError` `lib/integrations/github-discussions.ts:112` — thrown L162/L173.
- `normalizeGitHubRepo` `lib/integrations/github.ts:608` — used L808/L832/L964.
- `PLATFORM_LABELS` `lib/integrations/newsnow.ts:16` — used L73.
- `parseTopicFilter` `lib/integrations/producthunt.ts:111` — used L159.

Unused exported TYPES, same story — each is referenced within its own file (so the
type is live; only the `export` is redundant):

- `DeckExport` `app/actions.ts:529` — used L564/L777/L818 (and conceptually the
  whole share/template/snapshot subsystem). LIVE.
- `FeedAuthor` `lib/columns/types.ts:5` (L13), `ColumnCategory` (L35->L75),
  `ColumnCapabilities` (L48->L81) — part of the documented plugin contract surface
  in `types.ts`; used internally and intended as public API. KEEP exports.
- `DatabaseKind` `lib/db/client.ts:23` (L26), `DatabaseConfig` (L25->L35).
- `DeckTemplateColumn` `lib/deck-templates.ts:26` (L68), `DeckTemplatePayload` (L58->L85).
- `FCMode` (L18->L254), `FCWindow` (L19->L196/L277) `lib/integrations/farcaster.ts`.
- `NormalizedRepo` `lib/integrations/github-backlinks.ts:22` (L27).
- `GHWatcherItem` `lib/integrations/github.ts:601` (L604/L647/L686/L763/L842),
  `GHActionStatus` (L872->L898/L921), `GHActionConclusion` (L880->L900/L922).
- `GrokTool` `lib/integrations/xai.ts:32` (L38).
- `ColumnWidth` `lib/store/use-deck-store.ts:125` (L166/L227).

Two of the "unused type" reports are RE-EXPORT aliases that ARE consumed cross-file —
knip false positives, KEEP as-is:

- `BacklinkSource` `lib/integrations/github-backlinks.ts:14` is `export type { BacklinkSource }`
  re-exporting the plugin's renderer contract; `github-backlinks/client.tsx` imports
  and uses it (L14/L18/L26/L73/L75). LIVE across files.
- `GHPRItemMeta` `lib/integrations/github.ts:9` is a legacy alias re-export
  (`export type { GHPRMeta as GHPRItemMeta }`); kept for back-compat naming per its
  own comment. Low risk; KEEP unless a deliberate API-rename pass owns it.

---

## LOW confidence / DO NOT TOUCH (false positives & intentional)

- **`schema` export in all ~48 `plugins/<id>/plugin.ts`** (knip lists each, e.g.
  `reddit/plugin.ts:5`, `arxiv/plugin.ts:20`, …). Each `schema` is consumed in the
  SAME file by `meta.schema` and `defaultConfig: schema.parse({})`, and the
  `*Config` type via `z.infer<typeof schema>`. It is the deliberate single-source-of-
  truth plugin pattern (see `types.ts:76`). No external `import { schema }` exists
  (grep: zero). This is convention, not dead code — KEEP every one.
- **`lib/columns/plugins/_template/{plugin.ts,client.tsx,server.ts}`** — knip's only
  "unused files". Intentional scaffolding, unregistered on purpose (safety rule #2).
  KEEP.
- **`lib/columns/plugins/_newsnow/renderer.tsx`** — NOT flagged by knip; it is imported
  by 6 Chinese "hot" plugin clients (baidu/bilibili/douyin/toutiao/weibo/zhihu). LIVE.
  Mentioned only to confirm rule #2 holds.
- **`server-only` (53 "unlisted dependency" rows)** — transitive Next.js package, not a
  direct dependency by design. FALSE POSITIVE. Adding it to `package.json` would be
  the only "fix" and is unnecessary; certainly nothing to delete.
- **All shadcn `components/ui/*` re-exports** knip lists (`Command`, `CommandShortcut`,
  `DialogPortal`, `DialogOverlay`, `DialogTrigger`, 9x `DropdownMenu*`, 10x `Sidebar*`
  incl. `useSidebar`, several `Select*`/`Sheet*`/`InputGroup*`, `buttonVariants`) —
  these are upstream shadcn primitive surfaces. Several are used internally
  (`useSidebar`, `DialogOverlay`/`DialogPortal`, `buttonVariants`). Removing them
  diverges from the generated shadcn templates and breaks future `shadcn add`
  re-generation diffs. Recommend NOT pruning as part of an "unused code" pass; if a
  team wants a leaner UI kit that is a separate, deliberate decision. LOW/KEEP.
- **`scripts/db-migrate.mjs`**, Next entrypoints (`page.tsx`, `route.ts`, `layout.tsx`,
  `generateMetadata`, icons) — not flagged; confirmed not dead.

---

## Prioritized recommendation list

1. **[HIGH] Delete `getTemplate`** — `lib/deck-templates.ts:296`. Zero references.
2. **[HIGH] Delete `getChainInfo`** — `lib/integrations/blockscout.ts:49`. Zero
   references; `CHAINS`/`ChainInfo` stay live via other helpers.
3. **[HIGH] Delete `explorerAddressUrl`** — `lib/integrations/blockscout.ts:57`. Zero
   references; sibling `explorerTxUrl` stays.
4. **[MEDIUM] Optional `export`-keyword down-scoping** of the intra-file-only exports
   listed in the MEDIUM section (e.g. `pageFromCursor`, `WEBHOOK_TIMEOUT_MS`,
   `LOCAL_PGLITE_DIR`, `resolveDatabaseConfig`, `parseCategoryFilter`, `normalizeRepo`,
   `parseRepo`, `normalizeGitHubRepo`, `parseTopicFilter`, `PLATFORM_LABELS`,
   `MAX_SHARE_JSON_BYTES`, `REFRESH_INTERVAL_OPTIONS`, and the matching types). Pure
   surface-shrink, no behavior change. Skip `schema`, the plugin-contract types in
   `types.ts`, and the `"use server"` action `captureDeckSnapshot` unless that is the
   explicit goal.
5. **[LOW] Leave** `_template`, `_newsnow`, all plugin `schema` exports, shadcn
   re-exports, the `BacklinkSource`/`GHPRItemMeta` re-export aliases, and the
   `server-only` "unlisted dependency" rows — false positives or intentional.

After steps 1-3: re-run `npx tsc --noEmit` (expect 0) and `npx eslint`
(expect <= 33). The three removals are independent and touch only their own files.
