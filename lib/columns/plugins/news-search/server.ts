import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { grokNewsSearch } from "@/lib/integrations/xai";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type NewsSearchConfig, type NewsSearchMeta } from "./plugin";

const fetch: ServerFetcher<NewsSearchConfig, NewsSearchMeta> = async (config, cursor) => {
  const q = config.query.trim();
  if (!q) throw new Error("Search query is required.");

  const items = (await grokNewsSearch(q, 30)) as FeedItem<NewsSearchMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<NewsSearchConfig, NewsSearchMeta>({
  meta,
  fetch,
});
