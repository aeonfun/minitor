import { z } from "zod";
import { Code2 } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  mode: z.enum(["top", "latest", "rising"]).default("top"),
  tag: z.string().default(""),
});

export type DevtoConfig = z.infer<typeof schema>;

export interface DevtoMeta {
  reactions: number;
  comments: number;
  readingTimeMinutes: number;
  tags: string[];
  organization?: { name: string; slug: string; avatarUrl?: string };
  coverImage?: string;
}

const MODE_LABELS: Record<DevtoConfig["mode"], string> = {
  top: "Top week",
  latest: "Latest",
  rising: "Rising 24h",
};

export const meta: PluginMeta<DevtoConfig, DevtoMeta> = {
  id: "devto",
  label: "DEV.to",
  description:
    "Top, latest, or rising articles — optionally filtered by one or more tags (e.g. ai, llm, rust, webdev).",
  icon: Code2,
  // DEV.to's brand indigo — the colour used on the navbar and the `</>` mark
  // on dev.to/about. Distinct from the existing palette: substack orange
  // #ff7b30, lobsters #ac130d, stack-overflow #F48024, hacker-news flame.
  accent: "#3b49df",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const tags = c.tag
      .trim()
      .split(/[,;\s]+/)
      .filter(Boolean)
      .slice(0, 3);
    if (tags.length > 0) return `DEV · ${tags.join(", ")}`;
    return `DEV · ${MODE_LABELS[c.mode]}`;
  },
  capabilities: { paginated: true },
};
