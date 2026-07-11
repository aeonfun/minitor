import { z } from "zod";
import { ThumbsUp } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";
import type { WebSearchMeta } from "@/lib/integrations/xai";

export const schema = z.object({
  query: z.string().default(""),
});

export type FacebookConfig = z.infer<typeof schema>;

export type FacebookMeta = WebSearchMeta;

export const meta: PluginMeta<FacebookConfig, FacebookMeta> = {
  id: "facebook",
  label: "Facebook",
  description:
    "Watch public Facebook posts and pages for mentions of a keyword or URL.",
  icon: ThumbsUp,
  accent: "#1877F2",
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) =>
    c.query.trim() ? `Facebook · ${c.query.trim()}` : "Facebook",
  capabilities: { paginated: true, requiresEnv: ["XAI_API_KEY"] },
};
