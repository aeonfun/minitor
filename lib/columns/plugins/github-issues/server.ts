import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchGitHub } from "@/lib/integrations/github";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type GHIssuesConfig, type GHIssuesMeta } from "./plugin";

const fetch: ServerFetcher<GHIssuesConfig, GHIssuesMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 1 : 1;
  const items = (await fetchGitHub(
    "issues",
    { query: config.query },
    PAGE_SIZE,
    page,
  )) as FeedItem<GHIssuesMeta>[];
  return {
    items,
    nextCursor: items.length === PAGE_SIZE ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<GHIssuesConfig, GHIssuesMeta>({
  meta,
  fetch,
});
