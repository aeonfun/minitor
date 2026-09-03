import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchNewsNow } from "@/lib/integrations/newsnow";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type BaiduHotConfig, type BaiduHotMeta } from "./plugin";

const fetch: ServerFetcher<BaiduHotConfig, BaiduHotMeta> = async (_config, cursor) => {
  const items = (await fetchNewsNow("baidu", 50)) as FeedItem<BaiduHotMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<BaiduHotConfig, BaiduHotMeta>({
  meta,
  fetch,
});
