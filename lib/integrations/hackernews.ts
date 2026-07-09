import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import { identiconUrl } from "@/lib/utils";

// Algolia HN API — public, no auth, generous rate limits.
// https://hn.algolia.com/api
const ALGOLIA = "https://hn.algolia.com/api/v1";

export type HNMode = "top" | "new" | "ask" | "show" | "query";

interface AlgoliaHit {
  objectID: string;
  title?: string;
  story_title?: string;
  url?: string;
  story_url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  created_at_i?: number;
  story_text?: string;
  comment_text?: string;
  story_id?: number;
  _tags?: string[];
}

interface AlgoliaResponse {
  hits?: AlgoliaHit[];
  nbHits?: number;
  page?: number;
  nbPages?: number;
}

function endpointFor(
  mode: HNMode,
  query: string,
  limit: number,
  page: number,
): string {
  const params = new URLSearchParams({
    hitsPerPage: String(limit),
    page: String(page),
  });
  switch (mode) {
    case "new":
      params.set("tags", "story");
      return `${ALGOLIA}/search_by_date?${params}`;
    case "ask":
      params.set("tags", "ask_hn");
      return `${ALGOLIA}/search?${params}`;
    case "show":
      params.set("tags", "show_hn");
      return `${ALGOLIA}/search?${params}`;
    case "query":
      params.set("tags", "story");
      params.set("query", query);
      return `${ALGOLIA}/search?${params}`;
    case "top":
    default:
      params.set("tags", "front_page");
      return `${ALGOLIA}/search?${params}`;
  }
}

function mapHit(h: AlgoliaHit): FeedItem {
  const title = h.title ?? h.story_title ?? "(untitled)";
  const externalUrl = h.url ?? h.story_url;
  const itemUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
  const author = h.author ?? "anonymous";
  const createdMs =
    typeof h.created_at_i === "number"
      ? h.created_at_i * 1000
      : h.created_at
        ? Date.parse(h.created_at)
        : Date.now();

  const snippet =
    h.story_text
      ?.replace(/<[^>]+>/g, "")
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .trim() ?? "";

  return {
    id: h.objectID,
    author: {
      name: author,
      handle: author,
      avatarUrl: identiconUrl(author),
    },
    content: snippet ? `${title}\n\n${snippet}` : title,
    url: externalUrl ?? itemUrl,
    createdAt: new Date(createdMs).toISOString(),
    meta: {
      points: h.points ?? 0,
      comments: h.num_comments ?? 0,
      commentsUrl: itemUrl,
      externalUrl: externalUrl ?? undefined,
    },
  };
}

export async function fetchHackerNewsPage(
  mode: HNMode,
  query = "",
  limit = 12,
  page = 0,
): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  const url = endpointFor(mode, query, limit, page);
  const res = await fetchUpstream(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HN ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as AlgoliaResponse;
  const hits = json.hits ?? [];
  const totalPages = typeof json.nbPages === "number" ? json.nbPages : 1;
  const hasMore = page + 1 < totalPages && hits.length === limit;
  return { items: hits.slice(0, limit).map(mapHit), hasMore };
}

export async function fetchHackerNews(
  mode: HNMode,
  query = "",
  limit = 12,
): Promise<FeedItem[]> {
  const { items } = await fetchHackerNewsPage(mode, query, limit, 0);
  return items;
}
