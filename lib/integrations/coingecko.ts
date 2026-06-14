import type { FeedItem } from "@/lib/columns/types";
import type { CoingeckoMeta } from "@/lib/columns/plugins/coingecko/plugin";

// `CoingeckoMeta` is the renderer contract owned by the coingecko plugin; the
// fetcher here produces `FeedItem<CoingeckoMeta>` so its meta lines up with what
// the coingecko renderer reads. Re-exported so call sites that grab
// CoingeckoMeta from the integration keep working.
export type { CoingeckoMeta };

// CoinGecko public API — keyless for `/search/trending` and `/coins/markets`.
// The Demo plan (env `COINGECKO_DEMO_API_KEY`) authenticates the same endpoints
// at a higher rate-limit ceiling and via `pro-api.coingecko.com` instead of the
// public host. Free anonymous requests are capped at ~10–30 calls/minute and
// served from `api.coingecko.com`; we pick the host dynamically so the column
// degrades cleanly when the key is absent.
//
// Endpoints used:
//   - GET /api/v3/search/trending
//       Top-7 most-searched coins in the last 24h. Fixed 7-coin response;
//       no pagination. Returns `coins[].item` with `id`, `name`, `symbol`,
//       `market_cap_rank`, `price_btc`, `data.price`, `data.price_change_percentage_24h.usd`,
//       `data.total_volume`, `large` (the icon URL).
//   - GET /api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=N&page=M
//       Paginated market table (cap, price, %, volume, sparkline-eligible).
//   - GET /api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,…
//       Watchlist mode — same response shape as `top`, scoped to caller's ids.
//
// One subtle detail: the trending endpoint emits `price_change_percentage_24h`
// as a USD-keyed object (`data.price_change_percentage_24h.usd`), but the
// markets endpoint emits a flat `price_change_percentage_24h` number. The
// mapper normalises both into a single `priceChange24h` field so the renderer
// doesn't have to branch on mode.

const PUBLIC_BASE = "https://api.coingecko.com/api/v3";
const PRO_BASE = "https://pro-api.coingecko.com/api/v3";

export type CoingeckoMode = "trending" | "top" | "watchlist";

interface TrendingItem {
  item?: {
    id?: string;
    coin_id?: number;
    name?: string;
    symbol?: string;
    market_cap_rank?: number | null;
    thumb?: string;
    small?: string;
    large?: string;
    slug?: string;
    price_btc?: number;
    data?: {
      price?: number | string;
      price_btc?: string;
      price_change_percentage_24h?: Record<string, number> | null;
      market_cap?: string;
      total_volume?: string;
      sparkline?: string;
      content?: { title?: string; description?: string } | null;
    };
  };
}

interface TrendingResponse {
  coins?: TrendingItem[];
}

interface MarketCoin {
  id?: string;
  symbol?: string;
  name?: string;
  image?: string;
  current_price?: number | null;
  market_cap?: number | null;
  market_cap_rank?: number | null;
  total_volume?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  price_change_percentage_24h?: number | null;
  sparkline_in_7d?: { price?: number[] } | null;
  last_updated?: string | null;
}

function authHeaders(): Record<string, string> {
  const key = process.env.COINGECKO_DEMO_API_KEY?.trim();
  if (!key) return {};
  // CoinGecko's Demo plan uses `x-cg-demo-api-key`; Pro uses `x-cg-pro-api-key`.
  // We only support the Demo header here — Pro accounts get a different host
  // but they accept the demo header on the pro host too. Operators wiring up
  // Pro can set the key as DEMO and still get authenticated requests.
  return { "x-cg-demo-api-key": key };
}

function apiBase(): string {
  // Only swap to the pro host when a key is present. Hitting pro-api anonymously
  // returns a 401, which would silently break the column for keyless users.
  return process.env.COINGECKO_DEMO_API_KEY ? PRO_BASE : PUBLIC_BASE;
}

function permalinkFor(id: string): string {
  return `https://www.coingecko.com/en/coins/${encodeURIComponent(id)}`;
}

function authorOf(symbol: string, id: string): {
  name: string;
  handle: string;
} {
  const sym = symbol.toUpperCase().trim() || id;
  return { name: sym, handle: sym };
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    // CoinGecko's trending endpoint returns USD prices as strings prefixed
    // with `$` and containing thousand-separators (`$1,234.56`). Strip them
    // before Number() — otherwise we drop a 5-digit BTC price to 0.
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function mapTrendingItem(t: TrendingItem): FeedItem<CoingeckoMeta> | null {
  const item = t.item;
  if (!item?.id || !item.name) return null;
  const symbol = (item.symbol ?? "").toUpperCase();
  const data = item.data ?? {};
  const priceUsd = num(data.price);
  if (priceUsd <= 0) return null;
  const pct = data.price_change_percentage_24h?.usd;
  const description = `${item.name} (${symbol})`;
  const content = description;
  // The trending endpoint doesn't carry a per-coin timestamp; "now" is the
  // honest answer since these rankings are updated on CoinGecko's own cadence
  // and we're reading the live response.
  return {
    id: `coingecko:${item.id}`,
    author: authorOf(symbol, item.id),
    content,
    url: permalinkFor(item.id),
    createdAt: new Date().toISOString(),
    meta: {
      symbol,
      imageUrl: item.large || item.small || item.thumb,
      priceUsd,
      priceChange24h: typeof pct === "number" ? pct : 0,
      marketCapUsd: num(data.market_cap),
      marketCapRank:
        typeof item.market_cap_rank === "number" ? item.market_cap_rank : undefined,
      volume24hUsd: num(data.total_volume),
    },
  };
}

function mapMarketCoin(c: MarketCoin): FeedItem<CoingeckoMeta> | null {
  if (!c.id || !c.symbol || !c.name) return null;
  const priceUsd = num(c.current_price);
  if (priceUsd <= 0) return null;
  const symbol = c.symbol.toUpperCase();
  const description = `${c.name} (${symbol})`;
  // `last_updated` is the right timestamp here — the row reflects market state
  // at that instant, not the moment of the API call. Falling back to "now"
  // keeps the relative-time pill sensible if upstream omits it.
  const createdMs = c.last_updated ? Date.parse(c.last_updated) : Date.now();
  return {
    id: `coingecko:${c.id}`,
    author: authorOf(symbol, c.id),
    content: description,
    url: permalinkFor(c.id),
    createdAt: new Date(
      Number.isFinite(createdMs) ? createdMs : Date.now(),
    ).toISOString(),
    meta: {
      symbol,
      imageUrl: c.image ?? undefined,
      priceUsd,
      priceChange24h: num(c.price_change_percentage_24h),
      marketCapUsd: num(c.market_cap),
      marketCapRank:
        typeof c.market_cap_rank === "number" ? c.market_cap_rank : undefined,
      volume24hUsd: num(c.total_volume),
      high24hUsd: c.high_24h ?? undefined,
      low24hUsd: c.low_24h ?? undefined,
      sparkline7d: c.sparkline_in_7d?.price?.slice(0, 168),
    },
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "minitor/1.0 (+https://github.com/aaronjmars/minitor)",
      ...authHeaders(),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `coingecko ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}

async function fetchTrending(limit: number): Promise<FeedItem<CoingeckoMeta>[]> {
  const url = `${apiBase()}/search/trending`;
  const json = await fetchJson<TrendingResponse>(url);
  const coins = Array.isArray(json.coins) ? json.coins : [];
  return coins
    .map((c) => mapTrendingItem(c))
    .filter((a): a is FeedItem<CoingeckoMeta> => a !== null)
    .slice(0, limit);
}

async function fetchMarkets(
  ids: string | undefined,
  perPage: number,
  page: number,
): Promise<FeedItem<CoingeckoMeta>[]> {
  const params = new URLSearchParams();
  params.set("vs_currency", "usd");
  params.set("order", "market_cap_desc");
  // CoinGecko caps per_page at 250 — clamp defensively even though our caller
  // never asks for more than ~50.
  params.set("per_page", String(Math.min(Math.max(perPage, 1), 250)));
  params.set("page", String(Math.max(page, 0) + 1));
  params.set("sparkline", "true");
  params.set("price_change_percentage", "24h");
  if (ids) {
    // The `ids=` filter requires comma-separated CoinGecko ids (`bitcoin,ethereum`).
    // The watchlist endpoint ignores `order` + `per_page` when `ids` are given
    // (it returns exactly the requested ids), but we pass them anyway for
    // forward-compatibility.
    params.set("ids", ids);
  }
  const url = `${apiBase()}/coins/markets?${params}`;
  const json = await fetchJson<MarketCoin[]>(url);
  const arr = Array.isArray(json) ? json : [];
  return arr
    .map(mapMarketCoin)
    .filter((a): a is FeedItem<CoingeckoMeta> => a !== null);
}

function parseWatchlistIds(raw: string): string {
  // Accept comma, semicolon, or whitespace separators for human-friendly input
  // (`bitcoin, ethereum solana`). Lowercase each id — CoinGecko ids are
  // canonically lowercase slugs (`bitcoin`, not `Bitcoin`).
  return Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
    .slice(0, 50)
    .join(",");
}

export async function fetchCoingeckoPage(
  mode: CoingeckoMode,
  watchlist: string,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<CoingeckoMeta>[]; hasMore: boolean }> {
  if (mode === "trending") {
    // Trending returns a fixed 7-coin window; pagination is a no-op past the
    // first page. We honour `limit` so the column header sizing stays sane.
    if (page > 0) return { items: [], hasMore: false };
    const items = await fetchTrending(Math.max(limit, 7));
    return { items, hasMore: false };
  }

  if (mode === "watchlist") {
    const ids = parseWatchlistIds(watchlist);
    if (!ids) {
      // Empty watchlist is a config-state, not an error — fall through to the
      // top-by-cap stream so a freshly-added column isn't a dead box.
      const items = await fetchMarkets(undefined, Math.max(limit, 30), page);
      return { items, hasMore: items.length >= Math.max(limit, 30) };
    }
    if (page > 0) return { items: [], hasMore: false };
    const items = await fetchMarkets(ids, ids.split(",").length, 0);
    return { items: items.slice(0, limit), hasMore: false };
  }

  // mode === "top"
  const perPage = Math.max(limit, 30);
  const items = await fetchMarkets(undefined, perPage, page);
  return { items: items.slice(0, limit), hasMore: items.length >= perPage };
}
