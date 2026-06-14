import { z } from "zod";
import { Rocket } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  mode: z.enum(["today", "topic"]).default("today"),
  topic: z.string().default(""),
});

export type ProductHuntConfig = z.infer<typeof schema>;

export interface ProductHuntMeta {
  source: string;
  feedTitle?: string;
  // The product slug extracted from the post URL (e.g. "linear-3"). Useful for
  // dedupe across days when the same product re-appears in the rolling window.
  slug?: string;
  // The product name (left half of the "{name} — {tagline}" title split). Kept
  // separately so the renderer can highlight it without re-parsing every row.
  productName?: string;
  // The tagline (right half of the title split). Often empty if the publisher
  // didn't add an em-dash; falls back to feed description in that case.
  tagline?: string;
}

export const meta: PluginMeta<ProductHuntConfig, ProductHuntMeta> = {
  id: "producthunt",
  label: "Product Hunt",
  description:
    "Today's Product Hunt launches — the full daily slate or an optional keyword filter across name, tagline, and description.",
  icon: Rocket,
  // Product Hunt's brand "Rocket" orange — the colour used on the .com header
  // and the official kit. Distinct from the existing palette: hacker-news
  // flame, substack orange #ff6719 (more muted), devto indigo #3b49df, npm
  // red #CB3837, pypi blue #3776AB, crates #DEA584.
  accent: "#DA552F",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const topic = c.topic.trim();
    if (topic) {
      const first = topic
        .split(/[,;\s]+/)
        .map((t) => t.trim())
        .find(Boolean);
      return first ? `PH · ${first}` : "Product Hunt";
    }
    return "Product Hunt";
  },
  capabilities: { paginated: true },
};
