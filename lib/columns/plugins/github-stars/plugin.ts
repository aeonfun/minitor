import { z } from "zod";
import { Star } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";
import type { GHWatcherItemMeta } from "@/lib/integrations/github";

export const schema = z.object({
  repo: z.string().default(""),
});

export type GHStarsConfig = z.infer<typeof schema>;

export type GHStarsMeta = GHWatcherItemMeta;

export const meta: PluginMeta<GHStarsConfig, GHStarsMeta> = {
  id: "github-stars",
  label: "GitHub stars",
  description: "Latest stargazers for a GitHub repo, newest first.",
  icon: Star,
  accent: "#f5a623",
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const r = c.repo.trim();
    return r ? `Stars · ${r}` : "GitHub · Stars";
  },
  capabilities: {
    paginated: true,
    rateLimitHint:
      "Requires GITHUB_TOKEN — GitHub auth-gates the stargazers list (401 without a token). 5000 req/hr with one.",
  },
};
