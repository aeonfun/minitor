import { z } from "zod";
import { MessageCircleQuestion } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";
import type { NewsNowItemMeta } from "@/lib/columns/plugins/_newsnow/renderer";

export const schema = z.object({});

export type ZhihuHotConfig = z.infer<typeof schema>;

export type ZhihuHotMeta = NewsNowItemMeta;

export const meta: PluginMeta<ZhihuHotConfig, ZhihuHotMeta> = {
  id: "zhihu-hot",
  label: "Zhihu · Hot",
  description: "Q&A platform like Quora, known for longer, more in-depth discussions.",
  icon: MessageCircleQuestion,
  accent: "#0084ff",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: () => "Zhihu · Hot",
  capabilities: { paginated: true },
};
