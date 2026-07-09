import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import type { PolymarketMeta } from "@/lib/columns/plugins/polymarket/plugin";
import { identiconUrl } from "@/lib/utils";
import { stripHtml } from "@/lib/integrations/text";

// `PolymarketMeta` is the renderer contract owned by the polymarket plugin; the
// fetcher here produces `FeedItem<PolymarketMeta>` so its meta lines up with
// what the polymarket renderer reads. Re-exported so call sites that grab
// PolymarketMeta from the integration keep working.
export type { PolymarketMeta };

// Polymarket Gamma API — public, no auth, generous rate limits.
// https://docs.polymarket.com/#markets-1 documents the markets endpoint.
// We use it both for the trending / newest / ending-soon modes (purely
// query-string variations on the same endpoint) and for the optional
// tag-slug filter, which Gamma exposes via `tag_slug=`.
//
// All numeric fields arrive on the response as numbers (`volumeNum`,
// `volume24hrNum`, `liquidityNum`, etc.); the parallel string fields are
// kept around for backwards compatibility with v0 of the API and ignored
// here. `outcomes` and `outcomePrices` arrive as JSON-serialised strings
// of arrays — they need an extra parse pass.
const BASE = "https://gamma-api.polymarket.com";

export type PolymarketMode = "trending" | "newest" | "ending-soon" | "tag";

interface GammaMarketEvent {
  slug?: string;
  title?: string;
}

interface GammaMarket {
  id?: string | number;
  question?: string;
  slug?: string;
  description?: string;
  endDate?: string;
  startDate?: string;
  image?: string;
  icon?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume?: string;
  volumeNum?: number;
  // Gamma returns `volume24hr` as a *number* on live responses (despite older
  // schema docs typing it as a string); the parallel `volume24hrNum` field is
  // documented but in practice always null. Read the bare field with a typeof
  // guard so we keep number values and ignore the legacy string form.
  volume24hr?: number | string;
  volume24hrNum?: number | null;
  liquidity?: string;
  liquidityNum?: number;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  conditionId?: string;
  groupItemTitle?: string;
  events?: GammaMarketEvent[];
}

function parseJsonArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function endpointFor(mode: PolymarketMode, tag: string, limit: number, page: number): string {
  // The Gamma API caps `limit` at 500 per request but we ask for `limit + 1`
  // to detect the "has more" boundary cleanly. Offset is computed off the
  // requested page — pages are 0-indexed and `limit` items wide.
  const params = new URLSearchParams({
    limit: String(Math.min(limit + 1, 100)),
    offset: String(page * limit),
    closed: "false",
    archived: "false",
    active: "true",
  });

  switch (mode) {
    case "newest":
      params.set("order", "startDate");
      params.set("ascending", "false");
      break;
    case "ending-soon":
      // Ascending end-date with a future-only floor — Gamma does not expose a
      // `endDate>=now` filter directly, but markets whose endDate is already
      // in the past will normally be `closed:true` (dropped by the active
      // filter above). Belt-and-braces: we drop any past-dated leftovers in
      // the mapper as well.
      params.set("order", "endDate");
      params.set("ascending", "true");
      break;
    case "tag":
      params.set("order", "volume24hr");
      params.set("ascending", "false");
      if (tag.trim()) {
        params.set("tag_slug", tag.trim().toLowerCase());
      }
      break;
    case "trending":
    default:
      // 24h volume is the canonical signal — newest markets are mostly
      // zero-volume crypto bets; volume picks the markets people are
      // actually trading right now.
      params.set("order", "volume24hr");
      params.set("ascending", "false");
      break;
  }

  return `${BASE}/markets?${params.toString()}`;
}

function permalinkFor(m: GammaMarket): string {
  const eventSlug = m.events?.find((e) => !!e.slug)?.slug;
  if (eventSlug) return `https://polymarket.com/event/${eventSlug}`;
  if (m.slug) return `https://polymarket.com/market/${m.slug}`;
  return "https://polymarket.com";
}

function mapMarket(m: GammaMarket, now: number): FeedItem<PolymarketMeta> | null {
  // Schema-drift safe — without an id or a question there's nothing to
  // render, so drop rather than emit a dead row.
  const id = m.id == null ? "" : String(m.id);
  const question = (m.question ?? "").trim();
  if (!id || !question) return null;

  // Active filter on the API is best-effort; some markets slip through with
  // endDate already in the past. Drop those defensively rather than render
  // a "predict the past" row.
  const endMs = m.endDate ? Date.parse(m.endDate) : NaN;
  if (Number.isFinite(endMs) && endMs < now - 86_400_000) return null;

  const outcomeLabels = parseJsonArray(m.outcomes);
  const outcomePrices = parseJsonArray(m.outcomePrices).map((p) => {
    const n = Number(p);
    return Number.isFinite(n) ? n : 0;
  });
  const outcomes = outcomeLabels.map((label, idx) => ({
    label,
    price: outcomePrices[idx] ?? 0,
  }));

  // For binary markets, sort so the leading outcome shows first; for
  // multi-outcome markets, leave the original order (Polymarket usually
  // sorts them by likelihood already).
  if (outcomes.length === 2) {
    outcomes.sort((a, b) => b.price - a.price);
  }

  const description = m.description ? stripHtml(m.description) : "";
  const content = description ? `${question}\n\n${description}` : question;

  const startMs = m.startDate ? Date.parse(m.startDate) : NaN;
  const createdAt = Number.isFinite(startMs)
    ? new Date(startMs).toISOString()
    : new Date(now).toISOString();

  // Pick the best image we have — `image` is usually richer artwork; `icon`
  // is the smaller round avatar. Prefer image, then icon, then identicon
  // off the question so every market still has something.
  const imageUrl =
    m.image && /^https?:/i.test(m.image)
      ? m.image
      : m.icon && /^https?:/i.test(m.icon)
        ? m.icon
        : undefined;

  return {
    id,
    author: {
      name: "Polymarket",
      handle: m.groupItemTitle ?? "polymarket",
      avatarUrl: imageUrl ?? identiconUrl(question),
    },
    content,
    url: permalinkFor(m),
    createdAt,
    meta: {
      outcomes,
      volume24hUsd:
        typeof m.volume24hr === "number"
          ? m.volume24hr
          : typeof m.volume24hrNum === "number"
            ? m.volume24hrNum
            : 0,
      liquidityUsd: typeof m.liquidityNum === "number" ? m.liquidityNum : 0,
      endDate: m.endDate,
      category: m.groupItemTitle,
      conditionId: m.conditionId,
      imageUrl,
    },
  };
}

export async function fetchPolymarketPage(
  mode: PolymarketMode,
  tag: string,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<PolymarketMeta>[]; hasMore: boolean }> {
  const url = endpointFor(mode, tag, limit, page);
  const res = await fetchUpstream(url, {
    headers: {
      accept: "application/json",
      // Polymarket's Gamma API is openly documented as public; identifying
      // ourselves keeps us in good standing if they ever start enforcing
      // per-client rate limits.
      "user-agent": "minitor/1.0 (+https://github.com/aaronjmars/minitor)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Polymarket ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as GammaMarket[];
  if (!Array.isArray(json)) {
    return { items: [], hasMore: false };
  }

  const now = Date.now();
  const mapped = json
    .map((m) => mapMarket(m, now))
    .filter((m): m is FeedItem<PolymarketMeta> => m !== null);

  // We over-requested by one to cleanly detect the boundary; clamp the
  // visible slice back to the caller's `limit`.
  const hasMore = json.length > limit;
  return { items: mapped.slice(0, limit), hasMore };
}
