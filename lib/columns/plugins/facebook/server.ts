import "server-only";

// Facebook's Graph API has no public mention search and aggressively blocks
// anonymous scraping, so we piggyback on Grok's web_search with a
// site:facebook.com filter — no extra env beyond XAI_API_KEY.

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { grokFacebookSearch } from "@/lib/integrations/xai";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type FacebookConfig, type FacebookMeta } from "./plugin";

const fetch: ServerFetcher<FacebookConfig, FacebookMeta> = async (config, cursor) => {
  const q = config.query.trim();
  if (!q) throw new Error("Search query is required.");

  const items = (await grokFacebookSearch(q, 30)) as FeedItem<FacebookMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<FacebookConfig, FacebookMeta>({
  meta,
  fetch,
});
