import { z } from "zod";
import { Rss } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";
import type { RssItemMeta } from "@/lib/integrations/rss";

export const schema = z.object({
  url: z.string().default(""),
});

export type RssConfig = z.infer<typeof schema>;

export type RssMeta = RssItemMeta;

export const meta: PluginMeta<RssConfig, RssMeta> = {
  id: "rss",
  label: "RSS",
  description: "Any RSS or Atom feed — blogs, Substacks, RSSHub, alerts.",
  icon: Rss,
  accent: "#dfa88f",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const url = c.url.trim();
    if (!url) return "RSS";
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return `RSS · ${host}`;
    } catch {
      return "RSS";
    }
  },
  capabilities: { paginated: true },
};
