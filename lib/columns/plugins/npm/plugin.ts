import { z } from "zod";
import { Package } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  query: z.string().default("javascript"),
  mode: z
    .enum(["popularity", "quality", "maintenance", "combined"])
    .default("popularity"),
});

export type NpmConfig = z.infer<typeof schema>;

export interface NpmMeta {
  version: string;
  weeklyDownloads: number;
  keywords: string[];
  score: number;
  scoreDetail: {
    quality: number;
    popularity: number;
    maintenance: number;
  };
  publisher?: { username?: string; email?: string };
  homepage?: string;
  repository?: string;
  license?: string;
  deprecated: boolean;
}

const MODE_LABELS: Record<NpmConfig["mode"], string> = {
  popularity: "Popular",
  quality: "Quality",
  maintenance: "Maintained",
  combined: "Combined",
};

export const meta: PluginMeta<NpmConfig, NpmMeta> = {
  id: "npm",
  label: "npm",
  description:
    "Trending and high-signal npm packages — ranked by popularity, quality, maintenance, or combined score. Keyword-scoped via search.",
  icon: Package,
  // npm's brand red — the colour on the npmjs.com nav and the `npm` wordmark.
  // Distinct from the existing palette: lobsters #ac130d, github-actions
  // blue #2088FF, devto indigo #3b49df, hacker-news orange. The closest
  // adjacent accent in Tools/Dev is stack-overflow #F48024 (yellow-orange),
  // so the red sits comfortably on the wheel.
  accent: "#CB3837",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const q = c.query.trim();
    if (q && q !== "javascript") return `npm · ${q} · ${MODE_LABELS[c.mode]}`;
    return `npm · ${MODE_LABELS[c.mode]}`;
  },
  capabilities: { paginated: true },
};
