import "server-only";

import { defineColumnServer, type ServerFetcher } from "@/lib/columns/types";
import { PAGE_SIZE } from "@/lib/columns/constants";
import {
  fetchAeonOutputs,
  fetchAeonDashboardRuns,
  fetchAeonGithubRuns,
  fetchAeonArticles,
} from "@/lib/integrations/aeon";
import { meta, type AeonConfig, type AeonMeta } from "./plugin";

const fetch: ServerFetcher<AeonConfig, AeonMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 1 : 1;

  switch (config.source) {
    // Dashboard sources return one batch (the route caps at 100) — no cursor.
    case "dashboard-outputs":
      return { items: await fetchAeonOutputs(config.baseUrl, config.skill) };

    case "dashboard-runs":
      return { items: await fetchAeonDashboardRuns(config.baseUrl, config.skill) };

    // GitHub sources paginate 10 at a time.
    case "github-articles": {
      const repo = config.repo.trim();
      if (!repo) throw new Error("Repository is required (owner/repo).");
      const { items, hasMore } = await fetchAeonArticles(repo, PAGE_SIZE, page);
      return { items, nextCursor: hasMore ? String(page + 1) : undefined };
    }

    case "github-runs":
    default: {
      const repo = config.repo.trim();
      if (!repo) throw new Error("Repository is required (owner/repo).");
      const { items, hasMore } = await fetchAeonGithubRuns(
        repo,
        config.workflow,
        PAGE_SIZE,
        page,
      );
      return { items, nextCursor: hasMore ? String(page + 1) : undefined };
    }
  }
};

export const server = defineColumnServer<AeonConfig, AeonMeta>({ meta, fetch });
