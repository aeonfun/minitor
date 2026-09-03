import { z } from "zod";
import { Search } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";
import type { NewsNowItemMeta } from "@/lib/columns/plugins/_newsnow/renderer";

export const schema = z.object({});

export type BaiduHotConfig = z.infer<typeof schema>;

export type BaiduHotMeta = NewsNowItemMeta;

export const meta: PluginMeta<BaiduHotConfig, BaiduHotMeta> = {
  id: "baidu-hot",
  label: "Baidu · Hot",
  description: "Trending searches on Baidu, China's dominant search engine.",
  icon: Search,
  accent: "#2932e1",
  category: "news",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: () => "Baidu · Hot",
  capabilities: { paginated: true },
};
