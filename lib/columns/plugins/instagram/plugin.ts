import { z } from "zod";
// `Instagram` brand icon was dropped from lucide-react v1.x; `Aperture` is
// the camera-lens substitute used by other dashboards.
import { Aperture } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";
import type { WebSearchMeta } from "@/lib/integrations/xai";

export const schema = z.object({
  query: z.string().default(""),
});

export type InstagramConfig = z.infer<typeof schema>;

export type InstagramMeta = WebSearchMeta;

export const meta: PluginMeta<InstagramConfig, InstagramMeta> = {
  id: "instagram",
  label: "Instagram",
  description: "Public Instagram posts mentioning a keyword or URL.",
  icon: Aperture,
  accent: "#e1306c",
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) =>
    c.query.trim() ? `Instagram · ${c.query.trim()}` : "Instagram",
  capabilities: {
    paginated: true,
    requiresEnv: ["XAI_API_KEY"],
    rateLimitHint:
      "Indexed via web search — only public posts already crawled by search engines are returned.",
  },
};
