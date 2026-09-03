import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { grokXSearch } from "@/lib/integrations/xai";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type XSearchConfig, type TweetMeta } from "./plugin";

const fetch: ServerFetcher<XSearchConfig, TweetMeta> = async (config, cursor) => {
  const q = config.query.trim();
  if (!q) throw new Error("Search query is required.");

  const items = (await grokXSearch(q, 30)) as FeedItem<TweetMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<XSearchConfig, TweetMeta>({
  meta,
  fetch,
});
