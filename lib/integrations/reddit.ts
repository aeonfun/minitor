import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import { identiconUrl } from "@/lib/utils";

const UA = "minitor/0.1 (https://github.com/anthropics/claude-code dashboard)";

interface RedditChild {
  data: {
    id: string;
    name?: string;
    author?: string;
    title?: string;
    selftext?: string;
    permalink?: string;
    url?: string;
    created_utc?: number;
    score?: number;
    num_comments?: number;
    subreddit?: string;
    thumbnail?: string;
    is_self?: boolean;
    over_18?: boolean;
    stickied?: boolean;
  };
}

interface RedditListing {
  data?: { children?: RedditChild[] };
  message?: string;
  error?: number;
}

const SORTS = new Set(["hot", "new", "top", "rising"]);

interface RedditListingDataExt {
  children?: RedditChild[];
  after?: string | null;
  before?: string | null;
}

interface RedditListingExt {
  data?: RedditListingDataExt;
  message?: string;
  error?: number;
}

export async function fetchSubredditPage(
  subreddit: string,
  sortBy: string,
  limit = 12,
  after?: string,
): Promise<{ items: FeedItem[]; nextAfter?: string }> {
  const sub = subreddit.trim().replace(/^r\//, "") || "popular";
  const sort = SORTS.has(sortBy) ? sortBy : "hot";
  const params = new URLSearchParams({
    limit: String(limit),
    raw_json: "1",
  });
  if (after) params.set("after", after);
  const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/${sort}.json?${params}`;

  const res = await fetchUpstream(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Reddit ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const json = (await res.json()) as RedditListingExt;
  if (json.error || !json.data?.children) {
    throw new Error(`Reddit error: ${json.message ?? "no listing data"}`);
  }

  const items = json.data.children
    .filter((c) => !c.data.stickied)
    .slice(0, limit)
    .map((c) => toFeedItem(c, sub));
  const nextAfter = json.data.after ?? undefined;
  return { items, nextAfter: nextAfter || undefined };
}

function toFeedItem(c: RedditChild, fallbackSub: string): FeedItem {
  const d = c.data;
  const author = d.author ?? "unknown";
  const permalink = d.permalink
    ? `https://reddit.com${d.permalink}`
    : d.url;
  return {
    id: d.id,
    author: {
      name: author,
      handle: author,
      avatarUrl: identiconUrl(author),
    },
    content: d.title ?? "",
    url: permalink,
    createdAt: new Date(((d.created_utc ?? 0) * 1000) || Date.now()).toISOString(),
    meta: {
      score: d.score ?? 0,
      comments: d.num_comments ?? 0,
      subreddit: d.subreddit ?? fallbackSub,
      isSelf: !!d.is_self,
      externalUrl: !d.is_self ? d.url : undefined,
      nsfw: !!d.over_18,
    },
  };
}

export async function searchReddit(
  query: string,
  limit = 12,
): Promise<FeedItem[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=new&limit=${limit}&raw_json=1`;
  const res = await fetchUpstream(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Reddit ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as RedditListing;
  if (!json.data?.children) return [];
  return json.data.children
    .slice(0, limit)
    .map((c) => toFeedItem(c, c.data.subreddit ?? "all"));
}
