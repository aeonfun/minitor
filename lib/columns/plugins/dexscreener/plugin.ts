import { z } from "zod";
import { CandlestickChart } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  mode: z.enum(["search", "watchlist"]).default("search"),
  query: z.string().default(""),
  watchlist: z.string().default(""),
});

export type DexscreenerConfig = z.infer<typeof schema>;

export interface DexscreenerMeta {
  chainId: string;
  dexId: string;
  baseSymbol: string;
  quoteSymbol: string;
  baseName?: string;
  imageUrl?: string;
  priceUsd: number;
  priceChange24h: number;
  volume24hUsd: number;
  liquidityUsd: number;
  fdvUsd?: number;
  marketCapUsd?: number;
  txns24h?: { buys: number; sells: number };
}

const MODE_LABELS: Record<DexscreenerConfig["mode"], string> = {
  search: "Search",
  watchlist: "Watchlist",
};

export const meta: PluginMeta<DexscreenerConfig, DexscreenerMeta> = {
  id: "dexscreener",
  label: "Dexscreener",
  description:
    "Live DEX pair feed from Dexscreener — search any token by symbol, name, or contract address across every chain, or watch a list of contract addresses. Each row shows price, 24h change, volume, liquidity, and buy/sell flow. Keyless.",
  icon: CandlestickChart,
  // Dexscreener brand violet — distinct from the existing on-chain cluster,
  // which is otherwise all blues + one green: wallet-tx #627eea (Ethereum),
  // polymarket #2D9CDB (electric blue), defillama #445ed0 (purple-blue),
  // coingecko #8DC647 (green). A brighter violet sits clearly apart from the
  // blue trio while staying in the crypto colour family.
  accent: "#a45cff",
  category: "blockchain",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    if (c.mode === "watchlist") {
      const first = c.watchlist
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .find(Boolean);
      return first
        ? `Dexscreener · ${first.slice(0, 10)}…`
        : "Dexscreener · Watchlist";
    }
    const q = c.query.trim();
    return q ? `Dexscreener · ${q}` : `Dexscreener · ${MODE_LABELS[c.mode]}`;
  },
  capabilities: {
    paginated: true,
    requiresEnv: [],
    rateLimitHint: "Keyless. Dexscreener's public API allows ~300 calls/min.",
  },
};
