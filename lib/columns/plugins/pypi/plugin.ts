import { z } from "zod";
import { Package2 } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  mode: z.enum(["updates", "new-packages", "top-30d"]).default("updates"),
  keyword: z.string().default(""),
});

export type PypiConfig = z.infer<typeof schema>;

export interface PypiMeta {
  /** Version string when known (always for updates, never for new-packages). */
  version?: string;
  /** 30-day downloads when known (top-30d mode); 0 otherwise. */
  monthlyDownloads: number;
  /** Last-week downloads via pypistats.org; 0 on failure. */
  weeklyDownloads: number;
  /** PyPI author/maintainer login if surfaced by the feed. */
  author?: string;
}

const MODE_LABELS: Record<PypiConfig["mode"], string> = {
  updates: "Recent updates",
  "new-packages": "New packages",
  "top-30d": "Top · 30d",
};

export const meta: PluginMeta<PypiConfig, PypiMeta> = {
  id: "pypi",
  label: "PyPI",
  description:
    "Recent Python package updates, newly registered packages, or the top 8000 by 30-day downloads. Optional keyword filter.",
  icon: Package2,
  // Python brand blue — the colour used on the python.org navbar and the
  // Python logo's left-half wing. Distinct from the existing palette:
  // npm registry red #CB3837, devto indigo #3b49df, github-actions blue
  // #2088FF, lobsters #ac130d, arxiv #B31B1B. PyPI itself uses the same
  // blue across pypi.org's accent treatment.
  accent: "#3776AB",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const kw = c.keyword.trim();
    if (kw) return `PyPI · ${kw} · ${MODE_LABELS[c.mode]}`;
    return `PyPI · ${MODE_LABELS[c.mode]}`;
  },
  capabilities: { paginated: true },
};
