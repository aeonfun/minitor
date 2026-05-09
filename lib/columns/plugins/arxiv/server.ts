import "server-only";

import {
  defineColumnServer,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchArxivPage } from "@/lib/integrations/arxiv";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type ArxivConfig, type ArxivMeta } from "./plugin";

const fetch: ServerFetcher<ArxivConfig, ArxivMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  const r = await fetchArxivPage(
    config.category,
    config.mode,
    config.search,
    PAGE_SIZE,
    page,
  );
  return {
    items: r.items,
    nextCursor: r.hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<ArxivConfig, ArxivMeta>({
  meta,
  fetch,
});
