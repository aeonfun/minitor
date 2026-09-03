import { z } from "zod";
import { Link2 } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  repo: z.string().default(""),
  includeIssues: z.boolean().default(true),
});

export type BacklinksConfig = z.infer<typeof schema>;

export type BacklinkSource = "hn" | "reddit" | "google-news" | "bing-news" | "github";

export interface BacklinksItemMeta {
  source: BacklinkSource;
  canonicalUrl: string;
}

export const meta: PluginMeta<BacklinksConfig, BacklinksItemMeta> = {
  id: "github-backlinks",
  label: "GitHub backlinks",
  description: "Find pages, posts, and issues across the web that link to a GitHub repo.",
  icon: Link2,
  accent: "#5e6dc7",
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const t = c.repo.trim();
    return t ? `Backlinks · ${t.replace(/^https?:\/\/github\.com\//i, "")}` : "GitHub backlinks";
  },
  capabilities: { paginated: true },
};
