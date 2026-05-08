import "server-only";

import {
  defineColumnServer,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchHuggingfacePage } from "@/lib/integrations/huggingface";
import { PAGE_SIZE } from "@/lib/columns/constants";
import {
  meta,
  type HuggingfaceConfig,
  type HuggingfaceMeta,
} from "./plugin";

const fetch: ServerFetcher<HuggingfaceConfig, HuggingfaceMeta> = async (
  config,
  cursor,
) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  const r = await fetchHuggingfacePage(
    config.resource,
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

export const server = defineColumnServer<HuggingfaceConfig, HuggingfaceMeta>({
  meta,
  fetch,
});
