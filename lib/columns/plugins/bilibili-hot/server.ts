import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchNewsNow } from "@/lib/integrations/newsnow";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type BilibiliHotConfig, type BilibiliHotMeta } from "./plugin";

const fetch: ServerFetcher<BilibiliHotConfig, BilibiliHotMeta> = async (_config, cursor) => {
  const items = (await fetchNewsNow("bilibili-hot-search", 50)) as FeedItem<BilibiliHotMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<BilibiliHotConfig, BilibiliHotMeta>({
  meta,
  fetch,
});
