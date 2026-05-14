import "server-only";

import {
  defineColumnServer,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchCratesPage } from "@/lib/integrations/crates";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type CratesConfig, type CratesMeta } from "./plugin";

const fetch: ServerFetcher<CratesConfig, CratesMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  const r = await fetchCratesPage(config.query, config.sort, PAGE_SIZE, page);
  return {
    items: r.items,
    nextCursor: r.hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<CratesConfig, CratesMeta>({
  meta,
  fetch,
});
