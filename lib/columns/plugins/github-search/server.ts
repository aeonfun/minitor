import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { searchGitHub } from "@/lib/integrations/github";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type GHSearchConfig, type GHSearchMeta } from "./plugin";

const fetch: ServerFetcher<GHSearchConfig, GHSearchMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 1 : 1;
  const items = (await searchGitHub(
    config.scope,
    config.query,
    PAGE_SIZE,
    page,
  )) as FeedItem<GHSearchMeta>[];
  return {
    items,
    nextCursor: items.length === PAGE_SIZE ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<GHSearchConfig, GHSearchMeta>({
  meta,
  fetch,
});
