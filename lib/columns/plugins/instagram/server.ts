import "server-only";

// Backend choice: Grok web_search with site:instagram.com — IG's Graph API
// has no public hashtag/keyword search, so web search is the easiest path.

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchInstagram } from "@/lib/integrations/instagram";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type InstagramConfig, type InstagramMeta } from "./plugin";

const fetch: ServerFetcher<InstagramConfig, InstagramMeta> = async (config, cursor) => {
  const q = config.query.trim();
  if (!q) throw new Error("Search query is required.");

  const items = (await fetchInstagram(q, 30)) as FeedItem<InstagramMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<InstagramConfig, InstagramMeta>({
  meta,
  fetch,
});
