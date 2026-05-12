import "server-only";

import {
  defineColumnServer,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchNpmPage } from "@/lib/integrations/npm";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type NpmConfig, type NpmMeta } from "./plugin";

const fetch: ServerFetcher<NpmConfig, NpmMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  const r = await fetchNpmPage(config.query, config.mode, PAGE_SIZE, page);
  return {
    items: r.items,
    nextCursor: r.hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<NpmConfig, NpmMeta>({
  meta,
  fetch,
});
