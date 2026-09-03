import { z } from "zod";
import { Flame } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  mode: z.enum(["top", "new", "ask", "show", "query"]).default("top"),
  query: z.string().default(""),
});

export type HNConfig = z.infer<typeof schema>;

export interface HNMeta {
  points: number;
  comments: number;
  commentsUrl: string;
  externalUrl?: string;
}

const MODE_LABELS: Record<HNConfig["mode"], string> = {
  top: "Front page",
  new: "Newest",
  ask: "Ask HN",
  show: "Show HN",
  query: "Search",
};

export const meta: PluginMeta<HNConfig, HNMeta> = {
  id: "hacker-news",
  label: "Hacker News",
  description: "Front page, newest, Ask/Show HN, or search via Algolia.",
  icon: Flame,
  accent: "#ff6600",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) =>
    c.mode === "query" && c.query.trim() ? `HN · ${c.query.trim()}` : `HN · ${MODE_LABELS[c.mode]}`,
  capabilities: { paginated: true },
};
