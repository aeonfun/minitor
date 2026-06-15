import { z } from "zod";
import { GitCommitHorizontal } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  repo: z.string().default(""),
  branch: z.string().default(""),
});

export type GHCommitsConfig = z.infer<typeof schema>;

export interface GHCommitsMeta {
  kind?: "commit";
  repo?: string;
  sha?: string;
  shortSha?: string;
}

export const meta: PluginMeta<GHCommitsConfig, GHCommitsMeta> = {
  id: "github-commits",
  label: "Repo commits",
  description: "Latest commits on a GitHub repo branch, newest first.",
  icon: GitCommitHorizontal,
  accent: "#8957e5",
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const repo = c.repo.trim();
    if (!repo) return "GitHub · Commits";
    const branch = c.branch.trim();
    return branch ? `Commits · ${repo}@${branch}` : `Commits · ${repo}`;
  },
  capabilities: {
    paginated: true,
    rateLimitHint: "60 req/hr without GITHUB_TOKEN, 5000 with.",
  },
};
