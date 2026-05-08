import { z } from "zod";
import { Sparkles } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  resource: z.enum(["models", "datasets", "spaces"]).default("models"),
  mode: z.enum(["trending", "most-likes", "newest"]).default("trending"),
  search: z.string().default(""),
});

export type HuggingfaceConfig = z.infer<typeof schema>;

export interface HuggingfaceMeta {
  resource: HuggingfaceConfig["resource"];
  likes: number;
  downloads?: number;
  trendingScore?: number;
  pipelineTag?: string;
  libraryName?: string;
  sdk?: string;
  tags: string[];
  gated: boolean;
}

const RESOURCE_LABELS: Record<HuggingfaceConfig["resource"], string> = {
  models: "Models",
  datasets: "Datasets",
  spaces: "Spaces",
};

const MODE_LABELS: Record<HuggingfaceConfig["mode"], string> = {
  trending: "Trending",
  "most-likes": "Most liked",
  newest: "Newest",
};

export const meta: PluginMeta<HuggingfaceConfig, HuggingfaceMeta> = {
  id: "huggingface",
  label: "Hugging Face",
  description:
    "Trending, most-liked, or newest models, datasets, or spaces — optionally filtered by search.",
  icon: Sparkles,
  // HF brand yellow — the colour of the emoji in the wordmark and the
  // call-to-action buttons across huggingface.co. Distinct from the existing
  // palette so an HF column reads at a glance in a packed deck.
  accent: "#FFD21F",
  category: "ai",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const search = c.search.trim();
    if (search) return `HF · ${RESOURCE_LABELS[c.resource]} · ${search}`;
    return `HF · ${MODE_LABELS[c.mode]} ${RESOURCE_LABELS[c.resource].toLowerCase()}`;
  },
  capabilities: { paginated: true },
};
