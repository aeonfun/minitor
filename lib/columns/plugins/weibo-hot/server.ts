import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchNewsNow } from "@/lib/integrations/newsnow";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type WeiboHotConfig, type WeiboHotMeta } from "./plugin";

const fetch: ServerFetcher<WeiboHotConfig, WeiboHotMeta> = async (_config, cursor) => {
  const items = (await fetchNewsNow("weibo", 50)) as FeedItem<WeiboHotMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<WeiboHotConfig, WeiboHotMeta>({
  meta,
  fetch,
});
