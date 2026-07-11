import { z } from "zod";
import { Newspaper } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";
import type { WebSearchMeta } from "@/lib/integrations/xai";

export const schema = z.object({
  query: z.string().default(""),
});

export type NewsSearchConfig = z.infer<typeof schema>;

export type NewsSearchMeta = WebSearchMeta;

export const meta: PluginMeta<NewsSearchConfig, NewsSearchMeta> = {
  id: "news-search",
  label: "News · Topic",
  description: "Latest news articles on a topic.",
  icon: Newspaper,
  accent: "#c08532",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) =>
    c.query.trim() ? `News · ${c.query.trim()}` : "News · Topic",
  capabilities: { paginated: true, requiresEnv: ["XAI_API_KEY"] },
};
