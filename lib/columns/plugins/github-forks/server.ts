import "server-only";

import { defineColumnServer, type ServerFetcher } from "@/lib/columns/types";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { fetchForks } from "@/lib/integrations/github";
import type { GHWatcherItemMeta } from "@/lib/integrations/github";
import { meta, type GHForksConfig } from "./plugin";

const fetch: ServerFetcher<GHForksConfig, GHWatcherItemMeta> = async (config, cursor) => {
  const repo = config.repo.trim();
  if (!repo) throw new Error("Repository is required (owner/repo).");
  return fetchForks(repo, PAGE_SIZE, cursor);
};

export const server = defineColumnServer<GHForksConfig, GHWatcherItemMeta>({
  meta,
  fetch,
});
