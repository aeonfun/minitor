import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchGitHub } from "@/lib/integrations/github";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type GHReleasesConfig, type GHReleasesMeta } from "./plugin";

const fetch: ServerFetcher<GHReleasesConfig, GHReleasesMeta> = async (config, cursor) => {
  const repo = config.repo.trim();
  if (!repo) throw new Error("Repository is required (owner/repo).");
  const page = cursor ? Number(cursor) || 1 : 1;
  const all = (await fetchGitHub(
    "releases",
    { repo },
    PAGE_SIZE,
    page,
  )) as FeedItem<GHReleasesMeta>[];
  const items = config.includePrereleases ? all : all.filter((it) => !it.meta?.prerelease);
  // Pagination cursor mirrors github-trending: when the upstream page is full,
  // there may be more on the next page. Filtering pre-releases shortens the
  // visible page but doesn't shorten the upstream — so use `all.length` for
  // the has-more decision, not `items.length`.
  return {
    items,
    nextCursor: all.length === PAGE_SIZE ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<GHReleasesConfig, GHReleasesMeta>({
  meta,
  fetch,
});
