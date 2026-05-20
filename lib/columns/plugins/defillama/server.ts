import "server-only";

import {
  defineColumnServer,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchDefillamaPage } from "@/lib/integrations/defillama";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type DefillamaConfig, type DefillamaMeta } from "./plugin";

const fetch: ServerFetcher<DefillamaConfig, DefillamaMeta> = async (
  config,
  cursor,
) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  const r = await fetchDefillamaPage(
    config.mode,
    config.category,
    PAGE_SIZE,
    page,
  );
  return {
    items: r.items,
    nextCursor: r.hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<DefillamaConfig, DefillamaMeta>({
  meta,
  fetch,
});
