import "server-only";

import { defineColumnServer, type ServerFetcher } from "@/lib/columns/types";
import { fetchProductHuntPage } from "@/lib/integrations/producthunt";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type ProductHuntConfig, type ProductHuntMeta } from "./plugin";

const fetch: ServerFetcher<ProductHuntConfig, ProductHuntMeta> = async (config, cursor) => {
  // The PH feed is a fixed daily window — there's no native cursor to thread.
  // Pull a generous batch once and slice it locally; the same pattern Substack
  // and other RSS-backed plugins use.
  const items = await fetchProductHuntPage(config.mode, config.topic, 50);
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<ProductHuntConfig, ProductHuntMeta>({
  meta,
  fetch,
});
