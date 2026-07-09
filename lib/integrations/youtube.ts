import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import { fetchFeed } from "@/lib/integrations/rss";
import { identiconUrl, truncateText } from "@/lib/utils";

// YouTube Data API v3 for search; YouTube's public Atom feeds for channel /
// playlist (no key needed). Search costs 100 units / call, default daily
// quota is 10,000 → ~100 searches per day on the free tier.
const API = "https://www.googleapis.com/youtube/v3";

export type YTMode = "search" | "channel" | "playlist";
export type YTOrder = "date" | "relevance" | "viewCount" | "rating";

interface YTSearchItem {
  id?: { videoId?: string; kind?: string };
  snippet?: {
    publishedAt?: string;
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    thumbnails?: Record<string, { url?: string; width?: number; height?: number }>;
    publishTime?: string;
  };
}

interface YTSearchResponse {
  items?: YTSearchItem[];
  nextPageToken?: string;
  error?: { message?: string };
}

interface YTVideoItem {
  id?: string;
  contentDetails?: { duration?: string };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface YTVideosResponse {
  items?: YTVideoItem[];
  error?: { message?: string };
}

function pickThumbnail(
  thumbs?: Record<string, { url?: string }>,
): string | undefined {
  if (!thumbs) return undefined;
  return (
    thumbs.medium?.url ??
    thumbs.high?.url ??
    thumbs.standard?.url ??
    thumbs.maxres?.url ??
    thumbs.default?.url
  );
}

// PT12M34S → 12:34, PT1H2M3S → 1:02:03
function parseDuration(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return undefined;
  const h = Number(m[1] ?? 0);
  const mn = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(mn)}:${pad(s)}` : `${mn}:${pad(s)}`;
}

export async function fetchSearchPage(
  query: string,
  order: YTOrder,
  limit: number,
  pageToken?: string,
): Promise<{ items: FeedItem[]; nextPageToken?: string }> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error(
      "YOUTUBE_API_KEY is not set in .env.local. Get one free at https://console.cloud.google.com (enable YouTube Data API v3).",
    );
  }
  const q = query.trim();
  if (!q) throw new Error("Query is required.");

  const sParams = new URLSearchParams({
    part: "snippet",
    q,
    type: "video",
    order,
    maxResults: String(limit),
    key,
  });
  if (pageToken) sParams.set("pageToken", pageToken);
  const sRes = await fetchUpstream(`${API}/search?${sParams}`, { cache: "no-store" });
  if (!sRes.ok) {
    const body = await sRes.text().catch(() => "");
    throw new Error(`YouTube search ${sRes.status}: ${body.slice(0, 240)}`);
  }
  const sJson = (await sRes.json()) as YTSearchResponse;
  if (sJson.error) throw new Error(`YouTube: ${sJson.error.message}`);
  const items = sJson.items ?? [];
  const ids = items
    .map((i) => i.id?.videoId)
    .filter((v): v is string => typeof v === "string");
  if (ids.length === 0) {
    return { items: [], nextPageToken: sJson.nextPageToken };
  }

  // Second call for stats + duration (free, costs ~3 units total).
  const vParams = new URLSearchParams({
    part: "contentDetails,statistics",
    id: ids.join(","),
    key,
  });
  const vRes = await fetchUpstream(`${API}/videos?${vParams}`, { cache: "no-store" });
  const vJson = vRes.ok
    ? ((await vRes.json()) as YTVideosResponse)
    : ({ items: [] } as YTVideosResponse);
  const detail = new Map<string, YTVideoItem>();
  for (const v of vJson.items ?? []) {
    if (v.id) detail.set(v.id, v);
  }

  const mapped: FeedItem[] = items
    .map((it): FeedItem | null => {
      const videoId = it.id?.videoId;
      const sn = it.snippet;
      if (!videoId || !sn) return null;
      const d = detail.get(videoId);
      const description = (sn.description ?? "").trim();
      const trimmed = truncateText(description, 280);
      return {
        id: videoId,
        author: {
          name: sn.channelTitle ?? "YouTube",
          handle: sn.channelTitle ?? "youtube",
          avatarUrl: identiconUrl(sn.channelId ?? sn.channelTitle ?? "yt"),
        },
        content: trimmed ? `${sn.title ?? ""}\n\n${trimmed}` : (sn.title ?? ""),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        createdAt: sn.publishedAt ?? sn.publishTime ?? new Date().toISOString(),
        meta: {
          kind: "youtube",
          videoId,
          channelId: sn.channelId,
          channelTitle: sn.channelTitle,
          thumbnail: pickThumbnail(sn.thumbnails),
          duration: parseDuration(d?.contentDetails?.duration),
          views: d?.statistics?.viewCount
            ? Number(d.statistics.viewCount)
            : undefined,
          likes: d?.statistics?.likeCount
            ? Number(d.statistics.likeCount)
            : undefined,
        },
      };
    })
    .filter((i): i is FeedItem => i !== null);
  return { items: mapped, nextPageToken: sJson.nextPageToken };
}

async function fetchSearch(
  query: string,
  order: YTOrder,
  limit: number,
): Promise<FeedItem[]> {
  const { items } = await fetchSearchPage(query, order, limit);
  return items;
}

function videoIdFromUrl(url: string): string | undefined {
  const m =
    /(?:youtu\.be\/|v=|\/shorts\/|\/embed\/)([\w-]{11})/.exec(url) ?? undefined;
  return m?.[1];
}

async function fetchByXmlFeed(
  feedUrl: string,
  limit: number,
): Promise<FeedItem[]> {
  const items = await fetchFeed(feedUrl, limit);
  return items.map((it) => {
    const videoId = it.url ? videoIdFromUrl(it.url) : undefined;
    const thumbnail = videoId
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : undefined;
    return {
      ...it,
      meta: {
        ...(it.meta ?? {}),
        kind: "youtube",
        videoId,
        thumbnail,
      },
    };
  });
}

async function fetchChannel(
  channel: string,
  limit: number,
): Promise<FeedItem[]> {
  const raw = channel.trim();
  if (!raw) throw new Error("Channel id or @handle is required.");
  // Channel ID (UCxxx, 24 chars) → channel_id feed; otherwise treat as handle.
  if (/^UC[\w-]{20,}$/.test(raw)) {
    return fetchByXmlFeed(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${raw}`,
      limit,
    );
  }
  const handle = raw.replace(/^@/, "");
  // Resolve handle → channel id via the channel page (no key needed).
  const html = await fetchUpstream(`https://www.youtube.com/@${encodeURIComponent(handle)}`, {
    headers: { "user-agent": "minitor/0.1", accept: "text/html" },
    cache: "no-store",
  }).then((r) => (r.ok ? r.text() : ""));
  const idMatch = /"channelId":"(UC[\w-]{20,})"/.exec(html) ?? /channel_id=(UC[\w-]{20,})/.exec(html);
  if (!idMatch) {
    throw new Error(`Couldn't resolve YouTube channel @${handle}.`);
  }
  return fetchByXmlFeed(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${idMatch[1]}`,
    limit,
  );
}

async function fetchPlaylist(
  playlistId: string,
  limit: number,
): Promise<FeedItem[]> {
  const id = playlistId.trim();
  if (!id) throw new Error("Playlist id is required.");
  return fetchByXmlFeed(
    `https://www.youtube.com/feeds/videos.xml?playlist_id=${id}`,
    limit,
  );
}

export async function fetchYouTube(
  mode: YTMode,
  config: { query?: string; order?: string; channel?: string; playlist?: string },
  limit = 12,
): Promise<FeedItem[]> {
  switch (mode) {
    case "channel":
      return fetchChannel(config.channel ?? "", limit);
    case "playlist":
      return fetchPlaylist(config.playlist ?? "", limit);
    case "search":
    default: {
      const order = (config.order === "relevance" ||
      config.order === "viewCount" ||
      config.order === "rating"
        ? config.order
        : "date") as YTOrder;
      return fetchSearch(config.query ?? "", order, limit);
    }
  }
}
