import { z } from "zod";
import { Megaphone } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";
import type { RssItemMeta } from "@/lib/integrations/rss";

export const schema = z.object({
  query: z.string().default(""),
  // Empty hl/gl = Google's global default (all languages, IP-detected region).
  hl: z.string().default(""),
  gl: z.string().default(""),
});

export type GoogleNewsConfig = z.infer<typeof schema>;

export type GoogleNewsMeta = RssItemMeta;

export const meta: PluginMeta<GoogleNewsConfig, GoogleNewsMeta> = {
  id: "google-news",
  label: "Google News",
  description: "Search-driven news from Google's index. Defaults to all languages/countries (RSS, no key).",
  icon: Megaphone,
  accent: "#9fc9a2",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) =>
    c.query.trim() ? `Google · ${c.query.trim()}` : "Google News",
  capabilities: { paginated: true },
};
