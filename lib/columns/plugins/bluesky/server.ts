import "server-only";

import {
  defineColumnServer,
  type FeedItem,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchBlueskyPage } from "@/lib/integrations/bluesky";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type BlueskyConfig, type BlueskyMeta } from "./plugin";

const fetch: ServerFetcher<BlueskyConfig, BlueskyMeta> = async (
  config,
  cursor,
) => {
  if (config.mode === "author") {
    if (!config.handle.trim()) throw new Error("Author handle is required.");
  } else if (!config.query.trim()) {
    throw new Error("Search query is required.");
  }

  const r = await fetchBlueskyPage(
    config.mode,
    config.query,
    config.handle,
    PAGE_SIZE,
    cursor,
  );
  return {
    items: r.items as FeedItem<BlueskyMeta>[],
    nextCursor: r.nextCursor,
  };
};

export const server = defineColumnServer<BlueskyConfig, BlueskyMeta>({
  meta,
  fetch,
});
