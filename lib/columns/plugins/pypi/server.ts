import "server-only";

import {
  defineColumnServer,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchPypiPage } from "@/lib/integrations/pypi";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type PypiConfig, type PypiMeta } from "./plugin";

const fetch: ServerFetcher<PypiConfig, PypiMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  const r = await fetchPypiPage(config.mode, config.keyword, PAGE_SIZE, page);
  return {
    items: r.items,
    nextCursor: r.hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<PypiConfig, PypiMeta>({
  meta,
  fetch,
});
