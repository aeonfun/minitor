import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchNewsNow } from "@/lib/integrations/newsnow";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type ToutiaoConfig, type ToutiaoMeta } from "./plugin";

const fetch: ServerFetcher<ToutiaoConfig, ToutiaoMeta> = async (_config, cursor) => {
  const items = (await fetchNewsNow("toutiao", 50)) as FeedItem<ToutiaoMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<ToutiaoConfig, ToutiaoMeta>({
  meta,
  fetch,
});
