import { z } from "zod";
import { GitFork } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";
import type { GHWatcherItemMeta } from "@/lib/integrations/github";

export const schema = z.object({
  repo: z.string().default(""),
});

export type GHForksConfig = z.infer<typeof schema>;

export type GHForksMeta = GHWatcherItemMeta;

export const meta: PluginMeta<GHForksConfig, GHForksMeta> = {
  id: "github-forks",
  label: "GitHub forks",
  description: "Latest forks of a GitHub repo, newest first.",
  icon: GitFork,
  accent: "#9fbbe0",
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const r = c.repo.trim();
    return r ? `Forks · ${r}` : "GitHub · Forks";
  },
  capabilities: {
    paginated: true,
    rateLimitHint: "60 req/hr without GITHUB_TOKEN, 5000 with.",
  },
};
