import "server-only";

import {
  defineColumnServer,
  type FeedItem,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchCommits } from "@/lib/integrations/github";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type GHCommitsConfig, type GHCommitsMeta } from "./plugin";

const fetch: ServerFetcher<GHCommitsConfig, GHCommitsMeta> = async (
  config,
  cursor,
) => {
  const repo = config.repo.trim();
  if (!repo) throw new Error("Repository is required (owner/repo).");
  const page = cursor ? Number(cursor) || 1 : 1;
  const items = (await fetchCommits(
    repo,
    config.branch,
    PAGE_SIZE,
    page,
  )) as FeedItem<GHCommitsMeta>[];
  return {
    items,
    nextCursor: items.length === PAGE_SIZE ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<GHCommitsConfig, GHCommitsMeta>({
  meta,
  fetch,
});
