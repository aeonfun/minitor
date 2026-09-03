import "server-only";

import { defineColumnServer, type ServerFetcher } from "@/lib/columns/types";
import { fetchPullRequests } from "@/lib/integrations/github";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type GHPRConfig, type GHPRMeta } from "./plugin";

const fetch: ServerFetcher<GHPRConfig, GHPRMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 1 : 1;
  const items = await fetchPullRequests(config.repo, config.state, config.sort, PAGE_SIZE, page);
  return {
    items,
    nextCursor: items.length === PAGE_SIZE ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<GHPRConfig, GHPRMeta>({ meta, fetch });
