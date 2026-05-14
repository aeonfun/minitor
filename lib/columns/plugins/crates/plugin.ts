import { z } from "zod";
import { Box } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  query: z.string().default(""),
  sort: z
    .enum(["recent-downloads", "downloads", "recent-updates", "new", "alpha"])
    .default("recent-downloads"),
});

export type CratesConfig = z.infer<typeof schema>;

export interface CratesMeta {
  version: string;
  totalDownloads: number;
  recentDownloads: number;
  keywords: string[];
  description: string;
  homepage?: string;
  documentation?: string;
  repository?: string;
  updatedAt: string;
  exactMatch: boolean;
}

const SORT_LABELS: Record<CratesConfig["sort"], string> = {
  "recent-downloads": "Trending",
  downloads: "All-time",
  "recent-updates": "Recently updated",
  new: "Newest",
  alpha: "A–Z",
};

export const meta: PluginMeta<CratesConfig, CratesMeta> = {
  id: "crates",
  label: "crates.io",
  description:
    "Trending and high-signal Rust crates from crates.io — ranked by recent downloads, all-time downloads, recency, or new arrivals. Keyword-scoped via search.",
  icon: Box,
  // Rust brand "ember orange". Distinct from neighbouring registries on the
  // wheel: npm #CB3837 (red), pypi #3776AB (blue), devto #3b49df (indigo).
  // Sits in the warm half — the three registry columns now span the wheel
  // (red / orange / blue) so they're distinguishable at a glance.
  accent: "#DEA584",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const q = c.query.trim();
    const sortLabel = SORT_LABELS[c.sort];
    if (q) return `crates.io · ${q} · ${sortLabel}`;
    return `crates.io · ${sortLabel}`;
  },
  capabilities: { paginated: true },
};
