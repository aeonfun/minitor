import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { grokXTrending } from "@/lib/integrations/xai";
import { sliceForPage } from "@/lib/columns/paginate";
import type { TweetMeta } from "@/lib/columns/plugins/x-search/plugin";
import { meta, type XTrendingConfig } from "./plugin";

const fetch: ServerFetcher<XTrendingConfig, TweetMeta> = async (config, cursor) => {
  const items = (await grokXTrending(config.topic, 30)) as FeedItem<TweetMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<XTrendingConfig, TweetMeta>({
  meta,
  fetch,
});
