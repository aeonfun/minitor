# Contributing to Minitor

Thanks for helping build Minitor — the dashboard for the current thing. The most common and most welcome contribution is **a new column type**: another source to watch. This guide covers local setup, the project layout, how to add a column, and the conventions that keep the codebase coherent.

## Local setup

**Prereqs:** Node 20+. That's the whole list — PGlite is bundled (real Postgres compiled to WASM), so there's no Docker, no hosted database, no migrations to wire up by hand.

```bash
git clone https://github.com/aaronjmars/minitor.git && cd minitor
./minitor
```

The launcher checks Node, picks your package manager from the lockfile (npm / pnpm / yarn / bun), installs deps, copies `.env.example` → `.env.local`, runs the PGlite migrations, and starts the dev server at `http://localhost:3000`. Re-running `./minitor` just starts the server.

Most columns are **keyless** and work immediately. The keyed ones degrade gracefully — paste an `XAI_API_KEY` for the `x-*` / `news-search` / mention columns, an optional `GITHUB_TOKEN` to lift the `github-*` rate limit, etc. (see the [README key list](README.md#column-types)). Build a contribution against a keyless source if you can; it's easier for reviewers to verify.

## Project layout

| Path | What lives there |
|------|------------------|
| `lib/columns/plugins/<id>/` | One folder per column type — `plugin.ts` (metadata + Zod schema), `client.tsx` (UI), `server.ts` (fetcher) |
| `lib/columns/plugins/manifest.ts` | Canonical list of which column ids exist — the single source of truth |
| `lib/columns/registry.ts` | Client-UI registry (one import per plugin) |
| `lib/columns/server-registry.ts` | Server-fetcher registry + the init-time parity check |
| `lib/integrations/<source>.ts` | Upstream HTTP clients — the network details a `server.ts` calls into |
| `lib/db/` | Drizzle client (PGlite / node-postgres / Neon) and schema |
| `app/` | Next.js App Router — the deck UI and the shared `api/columns/[type]` route |

## Adding a column type

A column is a self-contained three-file plugin. You do **not** write an API route, a config dialog, drag-and-drop, or pagination — the framework wires all of that from the metadata you declare.

The full contract — file responsibilities, the `"use client"` / `"server-only"` split, the Zod schema rules, and the renderer types — lives in **[`lib/columns/README.md`](lib/columns/README.md)**. Read it before you start. The short version:

1. **Copy `lib/columns/plugins/_template/`** to `lib/columns/plugins/<your-id>/` and rename. (`_template/` is intentionally unregistered — it's a starting point, not a live column.)
2. **`plugin.ts`** — set a unique kebab-case `id`, a Zod `schema` with a `.default()` on every field, the `TMeta` item type, an `icon` + `accent`, a `category`, and `capabilities`.
3. **`client.tsx`** — implement `ConfigForm` + `ItemRenderer`, wrapped with `defineColumnUI`.
4. **`server.ts`** — implement the `ServerFetcher`; keep the actual upstream HTTP client in `lib/integrations/<source>.ts` and import it here.
5. **Register in three places:** add your plugin to `manifest.ts` (the id source of truth), `registry.ts` (client UI), and `server-registry.ts` (server fetcher).
6. **Run `npm run build`.** A parity check at module init throws if the manifest and the two registries disagree, so a missing registration fails the build rather than 404'ing at runtime.

When your column ships, add it to the README's column table and bump the count so the catalog stays accurate.

## Conventions

- **Keyless-first.** Prefer sources that work without an API key. If a key is needed, declare it in the plugin's `capabilities` so the Add-column dialog can dim the column when the key is absent — never hard-fail a missing key.
- **Respect the client/server split.** `plugin.ts` carries no JSX and no server-only imports so both halves can read it; `client.tsx` is `"use client"`, `server.ts` is `import "server-only"`. Keys and upstream calls never reach the browser.
- **Cursors are opaque.** Return `{ items, nextCursor? }`; encode whatever your upstream paginates on (page number, after-token) as a string and treat it as a black box on the way back. For non-cursor sources, use the slice helper in `lib/columns/paginate.ts`.
- **Match the surrounding code.** TypeScript throughout, Tailwind v4 + shadcn/ui for UI, Drizzle for data. Follow the patterns in the nearest existing plugin rather than introducing new ones.
- **Don't reach across boundaries.** A plugin owns its three files and its integration module; it shouldn't import from the registries or patch framework internals.

## Pull requests

- **Branch from `main`** with a descriptive name (`feat/<column>`, `fix/...`, `docs/...`). Never push to `main`.
- **One change per PR.** A focused new column or fix lands faster than a bundle.
- **Run the checks before pushing:** `npm run build` (this also runs the registry parity check) and `npm run lint`. A green build is the bar.
- Write a clear title and describe what the column watches (or what the fix changes) and how you verified it.

## Reporting bugs and requesting columns

Open an issue. For a bug, include the column type, what you expected vs. saw, and whether a key was involved. For a new column request, name the source and link its public API or feed if there is one.

## License

By contributing, you agree your contributions are licensed under the repository's MIT [LICENSE](README.md#license).
