import "server-only";

import {
  defineColumnServer,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchPolymarketPage } from "@/lib/integrations/polymarket";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type PolymarketConfig, type PolymarketMeta } from "./plugin";

const fetch: ServerFetcher<PolymarketConfig, PolymarketMeta> = async (
  config,
  cursor,
) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  // Tag mode requires a tag — fall back to trending if the user picked tag
  // without filling one in, so the column always renders the most-traded
  // markets rather than throwing on an empty `tag_slug=`.
  const effectiveMode =
    config.mode === "tag" && !config.tag.trim() ? "trending" : config.mode;
  const r = await fetchPolymarketPage(
    effectiveMode,
    config.tag,
    PAGE_SIZE,
    page,
  );
  return {
    items: r.items,
    nextCursor: r.hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<PolymarketConfig, PolymarketMeta>({
  meta,
  fetch,
});
