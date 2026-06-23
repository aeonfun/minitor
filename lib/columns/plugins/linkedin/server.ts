import "server-only";

// Approach: xAI Grok web_search with a site:linkedin.com/posts filter — the
// official LinkedIn API is closed for public search.
// See lib/integrations/linkedin.ts.

import {
  defineColumnServer,
  type FeedItem,
  type ServerFetcher,
} from "@/lib/columns/types";
import { searchLinkedinPosts } from "@/lib/integrations/linkedin";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type LinkedinConfig, type LinkedinMeta } from "./plugin";

const fetch: ServerFetcher<LinkedinConfig, LinkedinMeta> = async (
  config,
  cursor,
) => {
  const q = config.query.trim();
  if (!q) throw new Error("Search query is required.");

  const items = (await searchLinkedinPosts(
    q,
    30,
  )) as FeedItem<LinkedinMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<LinkedinConfig, LinkedinMeta>({
  meta,
  fetch,
});
