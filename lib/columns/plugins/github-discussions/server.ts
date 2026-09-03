import "server-only";

import { defineColumnServer, type ServerFetcher } from "@/lib/columns/types";
import { fetchDiscussions } from "@/lib/integrations/github-discussions";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type GHDiscussionsConfig, type GHDiscussionsMeta } from "./plugin";

const fetch: ServerFetcher<GHDiscussionsConfig, GHDiscussionsMeta> = async (config, cursor) => {
  const repo = config.repo.trim();
  if (!repo) throw new Error("Repository is required (owner/repo).");
  // GraphQL doesn't expose a native cursor for the orderings we use here
  // (CREATED_AT for recent / unanswered, in-memory upvote sort for top), so we
  // follow the same pattern as github-actions and producthunt: pull a generous
  // batch once and slice it for pagination via `sliceForPage`.
  const items = await fetchDiscussions(repo, config.mode, 50);
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<GHDiscussionsConfig, GHDiscussionsMeta>({
  meta,
  fetch,
});
