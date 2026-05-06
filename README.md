<p align="center">
  <img src="./public/logo.png" alt="Minitor" width="120" />
</p>

<h1 align="center">Minitor</h1>

<p align="center">
  <a href="https://github.com/aaronjmars/minitor/stargazers"><img src="https://img.shields.io/github/stars/aaronjmars/minitor?style=flat-square&logo=github" alt="GitHub stars"></a>
  <a href="https://github.com/aaronjmars/minitor/network/members"><img src="https://img.shields.io/github/forks/aaronjmars/minitor?style=flat-square&logo=github" alt="GitHub forks"></a>
  <a href="https://x.com/aeonframework"><img src="https://img.shields.io/badge/by-%40aeonframework-black?style=flat-square&logo=x&labelColor=000000" alt="by aeon"></a>
  <a href="https://bankr.bot/discover/0xbf8e8f0e8866a7052f948c16508644347c57aba3"><img src="https://img.shields.io/badge/Aeon%20on-Bankr-orange?style=flat-square&labelColor=1a1a2e" alt="Aeon on Bankr"></a>
</p>

---

<p align="center">
  <img src="./public/minitor.gif" alt="Minitor demo" width="100%" />
</p>

> **Monitor the current thing. Your dashboard for the internet.**
> Build a deck, pack it with columns, refresh on demand. Each column is a plugin: X, Bluesky, Reddit, Hacker News, Lobsters, GitHub (trending / issues / PRs / stars / forks / backlinks / search / releases), Farcaster, Mastodon, YouTube, RSS, Google News, Bing, Substack, LinkedIn, Facebook, Instagram, Apple + Google Play reviews, on-chain wallet activity, Polymarket prediction markets, and the six biggest Chinese platforms (Weibo / Zhihu / Douyin / Bilibili / Toutiao / Baidu).

### What it does

- You name a deck. Minitor packs it with whatever you're watching.
- 35 column types out of the box — social feeds, news, GitHub, app reviews, on-chain transactions, prediction markets, Chinese hot boards.
- Refresh per column or auto-fetch on creation. Load more pages 10 at a time.
- ⌘K command palette over every deck, column, and action. Drag to reorder.
- Local-first by default — embedded PGlite, no Postgres install needed.

### Quick start

The recommended path: **one command, `./minitor`.** First column up in under a minute, zero infra.

**Prereqs** — Node 20+. That's it. PGlite is bundled (real Postgres compiled to WASM), so no Docker, no hosted database, no setup.

```bash
git clone https://github.com/aaronjmars/minitor.git && cd minitor
./minitor
```

The launcher checks Node, picks the right package manager (npm / pnpm / yarn / bun based on lockfile), installs deps, copies `.env.example` → `.env.local` if missing, runs DB migrations against PGlite, and starts the dev server at `http://localhost:3000`. Re-running it just starts the server.

For Grok / X / News / Web / Farcaster columns, paste your **[xAI API key](https://console.x.ai/)** into `XAI_API_KEY` in `.env.local`. Keyless columns (Reddit, HN, Lobsters, Bluesky, Mastodon, RSS, Google News, Bing, GitHub, China Hot, YouTube channel/playlist, app reviews, wallet transactions, Polymarket) work out of the box with no keys.

**Other launcher subcommands:**

```bash
./minitor build      # production build
./minitor start      # production server (after build)
./minitor migrate    # run DB migrations only
./minitor doctor     # print environment diagnostics
./minitor reset      # wipe the local PGlite data dir
./minitor help       # full usage
```

### Column types

| Category | Columns |
|----------|---------|
| **Social — X / Bluesky / Reddit / HN / Farcaster / Mastodon** (7) | `x-search`, `x-trending`, `bluesky`, `reddit`, `hacker-news`, `farcaster`, `mastodon` |
| **GitHub** (8) | `github-trending`, `github-releases`, `github-issues`, `github-prs`, `github-stars`, `github-forks`, `github-search`, `github-backlinks` |
| **News & web** (5) | `bing` (Web search), `google-news`, `news-search`, `rss`, `lobsters` |
| **Long-form & video** (3) | `substack`, `youtube`, `linkedin` |
| **Mention monitors** (2) | `facebook`, `instagram` |
| **Apps & on-chain** (4) | `apple-reviews`, `play-reviews`, `wallet-tx`, `polymarket` |
| **China hot boards** (6) | `weibo-hot`, `zhihu-hot`, `douyin-hot`, `bilibili-hot`, `toutiao`, `baidu-hot` |

Full plugin manifest: [`lib/columns/plugins/manifest.ts`](lib/columns/plugins/manifest.ts). Add a new source by copying [`lib/columns/plugins/_template/`](lib/columns/plugins/_template/) — see [`lib/columns/README.md`](lib/columns/README.md) for the full contract.

**Keys:** `XAI_API_KEY` for `x-*`, `news-search`, `linkedin`, `facebook`, `instagram` (and Substack's keyword-only mode). Optional `NEYNAR_API_KEY` for Farcaster (demo-key fallback works), optional `YOUTUBE_API_KEY` for YouTube *search* (channel / playlist Atom feeds are keyless). Everything else runs without keys.

### Features

| Category | Highlights |
|----------|-----------|
| **Launcher** (6) | `./minitor` (dev), `./minitor build`, `./minitor start`, `./minitor migrate`, `./minitor doctor`, `./minitor reset` — auto-detects npm / pnpm / yarn / bun, idempotent re-runs |
| **Plugin system** (4) | 3-file folders (`plugin.ts`, `client.tsx`, `server.ts`), Zod-validated configs, init-time parity check across 3 registries, copy-paste `_template/` to add a source |
| **Pagination** (3) | Cursor-based `{ items, nextCursor? }` everywhere, 10 items per page, Load more + End of results states; slice helper at `lib/columns/paginate.ts` for non-cursor sources |
| **Database** (4) | PGlite default (zero install), node-postgres for self-hosted, `@neondatabase/serverless` HTTP driver for Neon, runtime selector by `DATABASE_URL` |
| **UI** (7) | ⌘K command palette, `@dnd-kit` drag-reorder, conic-gradient refresh beam (CSS-only), live-ticking timestamps (1Hz `useSyncExternalStore`), onboarding flow, missing-key dimming on Add column, full-column loading skeleton |
| **State** (3) | zustand + server-action writes, optimistic mutations, no localStorage (every device sees the same state) |

### Use cases

- **Founder dashboard** — your X mentions, Hacker News, Product Hunt RSS, GitHub stars on your repo, App Store reviews, Substack analytics, all on one screen
- **Crypto desk** — wallet activity across 9 chains, X trending in crypto, Reddit r/cryptocurrency, news search for protocol names
- **Open-source maintainer** — GitHub trending in your language, new issues / PRs across watched repos, new stargazers + forks, backlinks from HN / Reddit / news for your repo URL
- **Journalist** — Google News + Bing + xAI news search on a topic, paired with X trending and Reddit threads, plus Substack publications you trust
- **PM / marketing** — Apple + Google Play reviews on your app, Twitter mentions, LinkedIn / Facebook / Instagram mentions, Substack write-ups
- **China-watcher** — Weibo, Zhihu, Douyin, Bilibili, Toutiao, and Baidu hot boards in one column stack
- **Personal radar** — RSS for the blogs that matter, Farcaster for the casts that matter, no algorithmic feed in sight

### Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind v4** + **shadcn/ui** (`base-nova` style on `@base-ui/react`)
- **Drizzle ORM** with three runtime drivers (PGlite default / node-postgres / `@neondatabase/serverless`)
- **xAI Agent Tools API** (`/v1/responses` with `x_search` + `web_search`) — Grok-powered search backbone
- **zustand** for client state with server-action writes
- **@dnd-kit** for sortable decks + columns
- **sonner** toasts, **cmdk** command palette, **Instrument Serif** + Geist fonts

### Pointing at a different database

Set `DATABASE_URL` in `.env.local`:

| URL form | Driver picked |
|---|---|
| *unset* / `pglite:` / `file:` / `memory:` | PGlite (file at `.minitor/pgdata/`) |
| `postgres://user:pass@localhost/minitor` | node-postgres |
| `postgresql://…@…neon.tech/…?sslmode=require` | `@neondatabase/serverless` HTTP |

`./minitor migrate` and the runtime client honor the same selector (`lib/db/client.ts:resolveDatabaseConfig`).

### Documentation

| | |
|---|---|
| [Plugin contract](lib/columns/README.md) | The 3-file plugin pattern + how to add a new column type |
| [`lib/columns/types.ts`](lib/columns/types.ts) | `ColumnUI`, `ColumnServer`, `PluginMeta`, `FeedItem`, `PageResult`, `Capabilities` |
| [`lib/columns/plugins/manifest.ts`](lib/columns/plugins/manifest.ts) | Canonical plugin id list — single source of truth |
| [`lib/columns/paginate.ts`](lib/columns/paginate.ts) | Slice-based cursor pagination helper for non-cursor sources |
| [`lib/db/client.ts`](lib/db/client.ts) | Multi-driver Drizzle client (PGlite / pg / Neon HTTP) |
| [`scripts/db-migrate.mjs`](scripts/db-migrate.mjs) | The migration runner used by `./minitor migrate` |

### Deployment

- Vercel or any Node host works. Set `DATABASE_URL` and `XAI_API_KEY` as env vars.
- `@neondatabase/serverless` uses the HTTP driver (no websockets in serverless), so Neon's pooled connection string is required.
- `app/api/columns/[type]/route.ts` is `dynamic = "force-dynamic"` and `maxDuration = 60` for Grok latency.

### Security

- `.env.local` is gitignored — only `.env.example` ships.
- Server actions call xAI / Neynar / GitHub server-side; API keys never reach the client.
- The add-column dialog asks the server which env keys are *present* (boolean only, values never leave the server) to grey out plugins you can't use.
- No auth layer: every browser hitting your deployment sees the same decks. To partition per user, add a `user_id` column to each table and filter in the server actions.

## License

MIT.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=aaronjmars/minitor&type=Date)](https://www.star-history.com/#aaronjmars/minitor&Date)
