import { z } from "zod";
import { TrendingUp } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  mode: z.enum(["trending", "top", "watchlist"]).default("trending"),
  watchlist: z.string().default(""),
});

export type CoingeckoConfig = z.infer<typeof schema>;

export interface CoingeckoMeta {
  symbol: string;
  imageUrl?: string;
  priceUsd: number;
  priceChange24h: number;
  marketCapUsd: number;
  marketCapRank?: number;
  volume24hUsd: number;
  high24hUsd?: number;
  low24hUsd?: number;
  sparkline7d?: number[];
}

const MODE_LABELS: Record<CoingeckoConfig["mode"], string> = {
  trending: "Trending",
  top: "Top by market cap",
  watchlist: "Watchlist",
};

export const meta: PluginMeta<CoingeckoConfig, CoingeckoMeta> = {
  id: "coingecko",
  label: "CoinGecko",
  description:
    "Crypto price + trending feed from CoinGecko — top-7 trending searches, top-by-market-cap leaderboard, or a custom watchlist of CoinGecko ids. Keyless by default.",
  icon: TrendingUp,
  // CoinGecko brand green — the colour on coingecko.com header pills and the
  // `coingecko` wordmark. Distinct from the existing crypto-cluster columns:
  // wallet-tx #627eea (Ethereum blue) and polymarket #2D9CDB (electric blue).
  // The green sits clearly apart from both blues on the colour wheel.
  accent: "#8DC647",
  category: "blockchain",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    if (c.mode === "watchlist") {
      const first = c.watchlist
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .find(Boolean);
      return first ? `CoinGecko · ${first}` : "CoinGecko · Watchlist";
    }
    return `CoinGecko · ${MODE_LABELS[c.mode]}`;
  },
  capabilities: {
    paginated: true,
    requiresEnv: [],
    rateLimitHint:
      "Keyless: ~10–30 calls/min. Set COINGECKO_DEMO_API_KEY for higher limits.",
  },
};
