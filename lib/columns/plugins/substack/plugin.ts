import { z } from "zod";
import { BookOpen } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  handles: z.string().default(""),
  query: z.string().default(""),
});

export type SubstackConfig = z.infer<typeof schema>;

export interface SubstackMeta {
  publication: string;
  feedTitle?: string;
  source: string;
}

export const meta: PluginMeta<SubstackConfig, SubstackMeta> = {
  id: "substack",
  label: "Substack",
  description: "Watch Substack — give specific publications, or search all of Substack by keyword.",
  icon: BookOpen,
  accent: "#ff6719",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const q = c.query.trim();
    if (q) return `Substack · ${q}`;
    const first = c.handles.split(/[\s,]+/).find((s) => s.trim());
    return first ? `Substack · ${first.trim()}` : "Substack";
  },
  capabilities: {
    paginated: true,
    rateLimitHint:
      "Per-publication RSS is keyless. Keyword-only search uses xAI Grok web_search (requires XAI_API_KEY).",
  },
};
