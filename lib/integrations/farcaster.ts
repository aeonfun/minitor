import type { FeedItem } from "@/lib/columns/types";

// Farcaster via Neynar. Only USER and SEARCH modes are exposed — TRENDING and
// CHANNEL require Neynar Starter+ ($9/mo, return 402 on the free tier).
//
// Search relies on a trick: Neynar publishes a public demo key
// (`NEYNAR_API_DOCS`) used in their docs that responds to /cast/search even
// on the free tier. We try the user's key first; on 402 fall back to the demo
// key. Rate-limited at the demo bucket but works for low-volume monitoring.
//
// Public-hub fallbacks (Pinata, nemes/lamia) were ruled out as of 2026-04 —
// all down, paywalled, or unreachable. Self-hosted Snapchain is the only
// keyless path.

const NEYNAR = "https://api.neynar.com";

interface NeynarAuthor {
  fid?: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  follower_count?: number;
  power_badge?: boolean;
}

interface NeynarReactions {
  likes_count?: number;
  recasts_count?: number;
}

interface NeynarReplies {
  count?: number;
}

interface NeynarChannel {
  id?: string;
  name?: string;
  image_url?: string;
}

interface NeynarCast {
  hash?: string;
  thread_hash?: string;
  parent_hash?: string | null;
  author?: NeynarAuthor;
  text?: string;
  timestamp?: string;
  reactions?: NeynarReactions;
  replies?: NeynarReplies;
  channel?: NeynarChannel | null;
  embeds?: Array<{ url?: string; cast_id?: { hash?: string } }>;
}

interface NeynarCastsResponse {
  casts?: NeynarCast[];
  result?: { casts?: NeynarCast[] };
  message?: string;
}

interface NeynarUserLookupResponse {
  user?: { fid?: number; username?: string };
  result?: { user?: { fid?: number; username?: string } };
}

const DEMO_KEY = "NEYNAR_API_DOCS";

function headersWith(key: string): HeadersInit {
  return {
    "x-api-key": key,
    accept: "application/json",
    "user-agent": "minitor/0.1",
  };
}

function userKey(): string {
  // Fall back to Neynar's public docs/demo key when no user key is set. It's
  // rate-limited but works for /cast/search and user lookups out of the box.
  return process.env.NEYNAR_API_KEY || DEMO_KEY;
}

async function neynar<T>(
  path: string,
  options?: { fallbackToDemoOn402?: boolean },
): Promise<T> {
  const url = `${NEYNAR}${path}`;
  const res = await fetch(url, {
    headers: headersWith(userKey()),
    cache: "no-store",
  });

  if (res.status === 402 && options?.fallbackToDemoOn402) {
    const demoRes = await fetch(url, {
      headers: headersWith(DEMO_KEY),
      cache: "no-store",
    });
    if (!demoRes.ok) {
      const body = await demoRes.text().catch(() => "");
      throw new Error(
        `Neynar ${demoRes.status} (demo fallback): ${body.slice(0, 240)}`,
      );
    }
    return (await demoRes.json()) as T;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Neynar ${res.status}: ${body.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

function castUrl(c: NeynarCast): string {
  const username = c.author?.username;
  const hash = c.hash;
  if (username && hash) {
    return `https://warpcast.com/${username}/${hash.slice(0, 10)}`;
  }
  return "https://warpcast.com";
}

function castToFeedItem(c: NeynarCast): FeedItem | null {
  const text = (c.text ?? "").trim();
  if (!text || !c.hash) return null;
  const author = c.author ?? {};
  const username = author.username ?? `fid-${author.fid ?? "?"}`;
  return {
    id: c.hash,
    author: {
      name: author.display_name ?? username,
      handle: username,
      avatarUrl:
        author.pfp_url ??
        `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
    },
    content: text,
    url: castUrl(c),
    createdAt: c.timestamp ?? new Date().toISOString(),
    meta: {
      likes: c.reactions?.likes_count ?? 0,
      recasts: c.reactions?.recasts_count ?? 0,
      replies: c.replies?.count ?? 0,
      followers: author.follower_count ?? 0,
      powerBadge: !!author.power_badge,
      channelId: c.channel?.id ?? undefined,
      channelName: c.channel?.name ?? undefined,
      fid: author.fid,
      isFarcaster: true,
    },
  };
}

function mapCasts(casts: NeynarCast[], limit: number): FeedItem[] {
  return casts
    .map(castToFeedItem)
    .filter((it): it is FeedItem => it !== null)
    .slice(0, limit);
}

async function resolveFid(usernameOrFid: string): Promise<number> {
  const raw = usernameOrFid.trim().replace(/^@/, "");
  if (!raw) throw new Error("Username or FID is required.");
  if (/^\d+$/.test(raw)) return Number(raw);
  const json = await neynar<NeynarUserLookupResponse>(
    `/v2/farcaster/user/by_username?username=${encodeURIComponent(raw)}`,
  );
  const fid = json.user?.fid ?? json.result?.user?.fid;
  if (!fid) throw new Error(`Couldn't resolve @${raw} on Farcaster.`);
  return fid;
}

export async function fetchFarcasterUser(
  usernameOrFid: string,
  limit = 12,
): Promise<FeedItem[]> {
  const fid = await resolveFid(usernameOrFid);
  const params = new URLSearchParams({
    fid: String(fid),
    limit: String(limit),
    include_replies: "false",
  });
  const json = await neynar<NeynarCastsResponse>(
    `/v2/farcaster/feed/user/casts?${params}`,
  );
  const casts = json.casts ?? json.result?.casts ?? [];
  return mapCasts(casts, limit);
}

export async function fetchFarcasterSearch(
  query: string,
  limit = 12,
): Promise<FeedItem[]> {
  const q = query.trim();
  if (!q) throw new Error("Query is required.");
  const params = new URLSearchParams({ q, limit: String(limit) });
  // Trailing slash on /search/ matters — that's what Neynar's docs use, and
  // the user's free tier only resolves that variant via demo-key fallback.
  const json = await neynar<NeynarCastsResponse>(
    `/v2/farcaster/cast/search/?${params}`,
    { fallbackToDemoOn402: true },
  );
  const casts = json.casts ?? json.result?.casts ?? [];
  return mapCasts(casts, limit);
}
