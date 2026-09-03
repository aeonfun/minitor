import { z } from "zod";
import { Briefcase } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  query: z.string().default(""),
});

export type LinkedinConfig = z.infer<typeof schema>;

export interface LinkedinMeta {
  source: string;
  isLinkedin: true;
}

export const meta: PluginMeta<LinkedinConfig, LinkedinMeta> = {
  id: "linkedin",
  label: "LinkedIn",
  description: "Watch LinkedIn posts mentioning a keyword or URL.",
  icon: Briefcase,
  accent: "#0a66c2",
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => (c.query.trim() ? `LinkedIn · ${c.query.trim()}` : "LinkedIn"),
  capabilities: { paginated: true, requiresEnv: ["XAI_API_KEY"] },
};
