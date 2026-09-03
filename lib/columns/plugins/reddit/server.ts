import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchSubredditPage } from "@/lib/integrations/reddit";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type RedditConfig, type RedditMeta } from "./plugin";

const fetch: ServerFetcher<RedditConfig, RedditMeta> = async (config, cursor) => {
  const r = await fetchSubredditPage(
    config.subreddit || "popular",
    config.sortBy,
    PAGE_SIZE,
    cursor,
  );
  return {
    items: r.items as FeedItem<RedditMeta>[],
    nextCursor: r.nextAfter,
  };
};

export const server = defineColumnServer<RedditConfig, RedditMeta>({
  meta,
  fetch,
});
