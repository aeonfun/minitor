import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchFeed } from "@/lib/integrations/rss";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type RssConfig, type RssMeta } from "./plugin";

const fetch: ServerFetcher<RssConfig, RssMeta> = async (config, cursor) => {
  const items = (await fetchFeed(config.url, 50)) as FeedItem<RssMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<RssConfig, RssMeta>({ meta, fetch });
