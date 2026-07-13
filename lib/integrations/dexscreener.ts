import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import type { DexscreenerMeta } from "@/lib/columns/plugins/dexscreener/plugin";

// `DexscreenerMeta` is the renderer contract owned by the dexscreener plugin;
// the fetcher here produces `FeedItem<DexscreenerMeta>` so its meta lines up
// with what the dexscreener renderer reads. Re-exported so call sites that grab
// DexscreenerMeta from the integration keep working.
export type { DexscreenerMeta };

// Dexscreener public API — keyless for the two endpoints this column uses.
// Dexscreener indexes DEX trading pairs across every major chain (Ethereum,
// Base, Solana, BSC, …) and is the de-facto screen for spotting on-chain
// price action the moment a pair starts moving — which is exactly the kind of
// live signal a monitor column is for.
//
// Endpoints used (both documented at https://docs.dexscreener.com):
//   - GET /latest/dex/search?q=<query>
//       Free-text search across pairs by token symbol, name, or address.
//       Returns `{ pairs: Pair[] }`. We sort the result by 24h volume so the
//       most active pair for a query surfaces first.
//   - GET /latest/dex/tokens/<addr1>,<addr2>,…
//       Every indexed pair for the given token contract addresses (up to 30
//       per call). Same `{ pairs: Pair[] }` shape — this powers watchlist mode.
//
// Both endpoints are advertised at 300 requests/min, keyless. Prices arrive as
// strings (`priceUsd: "0.0000234"`); `num()` coerces them defensively.

const BASE = "https://api.dexscreener.com/latest/dex";

// Dexscreener caps the tokens endpoint at 30 comma-separated addresses.
const MAX_WATCHLIST = 30;
// A generous single-fetch batch the server then slice-paginates. Search can
// return hundreds of pairs for a popular symbol; cap so a column stays sane.
const MAX_ITEMS = 60;

export type DexscreenerMode = "search" | "watchlist";

interface DexPair {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string | number;
  txns?: { h24?: { buys?: number; sells?: number } };
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}

interface PairsResponse {
  pairs?: DexPair[] | null;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    // priceUsd / priceChange can arrive as plain numeric strings. Strip any
    // stray formatting before Number() so a "$0.0023" never collapses to 0.
    const cleaned = v.replace(/[^0-9.\-eE]/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function mapPair(p: DexPair): FeedItem<DexscreenerMeta> | null {
  const chainId = p.chainId?.trim();
  const pairAddress = p.pairAddress?.trim();
  const baseSymbol = (p.baseToken?.symbol ?? "").toUpperCase();
  const quoteSymbol = (p.quoteToken?.symbol ?? "").toUpperCase();
  // A pair with no chain/address or no symbols is unrenderable and unlinkable.
  if (!chainId || !pairAddress || !baseSymbol || !quoteSymbol) return null;
  const priceUsd = num(p.priceUsd);
  if (priceUsd <= 0) return null;

  // pairCreatedAt is the pair's age, the most informative timestamp here — a
  // brand-new pair surfacing in a search is itself a signal. Fall back to "now"
  // when upstream omits it so the relative-time pill stays sensible.
  const createdMs =
    typeof p.pairCreatedAt === "number" && p.pairCreatedAt > 0
      ? p.pairCreatedAt
      : Date.now();

  const buys = p.txns?.h24?.buys;
  const sells = p.txns?.h24?.sells;

  return {
    id: `dexscreener:${chainId}:${pairAddress}`,
    author: { name: `${baseSymbol}/${quoteSymbol}`, handle: baseSymbol },
    content: `${baseSymbol}/${quoteSymbol}`,
    url:
      p.url ||
      `https://dexscreener.com/${encodeURIComponent(chainId)}/${encodeURIComponent(pairAddress)}`,
    createdAt: new Date(createdMs).toISOString(),
    meta: {
      chainId,
      dexId: (p.dexId ?? "").trim(),
      baseSymbol,
      quoteSymbol,
      baseName: p.baseToken?.name?.trim() || undefined,
      imageUrl: p.info?.imageUrl || undefined,
      priceUsd,
      priceChange24h: num(p.priceChange?.h24),
      volume24hUsd: num(p.volume?.h24),
      liquidityUsd: num(p.liquidity?.usd),
      fdvUsd: typeof p.fdv === "number" ? p.fdv : undefined,
      marketCapUsd: typeof p.marketCap === "number" ? p.marketCap : undefined,
      txns24h:
        typeof buys === "number" || typeof sells === "number"
          ? { buys: num(buys), sells: num(sells) }
          : undefined,
    },
  };
}

async function fetchPairs(url: string): Promise<DexPair[]> {
  const res = await fetchUpstream(url, {
    headers: {
      accept: "application/json",
      "user-agent": "minitor/1.0 (+https://github.com/aeonfun/minitor)",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `dexscreener ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as PairsResponse;
  return Array.isArray(json.pairs) ? json.pairs : [];
}

function mapAndSort(pairs: DexPair[]): FeedItem<DexscreenerMeta>[] {
  return pairs
    .map(mapPair)
    .filter((a): a is FeedItem<DexscreenerMeta> => a !== null)
    // Highest 24h volume first — the most active pair for a token is the one
    // worth watching, and it dedupes the noise of dead micro-pools.
    .sort((a, b) => (b.meta?.volume24hUsd ?? 0) - (a.meta?.volume24hUsd ?? 0))
    .slice(0, MAX_ITEMS);
}

function parseAddresses(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_WATCHLIST);
}

export async function fetchDexscreenerItems(
  mode: DexscreenerMode,
  query: string,
  watchlist: string,
): Promise<FeedItem<DexscreenerMeta>[]> {
  if (mode === "watchlist") {
    const addresses = parseAddresses(watchlist);
    if (addresses.length === 0) return [];
    const url = `${BASE}/tokens/${addresses.map(encodeURIComponent).join(",")}`;
    return mapAndSort(await fetchPairs(url));
  }

  // mode === "search"
  const q = query.trim();
  if (!q) return [];
  const url = `${BASE}/search?q=${encodeURIComponent(q)}`;
  return mapAndSort(await fetchPairs(url));
}
