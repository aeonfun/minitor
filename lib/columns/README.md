# Adding a new column type

A column type is a self-contained "plugin" that renders one kind of feed —
Reddit, GitHub, an X search, an Ethereum address watcher, anything. Each
plugin is three files in its own folder. Once you add the folder and one
import in each of the two registries, the rest of the dashboard wires it up
automatically.

## File layout

```
lib/columns/plugins/<your-id>/
  plugin.ts     # pure metadata: id, label, icon, Zod schema, defaultTitle
  client.tsx    # "use client" — ConfigForm + ItemRenderer
  server.ts     # "server-only" — fetch function (talks to upstream APIs)
```

The split is structural: `plugin.ts` has no JSX and no server-only deps so
it can be imported by both halves; `client.tsx` carries `"use client"`;
`server.ts` carries `import "server-only"`. Server code never reaches the
client bundle and vice versa.

## Step-by-step

1. **Copy `_template/`** to `lib/columns/plugins/<your-id>/` and rename it.
2. **Edit `plugin.ts`**:
   - Set a unique `id` (kebab-case).
   - Define your config shape with a Zod `schema`. Give every field a
     `.default()` so `schema.parse({})` produces the initial config.
   - Define a `TMeta` interface for `item.meta` (this types the renderer).
   - Pick an `icon` from lucide-react and an `accent` hex color.
   - Set `category` to one of `social | news | ai | video | blockchain | other`.
   - Set `capabilities` to declare paginated, required env vars, etc.
3. **Edit `client.tsx`** — implement `ConfigForm` and `ItemRenderer`, then
   wrap with `defineColumnUI({ ...meta, ConfigForm, ItemRenderer })`.
4. **Edit `server.ts`** — implement the `ServerFetcher`. The `config` you
   receive has already been validated against your Zod schema, so `config.foo`
   is fully typed and present. Note that _present_ is not _non-empty_: a field
   declared `z.string().default("")` always exists but can arrive as `""`. If
   your column needs a value to do anything, guard it before the network call
   (see the "Validate required inputs" convention below).
5. **Register both halves**:
   - In `lib/columns/registry.ts`, add an import and append to `ALL`.
   - In `lib/columns/server-registry.ts`, add an import and append to `ALL`.
6. **Run `npm run build`**. The parity check in `server-registry.ts` will
   throw at module init if either registry is missing your plugin.

## What you get for free

- A unified API route (`app/api/columns/[type]/route.ts`) — no per-plugin
  endpoint to write. The route looks up your fetcher, validates the config
  with your Zod schema, and returns the result.
- A typed renderer — `ItemRendererProps<TMeta>` means no `typeof m.score
  === "number"` guards.
- The "Add column" picker, "Configure column" dialog, drag-and-drop, refresh,
  Load more, optimistic mutations, and persistence. All driven by the
  declarative `ColumnUI` you registered.
- A capabilities note shown to the user before they create the column —
  `requiresEnv` and `rateLimitHint` surface automatically.

## Conventions

- **Validate required inputs at the top of `fetch`.** The Zod schema enforces
  types, not non-emptiness — `z.string().default("")` lets an empty `query`
  through. If your column can't run without a value, trim-and-throw before any
  upstream request so the user sees a clear error instead of a wasted call:

  ```ts
  const q = config.query.trim();
  if (!q) throw new Error("Search query is required.");
  ```

  Most input-driven columns follow this (`linkedin`, `youtube`, `reddit`,
  `mastodon`, and the `repo`-based `github-*` columns). Throwing here is caught
  by the shared API route and surfaced to the user as a fetch-error toast.
- Keep upstream HTTP clients in `lib/integrations/<source>.ts` and import
  them from `server.ts`. The plugin folder owns the dashboard contract; the
  integrations folder owns the network details.
- Cursor is opaque end-to-end — encode whatever your upstream uses (page
  number, after-token, etc.) as a string and treat it that way on the way
  back. The shared API client and column card never inspect it.
- Don't reach into `lib/columns/server-registry.ts` from your plugin. The
  fetcher logic lives in `your-id/server.ts`; the registry just imports it.
- `_template/` is intentionally NOT registered. It exists as a copyable
  starting point.
