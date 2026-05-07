import { z } from "zod";
import { Layers } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  mode: z.enum(["hot", "votes", "newest", "week", "month"]).default("hot"),
  tag: z.string().default(""),
});

export type StackOverflowConfig = z.infer<typeof schema>;

export interface StackOverflowMeta {
  score: number;
  answers: number;
  views: number;
  isAnswered: boolean;
  hasAccepted: boolean;
  tags: string[];
  questionId: number;
}

const MODE_LABELS: Record<StackOverflowConfig["mode"], string> = {
  hot: "Hot",
  votes: "Top voted",
  newest: "Newest",
  week: "Week",
  month: "Month",
};

export const meta: PluginMeta<StackOverflowConfig, StackOverflowMeta> = {
  id: "stack-overflow",
  label: "Stack Overflow",
  description:
    "Hot, top-voted, newest, or week/month questions — optionally filtered by one or more tags.",
  icon: Layers,
  // Stack Overflow's brand orange — the mark used on the official logo and
  // favicon, distinct from HN orange (#ff6600) and Reddit orange-red (#ff4500).
  accent: "#F48024",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) =>
    c.tag.trim()
      ? `SO · ${c.tag.trim().split(/[,;\s]+/).filter(Boolean).slice(0, 3).join(", ")}`
      : `SO · ${MODE_LABELS[c.mode]}`,
  capabilities: {
    paginated: true,
    rateLimitHint:
      "300 requests / IP / day (anonymous Stack Exchange API quota)",
  },
};
