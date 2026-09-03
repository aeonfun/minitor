import "server-only";

import { defineColumnServer, type ServerFetcher } from "@/lib/columns/types";
import { fetchCoingeckoPage } from "@/lib/integrations/coingecko";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type CoingeckoConfig, type CoingeckoMeta } from "./plugin";

const fetch: ServerFetcher<CoingeckoConfig, CoingeckoMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  const r = await fetchCoingeckoPage(config.mode, config.watchlist, PAGE_SIZE, page);
  return {
    items: r.items,
    nextCursor: r.hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<CoingeckoConfig, CoingeckoMeta>({
  meta,
  fetch,
});
