import { z } from "zod";
import { BarChart3 } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  mode: z.enum(["trending", "newest", "ending-soon", "tag"]).default("trending"),
  tag: z.string().default(""),
});

export type PolymarketConfig = z.infer<typeof schema>;

export interface PolymarketMeta {
  outcomes: { label: string; price: number }[];
  volume24hUsd: number;
  liquidityUsd: number;
  endDate?: string;
  category?: string;
  conditionId?: string;
  imageUrl?: string;
}

const MODE_LABELS: Record<PolymarketConfig["mode"], string> = {
  trending: "Trending",
  newest: "Newest",
  "ending-soon": "Ending soon",
  tag: "Tag",
};

export const meta: PluginMeta<PolymarketConfig, PolymarketMeta> = {
  id: "polymarket",
  label: "Polymarket",
  description:
    "Live prediction markets — sort by 24h volume, newest, or ending-soon, or filter by tag (politics, sports, crypto, world…).",
  icon: BarChart3,
  // Polymarket's brand palette leans on a saturated electric blue (#2D9CDB
  // is the primary they use across polymarket.com and their token chips).
  // Distinct from wallet-tx's #627eea so the two blockchain-cluster columns
  // stay visually differentiated when stacked together.
  accent: "#2D9CDB",
  category: "blockchain",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) =>
    c.mode === "tag" && c.tag.trim()
      ? `Polymarket · ${c.tag.trim()}`
      : `Polymarket · ${MODE_LABELS[c.mode]}`,
  capabilities: { paginated: true },
};
