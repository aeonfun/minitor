import type { FeedItem } from "@/lib/columns/types";
import type { DefillamaMeta } from "@/lib/columns/plugins/defillama/plugin";

// `DefillamaMeta` is the renderer contract owned by the defillama plugin; the
// fetcher here produces `FeedItem<DefillamaMeta>` so its meta lines up with what
// the defillama renderer reads. Re-exported so call sites that grab
// DefillamaMeta from the integration keep working.
export type { DefillamaMeta };

// DeFiLlama public API — keyless. Two endpoints cover all three column modes:
//
//   - GET https://api.llama.fi/protocols
//       Full protocol list (~3000 entries, ~2-3 MB) with TVL, % change (1h/1d/7d),
//       category, mcap, logo, chain, etc. The response is already sorted by TVL
//       desc; we re-sort for the gainers mode.
//
//   - GET https://api.llama.fi/v2/chains
//       Per-chain TVL list (~200 entries). Smaller payload; sorted by TVL desc
//       by the mapper. Used by the `chains` mode.
//
// Both endpoints are stateless and CORS-friendly; the API caches aggressively
// at the edge so the per-request cost is low even for the 3000-protocol list.
// Anonymous, no auth headers, no per-IP token bucket exposed in the public docs.
//
// One implementation detail worth flagging: DeFiLlama's protocol payload mixes
// CEX entries (Binance CEX, Coinbase Custody, etc.) with on-chain protocols.
// We surface CEXes as-is — operators watching the broader "where is custody
// concentrated" picture want them included, and the `category` filter is the
// escape hatch for anyone who wants pure-DeFi.

const API_BASE = "https://api.llama.fi";

export type DefillamaMode = "top" | "gainers" | "chains";

interface DefillamaProtocol {
  id?: string;
  name?: string;
  symbol?: string;
  slug?: string;
  url?: string;
  logo?: string;
  category?: string;
  chain?: string;
  chains?: string[];
  tvl?: number | null;
  change_1h?: number | null;
  change_1d?: number | null;
  change_7d?: number | null;
  mcap?: number | null;
  listedAt?: number | null;
}

interface DefillamaChain {
  gecko_id?: string | null;
  name?: string;
  tokenSymbol?: string | null;
  tvl?: number | null;
  cmcId?: string | null;
  chainId?: number | null;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

function protocolPermalink(slug: string | undefined, fallbackName: string): string {
  const seg = (slug || fallbackName).trim();
  if (!seg) return "https://defillama.com/";
  // DeFiLlama protocol pages live at /protocol/{slug}. The slug is canonical
  // and lowercase; we never URL-encode it because DeFiLlama itself emits the
  // raw slug in its frontend links.
  return `https://defillama.com/protocol/${encodeURIComponent(seg.toLowerCase())}`;
}

function chainPermalink(name: string): string {
  // The chain detail page lives at /chain/{name} — name is the human label
  // (e.g. "Ethereum", "BSC", "Base"), with no slug variant.
  return `https://defillama.com/chain/${encodeURIComponent(name)}`;
}

function mapProtocol(p: DefillamaProtocol): FeedItem<DefillamaMeta> | null {
  if (!p.name) return null;
  const tvl = num(p.tvl);
  // DeFiLlama lists every protocol it has ever scraped, including ones whose
  // TVL has fallen to 0. They're noise in a leaderboard column — drop them.
  if (tvl <= 0) return null;
  const symbol = (p.symbol ?? "").toUpperCase().trim();
  const id = (p.slug || p.id || p.name).toString();
  const chains = Array.isArray(p.chains) ? p.chains.join(", ") : p.chain ?? "";
  return {
    id: `defillama:protocol:${id}`,
    author: {
      name: p.name,
      handle: symbol || p.name,
      // No avatar — DeFiLlama logos are protocol-square logos, surfaced via
      // meta.imageUrl below. The author block is just for the card header.
    },
    content: `${p.name}${symbol ? ` (${symbol})` : ""}`,
    url: protocolPermalink(p.slug, p.name),
    // DeFiLlama doesn't ship a per-protocol "updated at" — the data is
    // recomputed in lockstep across the whole list. Honest answer: now.
    createdAt: new Date().toISOString(),
    meta: {
      symbol,
      imageUrl: p.logo ?? undefined,
      tvlUsd: tvl,
      tvlChange24h: num(p.change_1d),
      tvlChange7d: typeof p.change_7d === "number" ? p.change_7d : undefined,
      category: p.category ?? undefined,
      chains: chains || undefined,
      marketCapUsd: typeof p.mcap === "number" && p.mcap > 0 ? p.mcap : undefined,
      kind: "protocol",
    },
  };
}

function mapChain(c: DefillamaChain): FeedItem<DefillamaMeta> | null {
  if (!c.name) return null;
  const tvl = num(c.tvl);
  if (tvl <= 0) return null;
  const symbol = (c.tokenSymbol ?? "").toUpperCase().trim();
  return {
    id: `defillama:chain:${c.name.toLowerCase()}`,
    author: {
      name: c.name,
      handle: symbol || c.name,
    },
    content: `${c.name}${symbol ? ` · ${symbol}` : ""}`,
    url: chainPermalink(c.name),
    createdAt: new Date().toISOString(),
    meta: {
      symbol,
      tvlUsd: tvl,
      tvlChange24h: 0,
      category: "Chain",
      kind: "chain",
    },
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      accept: "application/json",
      "user-agent": "minitor/1.0 (+https://github.com/aaronjmars/minitor)",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `defillama ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}

export function parseCategoryFilter(raw: string): string {
  // The category filter is a free-text input — DeFiLlama categories like
  // "Liquid Staking", "Yield Aggregator", "CDP" are typed by humans rather
  // than picked from a dropdown. Normalise to a lowercase substring match
  // (the mapper compares against `category.toLowerCase().includes(needle)`).
  return raw.trim().toLowerCase();
}

function matchesCategory(item: FeedItem<DefillamaMeta>, needle: string): boolean {
  if (!needle) return true;
  const cat = item.meta?.category?.toLowerCase() ?? "";
  return cat.includes(needle);
}

export async function fetchDefillamaPage(
  mode: DefillamaMode,
  category: string,
  limit: number,
  page: number,
  minTvlUsd = 0,
): Promise<{ items: FeedItem<DefillamaMeta>[]; hasMore: boolean }> {
  const cat = parseCategoryFilter(category);

  if (mode === "chains") {
    // Chain mode ignores the category filter — every entry is implicitly a
    // chain. Sort by TVL desc (the endpoint isn't guaranteed to be sorted).
    const chains = await fetchJson<DefillamaChain[]>("/v2/chains");
    const mapped = chains
      .map(mapChain)
      .filter((a): a is FeedItem<DefillamaMeta> => a !== null)
      .sort((a, b) => (b.meta?.tvlUsd ?? 0) - (a.meta?.tvlUsd ?? 0));
    const perPage = Math.max(limit, 30);
    const start = page * perPage;
    const slice = mapped.slice(start, start + perPage);
    return { items: slice.slice(0, limit), hasMore: mapped.length > start + perPage };
  }

  // top + gainers both pull from /protocols.
  const protocols = await fetchJson<DefillamaProtocol[]>("/protocols");
  const mapped = protocols
    .map(mapProtocol)
    .filter((a): a is FeedItem<DefillamaMeta> => a !== null)
    .filter((a) => matchesCategory(a, cat));

  // Gainers mode only: apply a TVL floor before sorting. /protocols ships
  // every entry DeFiLlama has ever indexed, including ~$50 microcaps; without
  // a floor a doubling-from-noise protocol shows as +100% and outranks real
  // movers like a $1B chain that grew 5%. Top mode keeps the full list (it's
  // a TVL leaderboard — small entries naturally sort to later pages).
  const filtered =
    mode === "gainers" && minTvlUsd > 0
      ? mapped.filter((a) => (a.meta?.tvlUsd ?? 0) >= minTvlUsd)
      : mapped;

  if (mode === "gainers") {
    // Sort by 24h TVL change desc. Ties broken by absolute TVL so a $50M
    // protocol jumping 20% ranks above a $50k protocol jumping 20%.
    filtered.sort((a, b) => {
      const da = a.meta?.tvlChange24h ?? 0;
      const db = b.meta?.tvlChange24h ?? 0;
      if (db !== da) return db - da;
      return (b.meta?.tvlUsd ?? 0) - (a.meta?.tvlUsd ?? 0);
    });
  } else {
    // top mode — sort by TVL desc. The endpoint is normally pre-sorted but the
    // category filter can reorder pages if categories don't sort identically.
    filtered.sort((a, b) => (b.meta?.tvlUsd ?? 0) - (a.meta?.tvlUsd ?? 0));
  }

  const perPage = Math.max(limit, 30);
  const start = page * perPage;
  const slice = filtered.slice(start, start + perPage);
  return { items: slice.slice(0, limit), hasMore: filtered.length > start + perPage };
}
