import "server-only";

import {
  defineColumnServer,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchStackOverflowPage } from "@/lib/integrations/stackoverflow";
import { PAGE_SIZE } from "@/lib/columns/constants";
import {
  meta,
  type StackOverflowConfig,
  type StackOverflowMeta,
} from "./plugin";

const fetch: ServerFetcher<StackOverflowConfig, StackOverflowMeta> = async (
  config,
  cursor,
) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  const r = await fetchStackOverflowPage(
    config.mode,
    config.tag,
    PAGE_SIZE,
    page,
  );
  return {
    items: r.items,
    nextCursor: r.hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<
  StackOverflowConfig,
  StackOverflowMeta
>({
  meta,
  fetch,
});
