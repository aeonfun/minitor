import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchFeed, googleNewsUrl } from "@/lib/integrations/rss";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type GoogleNewsConfig, type GoogleNewsMeta } from "./plugin";

const fetch: ServerFetcher<GoogleNewsConfig, GoogleNewsMeta> = async (config, cursor) => {
  const q = config.query.trim();
  if (!q) throw new Error("Search query is required.");

  const items = (await fetchFeed(
    googleNewsUrl(q, config.hl, config.gl),
    50,
  )) as FeedItem<GoogleNewsMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<GoogleNewsConfig, GoogleNewsMeta>({
  meta,
  fetch,
});
