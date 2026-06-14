import type { FeedItem } from "@/lib/columns/types";
import type { ProductHuntMeta } from "@/lib/columns/plugins/producthunt/plugin";
import { fetchFeed } from "@/lib/integrations/rss";

// `ProductHuntMeta` is the renderer contract owned by the producthunt plugin;
// the fetcher here produces `FeedItem<ProductHuntMeta>` so its meta lines up
// with what the producthunt renderer reads. Re-exported so call sites that grab
// ProductHuntMeta from the integration keep working.
export type { ProductHuntMeta };

// Product Hunt RSS feed — keyless, public. The frontpage feed
// (https://www.producthunt.com/feed) lists every product launched today plus a
// rolling tail of the previous days. Each <item> has:
//   - title       "{Product Name} — {tagline}"
//   - link        https://www.producthunt.com/posts/{slug}
//   - description HTML with the tagline + an embedded product image
//   - pubDate     launch timestamp
//
// PH used to expose a public GraphQL API but it now requires an OAuth flow with
// rate caps that aren't usable for a keyless dashboard column. RSS is the
// stable, key-free surface — it lags a few minutes behind the live frontpage
// but covers the same set of daily launches.
const FEED_URL = "https://www.producthunt.com/feed";

export type ProductHuntMode = "today" | "topic";

interface FeedRowMeta {
  source?: string;
  feedTitle?: string;
}

// PH titles ship as "Linear — A better way to build software". Both em-dash
// (U+2014) and en-dash (U+2013) appear in the wild; ASCII hyphen-minus is
// reserved for names like "Add-on" and stays inside the product name. Split on
// the first em/en-dash surrounded by whitespace and treat both halves as
// optional — if the title shape is anything else, fall through to the raw
// title as the product name.
function splitTitle(title: string): { productName: string; tagline: string } {
  const trimmed = title.trim();
  const match = trimmed.match(/^(.+?)\s+[—–]\s+(.+)$/);
  if (match) {
    return {
      productName: match[1].trim(),
      tagline: match[2].trim(),
    };
  }
  return { productName: trimmed, tagline: "" };
}

function slugFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    // /posts/{slug} — the slug is the last segment, which is what PH uses for
    // its permalink. Other paths (/topics/, /collections/) wouldn't show up in
    // the daily feed but we defensively bail rather than misclassify.
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments[0] !== "posts" || !segments[1]) return undefined;
    return segments[1].toLowerCase();
  } catch {
    return undefined;
  }
}

// `fetchFeed` already cleans HTML out of the description and merges it into
// `content` as "{title}\n\n{description}". For the PH renderer we want the
// description by itself so it can render under the structured product name +
// tagline — split it back out here.
function splitContent(content: string): { title: string; description: string } {
  const idx = content.indexOf("\n\n");
  if (idx === -1) return { title: content, description: "" };
  return {
    title: content.slice(0, idx),
    description: content.slice(idx + 2).trim(),
  };
}

function tagWithProductHunt(item: FeedItem): FeedItem<ProductHuntMeta> {
  const { title } = splitContent(item.content);
  const { productName, tagline } = splitTitle(title);
  const slug = slugFromUrl(item.url);
  const prevMeta = item.meta as FeedRowMeta | undefined;
  return {
    ...item,
    // Prefer the PH slug for the id so the same product across multiple fetches
    // collapses to one row in the column store. Fall back to the upstream id
    // (which is itself derived from guid/link in lib/integrations/rss.ts) when
    // the slug isn't extractable — e.g. a feed item that isn't a /posts/ link.
    id: slug ? `producthunt:${slug}` : item.id,
    meta: {
      source: prevMeta?.source ?? "Product Hunt",
      feedTitle: prevMeta?.feedTitle ?? "Product Hunt",
      slug,
      productName,
      tagline,
    },
  };
}

// Normalise the user-entered topic filter into a list of lowercase needles.
// Accepts the same separators as the DEV.to integration (comma / semicolon /
// whitespace), deduplicates, and caps at 5 — the same shape minitor uses for
// keyword inputs across plugins.
export function parseTopicFilter(input: string): string[] {
  const parts = input
    .split(/[,;\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length === 5) break;
  }
  return out;
}

function matchesTopic(item: FeedItem<ProductHuntMeta>, needles: string[]): boolean {
  if (needles.length === 0) return true;
  const haystack = [
    item.content,
    item.url ?? "",
    item.meta?.productName ?? "",
    item.meta?.tagline ?? "",
  ]
    .join(" ")
    .toLowerCase();
  // OR-match across needles — a multi-topic filter ("ai, design") returns
  // products tagged with either, not the (much narrower) intersection. PH
  // launches are sparse per day; AND would zero out most queries.
  return needles.some((n) => haystack.includes(n));
}

export async function fetchProductHuntPage(
  mode: ProductHuntMode,
  topic: string,
  limit: number,
): Promise<FeedItem<ProductHuntMeta>[]> {
  // The feed always returns the same window (today + a rolling tail). Both
  // modes share the same fetch — `topic` just adds a client-side filter step.
  // Mode is kept as a type so future PH endpoints (per-topic RSS, leaderboard)
  // can plug in without breaking the column config shape.
  void mode;

  // Pull a generous batch so the topic filter has room to find matches. The
  // PH feed only exposes ~30 items at the tail so 50 is the practical ceiling
  // even when topic is empty.
  const raw = await fetchFeed(FEED_URL, Math.max(limit, 50));
  const tagged = raw.map(tagWithProductHunt);
  const needles = parseTopicFilter(topic);
  const filtered = needles.length === 0
    ? tagged
    : tagged.filter((item) => matchesTopic(item, needles));
  return filtered.slice(0, limit);
}
