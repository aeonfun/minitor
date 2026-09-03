import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchBacklinks } from "@/lib/integrations/github-backlinks";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type BacklinksConfig, type BacklinksItemMeta } from "./plugin";

// Fan-out across HN (URL-indexed), Reddit search, Google News, Bing News,
// optionally GitHub issue search; dedup on canonical URL.
const fetch: ServerFetcher<BacklinksConfig, BacklinksItemMeta> = async (config, cursor) => {
  const items = (await fetchBacklinks({
    repo: config.repo,
    includeIssues: config.includeIssues,
    limitPerSource: 12,
  })) as FeedItem<BacklinksItemMeta>[];
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<BacklinksConfig, BacklinksItemMeta>({
  meta,
  fetch,
});
