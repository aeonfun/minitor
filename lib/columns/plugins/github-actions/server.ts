import "server-only";

import {
  defineColumnServer,
  type ServerFetcher,
} from "@/lib/columns/types";
import { fetchWorkflowRuns } from "@/lib/integrations/github";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type GHActionsConfig, type GHActionsMeta } from "./plugin";

const fetch: ServerFetcher<GHActionsConfig, GHActionsMeta> = async (
  config,
  cursor,
) => {
  const repo = config.repo.trim();
  if (!repo) throw new Error("Repository is required (owner/repo).");
  const page = cursor ? Number(cursor) || 1 : 1;
  // The integration returns FeedItem<GHActionRunMeta>, which is now an alias of
  // GHActionsMeta (the renderer contract this plugin owns and the integration
  // imports), so the items flow through with no cast.
  const { items, hasMore } = await fetchWorkflowRuns(
    repo,
    config.workflow,
    config.branch,
    PAGE_SIZE,
    page,
  );
  return {
    items,
    nextCursor: hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<GHActionsConfig, GHActionsMeta>({
  meta,
  fetch,
});
