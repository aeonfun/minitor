import { z } from "zod";
import { TrendingUp } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";
import type { TweetMeta } from "@/lib/columns/plugins/x-search/plugin";

export const schema = z.object({
  topic: z.string().default(""),
});

export type XTrendingConfig = z.infer<typeof schema>;

export const meta: PluginMeta<XTrendingConfig, TweetMeta> = {
  id: "x-trending",
  label: "X · Trending",
  description: "Highest-engagement X posts in the last 24h, optionally filtered by topic.",
  icon: TrendingUp,
  accent: "#1d9bf0",
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => (c.topic.trim() ? `Trending · ${c.topic.trim()}` : "X · Trending"),
  capabilities: { paginated: true, requiresEnv: ["XAI_API_KEY"] },
};
