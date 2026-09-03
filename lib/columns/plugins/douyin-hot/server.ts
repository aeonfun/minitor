import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchNewsNow } from "@/lib/integrations/newsnow";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type DouyinHotConfig, type DouyinHotMeta } from "./plugin";

const fetch: ServerFetcher<DouyinHotConfig, DouyinHotMeta> = async (_config, cursor) => {
  const items = (await fetchNewsNow("douyin", 50)) as FeedItem<DouyinHotMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<DouyinHotConfig, DouyinHotMeta>({
  meta,
  fetch,
});
