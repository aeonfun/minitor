import { z } from "zod";
import { Layers } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  mode: z.enum(["top", "gainers", "chains"]).default("top"),
  category: z.string().default(""),
  // Gainers mode only: drop any protocol with TVL below this floor before
  // sorting by 24h % change. Without a floor, a $500 microcap that doubled
  // overnight reads as +100% and crowds out a $1B protocol that grew 5%.
  // Default $1M mirrors the threshold DeFiLlama applies on its own gainers
  // leaderboard. `0` disables the floor (every protocol included).
  minTvlUsd: z.number().nonnegative().default(1_000_000),
});

export type DefillamaConfig = z.infer<typeof schema>;

export interface DefillamaMeta {
  /** Display symbol or chain ticker (e.g. "AAVE", "ETH"). May be empty. */
  symbol: string;
  /** Hosted protocol/chain logo URL when available. */
  imageUrl?: string;
  /** Current TVL in USD (already in USD — DeFiLlama normalises). */
  tvlUsd: number;
  /** Percent change over 24h (+/-). */
  tvlChange24h: number;
  /** Percent change over 7d (+/-). */
  tvlChange7d?: number;
  /** Protocol category (DeFiLlama's taxonomy, e.g. "Lending", "Dexs"). */
  category?: string;
  /** Comma-joined chain list from DeFiLlama (e.g. "Ethereum, Base"). */
  chains?: string;
  /** Market cap of the protocol token in USD, when DeFiLlama has it. */
  marketCapUsd?: number;
  /** "protocol" or "chain" — lets the renderer style the row differently. */
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
