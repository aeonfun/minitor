import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchHackerNewsPage } from "@/lib/integrations/hackernews";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type HNConfig, type HNMeta } from "./plugin";

const fetch: ServerFetcher<HNConfig, HNMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  const r = await fetchHackerNewsPage(config.mode, config.query, PAGE_SIZE, page);
  return {
    items: r.items as FeedItem<HNMeta>[],
    nextCursor: r.hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<HNConfig, HNMeta>({ meta, fetch });
