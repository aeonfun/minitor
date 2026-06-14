import "server-only";

import {
  defineColumnServer,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchDexscreenerItems } from "@/lib/integrations/dexscreener";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type DexscreenerConfig, type DexscreenerMeta } from "./plugin";

// Dexscreener's search/tokens endpoints return a full list in one shot (no
// native cursor), so we fetch once and hand out pages via the shared
// slice-paginator — same approach as the other list-style crypto columns.
const fetch: ServerFetcher<DexscreenerConfig, DexscreenerMeta> = async (
  config,
  cursor,
) => {
  const items = await fetchDexscreenerItems(
    config.mode,
    config.query,
    config.watchlist,
  );
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<DexscreenerConfig, DexscreenerMeta>({
  meta,
  fetch,
});
