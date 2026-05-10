import "server-only";

import {
  defineColumnServer,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchDevtoPage } from "@/lib/integrations/devto";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type DevtoConfig, type DevtoMeta } from "./plugin";

const fetch: ServerFetcher<DevtoConfig, DevtoMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  const r = await fetchDevtoPage(config.mode, config.tag, PAGE_SIZE, page);
  return {
    items: r.items,
    nextCursor: r.hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<DevtoConfig, DevtoMeta>({
  meta,
  fetch,
});
