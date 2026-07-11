import { z } from "zod";
import { MessageCircle } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  subreddit: z.string().default(""),
  sortBy: z.enum(["new", "hot", "top", "rising"]).default("hot"),
});

export type RedditConfig = z.infer<typeof schema>;

export interface RedditMeta {
  subreddit: string;
}

export const meta: PluginMeta<RedditConfig, RedditMeta> = {
  id: "reddit",
  label: "Reddit · Subreddit",
  description: "Monitor new posts in a subreddit.",
  icon: MessageCircle,
  accent: "#ff4500",
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) =>
    c.subreddit.trim() ? `r/${c.subreddit.trim()}` : "Reddit · Subreddit",
  capabilities: { paginated: true },
};
