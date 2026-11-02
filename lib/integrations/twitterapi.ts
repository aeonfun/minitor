import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import { isPlaceholderValue } from "@/lib/env-keys";

const BASE = "https://api.twitterapi.io/twitter";

interface TwitterApiTweet {
  id?: string;
  text?: string;
  url?: string;
  createdAt?: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
  author?: {
    userName?: string;
    name?: string;
  };
}

interface SearchResponse {
  tweets?: TwitterApiTweet[];
}

const AVATAR_CACHE = new Map<string, string>();

function avatarFor(handle: string): string {
  const clean = handle.replace(/^@/, "");
  let cached = AVATAR_CACHE.get(clean);
  if (!cached) {
    const fallback = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(clean)}`;
    cached = `https://unavatar.io/x/${encodeURIComponent(clean)}?fallback=${encodeURIComponent(fallback)}`;
    AVATAR_CACHE.set(clean, cached);
  }
  return cached;
}

export function twitterApiKey(): string | undefined {
  const key = process.env.TWITTER_API_KEY;
  if (isPlaceholderValue(key)) return undefined;
  return key!.trim();
}

/** Twitter-native createdAt ("Wed Sep 09 20:21:43 +0000 2026") to ISO. */
export function twitterCreatedAtToIso(createdAt: string | undefined): string {
  if (!createdAt) return new Date().toISOString();
  const parsed = new Date(createdAt);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

export function tweetToFeedItem(tweet: TwitterApiTweet): FeedItem | null {
  const content = (tweet.text ?? "").trim();
  if (!content) return null;
  const handle = (tweet.author?.userName ?? "").replace(/^@/, "").trim();
  const id = tweet.id ? String(tweet.id) : content.slice(0, 32);
  const url = tweet.url ?? (handle ? `https://x.com/${handle}/status/${id}` : undefined);
  return {
    id,
    author: {
      name: tweet.author?.name ?? handle ?? "Unknown",
      handle: handle || undefined,
      avatarUrl: handle ? avatarFor(handle) : undefined,
    },
    content,
    url,
    createdAt: twitterCreatedAtToIso(tweet.createdAt),
    meta: {
      likes: Number(tweet.likeCount ?? 0),
      retweets: Number(tweet.retweetCount ?? 0),
      replies: Number(tweet.replyCount ?? 0),
      views: Number(tweet.viewCount ?? 0),
    },
  };
}

async function advancedSearch(query: string, limit: number): Promise<FeedItem[]> {
  const key = twitterApiKey();
  if (!key) {
    throw new Error("TWITTER_API_KEY is not set.");
  }
  const url = new URL(`${BASE}/tweet/advanced_search`);
  url.searchParams.set("query", query);
  url.searchParams.set("queryType", "Latest");
  const res = await fetchUpstream(
    url,
    { headers: { "X-API-Key": key } },
    { label: "TwitterAPI.io" },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TwitterAPI.io ${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
  }
  const data = (await res.json()) as SearchResponse;
  const tweets = Array.isArray(data.tweets) ? data.tweets : [];
  return tweets
    .map(tweetToFeedItem)
    .filter((i): i is FeedItem => i !== null)
    .slice(0, limit);
}

export async function twitterapiSearch(query: string, limit = 30): Promise<FeedItem[]> {
  const q = query.trim();
  if (!q) throw new Error("Search query is required.");
  return advancedSearch(q, limit);
}

export async function twitterapiTrending(topic: string, limit = 30): Promise<FeedItem[]> {
  const scope = topic.trim();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const query = scope ? `${scope} min_faves:50 since:${since}` : `min_faves:200 since:${since}`;
  return advancedSearch(query, limit);
}
