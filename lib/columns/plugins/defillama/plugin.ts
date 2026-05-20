import { z } from "zod";
import { Layers } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  mode: z.enum(["top", "gainers", "chains"]).default("top"),
  category: z.string().default(""),
});

export type DefillamaConfig = z.infer<typeof schema>;

export interface DefillamaMeta {
  symbol: string;
  imageUrl?: string;
  tvlUsd: number;
  tvlChange24h: number;
  tvlChange7d?: number;
  category?: string;
  chains?: string;
  marketCapUsd?: number;
  kind: "protocol" | "chain";
}

const MODE_LABELS: Record<DefillamaConfig["mode"], string> = {
  top: "Top protocols",
  gainers: "24h gainers",
  chains: "Chains by TVL",
};

export const meta: PluginMeta<DefillamaConfig, DefillamaMeta> = {
  id: "defillama",
  label: "DeFiLlama",
  description:
    "On-chain TVL leaderboard from DeFiLlama — top protocols by TVL, biggest 24h movers, or per-chain TVL. Optional category filter (Dexs, Lending, Liquid Staking, Restaking, CDP, Yield…). Keyless.",
  icon: Layers,
  // DeFiLlama brand blue — the colour used on defillama.com header pills and
  // the wordmark. Distinct from the existing on-chain cluster: wallet-tx
  // #627eea (Ethereum), polymarket #2D9CDB (electric blue), coingecko #8DC647
  // (green). DeFiLlama's deeper purple-blue sits clearly apart from all three.
  accent: "#445ed0",
  category: "blockchain",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const cat = c.category.trim();
    if (cat) {
      return `DeFiLlama · ${cat}`;
    }
    return `DeFiLlama · ${MODE_LABELS[c.mode]}`;
  },
  capabilities: {
    paginated: true,
    requiresEnv: [],
    rateLimitHint:
      "Keyless. DeFiLlama's edge cache makes the per-request cost negligible; no per-IP token bucket is advertised.",
  },
};
