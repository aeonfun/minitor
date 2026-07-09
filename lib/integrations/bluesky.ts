import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";

// Bluesky public AppView — keyless, no auth, generous quota for read endpoints.
// https://docs.bsky.app/docs/api
// Both endpoints used here are documented as public.
const BLUESKY = "https://public.api.bsky.app/xrpc";

export type BlueskyMode = "search" | "author";

interface BlueskyAuthor {
  did?: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

interface BlueskyRecord {
  text?: string;
  createdAt?: string;
}

interface BlueskyPost {
  uri?: string;
  cid?: string;
  author?: BlueskyAuthor;
  record?: BlueskyRecord;
  indexedAt?: string;
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
}

interface SearchResponse {
  posts?: BlueskyPost[];
  cursor?: string;
}

interface AuthorFeedItem {
  post?: BlueskyPost;
  reason?: { $type?: string };
}

interface AuthorFeedResponse {
  feed?: AuthorFeedItem[];
  cursor?: string;
}

// at://did:plc:abc/app.bsky.feed.post/3kxyz → 3kxyz (the rkey).
// Falls back to the full uri if the format doesn't match — better a
// non-clickable id than throwing on a future record-type change.
function rkeyFromUri(uri: string): string {
  const m = /\/([^/]+)$/.exec(uri);
  return m ? m[1] : uri;
}

function postUrl(post: BlueskyPost): string {
  const handle = post.author?.handle;
  const uri = post.uri ?? "";
  if (!handle || !uri) return "https://bsky.app";
  return `https://bsky.app/profile/${handle}/post/${rkeyFromUri(uri)}`;
}

function mapPost(post: BlueskyPost): FeedItem | null {
  const handle = post.author?.handle;
  const uri = post.uri;
  // Skip posts that lack either an author handle or a uri — the renderer
  // can't link to them and there's no useful id, so they'd just render as
  // dead content. Bluesky's API normally returns both, this guards against
  // schema drift from future record types.
  if (!handle || !uri) return null;

  const text = post.record?.text ?? "";
  const createdAt =
    post.record?.createdAt ?? post.indexedAt ?? new Date().toISOString();

  return {
    id: post.cid ?? uri,
    author: {
      name: post.author?.displayName?.trim() || handle,
      handle,
      avatarUrl: post.author?.avatar,
    },
    content: text,
    url: postUrl(post),
    createdAt,
    meta: {
      likes: post.likeCount ?? 0,
      reposts: (post.repostCount ?? 0) + (post.quoteCount ?? 0),
      replies: post.replyCount ?? 0,
      postUrl: postUrl(post),
    },
  };
}

async function fetchSearch(
  query: string,
  limit: number,
  cursor?: string,
): Promise<{ items: FeedItem[]; nextCursor?: string }> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    sort: "latest",
  });
  if (cursor) params.set("cursor", cursor);
  const res = await fetchUpstream(`${BLUESKY}/app.bsky.feed.searchPosts?${params}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Bluesky search ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as SearchResponse;
  const items = (json.posts ?? [])
    .map(mapPost)
    .filter((x): x is FeedItem => x !== null);
  return { items, nextCursor: json.cursor };
}

async function fetchAuthor(
  actor: string,
  limit: number,
  cursor?: string,
): Promise<{ items: FeedItem[]; nextCursor?: string }> {
  const params = new URLSearchParams({
    actor,
    limit: String(limit),
    filter: "posts_no_replies",
  });
  if (cursor) params.set("cursor", cursor);
  const res = await fetchUpstream(`${BLUESKY}/app.bsky.feed.getAuthorFeed?${params}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Bluesky author ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as AuthorFeedResponse;
  // Skip reposts — Bluesky author feeds include them but the resulting card
  // would attribute the original poster, which is confusing in a column titled
  // "by @actor". `posts_no_replies` removes replies but not reposts.
  const items = (json.feed ?? [])
    .filter((entry) => !entry.reason)
    .map((entry) => entry.post)
    .filter((p): p is BlueskyPost => Boolean(p))
    .map(mapPost)
    .filter((x): x is FeedItem => x !== null);
  return { items, nextCursor: json.cursor };
}

function normalizeHandle(input: string): string {
  // Accept "@example.bsky.social", "example.bsky.social", or a bare username
  // ("example"). The bare username gets ".bsky.social" appended — the canonical
  // suffix for users who haven't set a custom handle.
  const trimmed = input.trim().replace(/^@/, "");
  if (!trimmed) return trimmed;
  if (trimmed.includes(".")) return trimmed;
  return `${trimmed}.bsky.social`;
}

export async function fetchBlueskyPage(
  mode: BlueskyMode,
  query: string,
  handle: string,
  limit: number,
  cursor?: string,
): Promise<{ items: FeedItem[]; nextCursor?: string }> {
  if (mode === "author") {
    const actor = normalizeHandle(handle);
    if (!actor) return { items: [] };
    return fetchAuthor(actor, limit, cursor);
  }
  const q = query.trim();
  if (!q) return { items: [] };
  return fetchSearch(q, limit, cursor);
}
