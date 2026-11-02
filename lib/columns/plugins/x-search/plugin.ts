import { z } from "zod";
import { Search } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";
import type { TweetMeta } from "@/lib/columns/shared/tweet-renderer";

export type { TweetMeta };

export const schema = z.object({
  query: z.string().default(""),
});

export type XSearchConfig = z.infer<typeof schema>;

export const meta: PluginMeta<XSearchConfig, TweetMeta> = {
  id: "x-search",
  label: "X · Search",
  description:
    "Monitor X. Use from:handle for a user's posts, to:handle or @handle for mentions, plus keywords, hashtags, and operators (min_faves:, lang:, since:).",
  icon: Search,
  accent: "#1d9bf0",
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => (c.query.trim() ? `X · ${c.query.trim()}` : "X · Search"),
  capabilities: {
    paginated: true,
    rateLimitHint:
      "Uses TWITTER_API_KEY (TwitterAPI.io) when set; otherwise XAI_API_KEY (Grok x_search).",
  },
};
