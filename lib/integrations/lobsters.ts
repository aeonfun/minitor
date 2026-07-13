import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import type { LobstersMeta } from "@/lib/columns/plugins/lobsters/plugin";
import { identiconUrl } from "@/lib/utils";
import { stripHtml } from "@/lib/integrations/text";

// `LobstersMeta` is the renderer contract owned by the lobsters plugin; the
// fetcher here produces `FeedItem<LobstersMeta>` so its meta lines up with what
// the lobsters renderer reads. Re-exported so call sites that grab LobstersMeta
// from the integration keep working.
export type { LobstersMeta };

// Lobsters JSON API — public, no auth, generous rate limits.
// https://lobste.rs/about — Active, hottest, newest, and per-tag feeds all
// expose .json variants of their HTML pages. Pagination flows through
// /page/N/{mode}.json. The story object shape is documented at
// https://github.com/lobsters/lobsters/blob/master/app/views/stories/_story.json.jbuilder
const BASE = "https://lobste.rs";

export type LobstersMode = "hottest" | "newest" | "active" | "tag";

interface LobstersStory {
  short_id: string;
  short_id_url?: string;
  comments_url?: string;
  url?: string;
  title: string;
  description?: string;
  description_plain?: string;
  score?: number;
  upvotes?: number;
  downvotes?: number;
  comment_count?: number;
  created_at?: string;
  tags?: string[];
  submitter_user?: string | { username?: string };
  user_is_author?: boolean;
}

function endpointFor(mode: LobstersMode, tag: string, page: number): string {
  // Lobsters uses /page/N/ — page 1 is the bare root, no /page/1/ segment.
  const pageSegment = page > 0 ? `/page/${page + 1}` : "";
  switch (mode) {
    case "tag": {
      // Multiple tags can be combined with commas (e.g. /t/rust,go.json).
      const slug = tag
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .join(",");
      return `${BASE}/t/${encodeURIComponent(slug)}${pageSegment}.json`;
    }
    case "newest":
      return `${BASE}/newest${pageSegment}.json`;
    case "active":
      return `${BASE}/active${pageSegment}.json`;
    case "hottest":
    default:
      // The front page is /hottest, which is also reachable as the bare root,
      // but the .json variant requires the explicit /hottest segment.
      return `${BASE}/hottest${pageSegment}.json`;
  }
}

function unwrapAuthor(s: LobstersStory): string {
  const u = s.submitter_user;
  if (!u) return "anonymous";
  if (typeof u === "string") return u;
  return u.username ?? "anonymous";
}

function mapStory(s: LobstersStory): FeedItem<LobstersMeta> | null {
  // Schema-drift safe — without an id or a comments URL there's nothing to
  // render or link to, so drop rather than emit a dead row.
  if (!s.short_id || !s.title) return null;

  const author = unwrapAuthor(s);
  const commentsUrl =
    s.comments_url ?? s.short_id_url ?? `${BASE}/s/${s.short_id}`;
  const externalUrl = s.url || undefined;
  const createdMs = s.created_at ? Date.parse(s.created_at) : Date.now();

  const description =
    s.description_plain?.trim() ||
    (s.description ? stripHtml(s.description) : "");

  const content = description ? `${s.title}\n\n${description}` : s.title;

  return {
    id: s.short_id,
    author: {
      name: author,
      handle: author,
      avatarUrl: identiconUrl(author),
    },
    content,
    url: externalUrl ?? commentsUrl,
    createdAt: new Date(createdMs).toISOString(),
    meta: {
      score: s.score ?? 0,
      comments: s.comment_count ?? 0,
      commentsUrl,
      externalUrl,
      tags: Array.isArray(s.tags) ? s.tags : [],
    },
  };
}

export async function fetchLobstersPage(
  mode: LobstersMode,
  tag: string,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<LobstersMeta>[]; hasMore: boolean }> {
  const url = endpointFor(mode, tag, page);
  const res = await fetchUpstream(url, {
    headers: {
      accept: "application/json",
      // Lobsters' admins ask scrapers to identify themselves; minitor is a
      // dashboard polling at user-driven cadence so a recognisable UA helps
      // them rate-limit cooperatively if needed.
      "user-agent": "minitor/1.0 (+https://github.com/aeonfun/minitor)",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Lobsters ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as LobstersStory[];
  if (!Array.isArray(json)) {
    return { items: [], hasMore: false };
  }
  const mapped = json
    .map(mapStory)
    .filter((s): s is FeedItem<LobstersMeta> => s !== null);
  // Lobsters serves 25 stories per page on a full page — fewer means we've
  // reached the tail. Clamp the visible slice to `limit` independently of
  // whether the underlying response was full, so paging is determined by
  // upstream page size, not the post-filter slice.
  const hasMore = json.length >= 25;
  return { items: mapped.slice(0, limit), hasMore };
}
