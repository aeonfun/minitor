import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchGitHub } from "@/lib/integrations/github";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type GHTrendingConfig, type GHTrendingMeta } from "./plugin";

const fetch: ServerFetcher<GHTrendingConfig, GHTrendingMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 1 : 1;
  const items = (await fetchGitHub(
    "trending",
    { language: config.language, period: config.period },
    PAGE_SIZE,
    page,
  )) as FeedItem<GHTrendingMeta>[];
  return {
    items,
    nextCursor: items.length === PAGE_SIZE ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<GHTrendingConfig, GHTrendingMeta>({
  meta,
  fetch,
});
