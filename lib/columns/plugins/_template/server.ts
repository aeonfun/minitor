import "server-only";

// _template/server.ts — the server half of a plugin. Lives in a "server-only"
// module so it can use API keys, talk to upstream services, and parse cursors
// without ever leaking to the client bundle. Receives a config that's already
// been validated against `meta.schema` by the API route.

import { defineColumnServer, type ServerFetcher } from "@/lib/columns/types";
import { meta, type TemplateConfig, type TemplateMeta } from "./plugin";

const fetch: ServerFetcher<TemplateConfig, TemplateMeta> = async (
  config,
  // cursor, // present when the user clicks "Load more" (only if capabilities.paginated)
) => {
  // Validate required inputs before any upstream call. The Zod schema runs
  // first, so `config.query` is always present and typed — but `.default("")`
  // means "present" can still be an empty string. If your column can't do
  // anything useful without a value, trim-and-throw here so an empty config
  // surfaces a clear "X is required." instead of firing a wasted upstream
  // request that returns an opaque error. Every input-driven column does this
  // (see e.g. `linkedin/server.ts`, `youtube/server.ts`):
  //
  //   const q = config.query.trim();
  //   if (!q) throw new Error("Search query is required.");
  //
  // This hello-world template intentionally works with an empty query, so it
  // skips the guard — delete this comment and add the check once your column
  // has a required field.

  // Talk to your integration here. Return `{ items, nextCursor? }`.
  // - `items` is `FeedItem<TemplateMeta>[]`. Make sure each item has a stable id.
  // - `nextCursor` is opaque to the rest of the app — encode whatever your
  //   upstream paginates with (page number, after-token, page-token).
  return {
    items: [
      {
        id: `${config.query}-1`,
        author: { name: "Template" },
        content: `Hello, ${config.query || "world"}`,
        url: "https://example.com",
        createdAt: new Date().toISOString(),
        meta: { source: "template" },
      },
    ],
  };
};

export const server = defineColumnServer<TemplateConfig, TemplateMeta>({
  meta,
  fetch,
});
