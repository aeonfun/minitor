import type { FeedItem } from "@/lib/columns/types";
import type { DevtoMeta } from "@/lib/columns/plugins/devto/plugin";

// `DevtoMeta` is the renderer contract owned by the devto plugin; the fetcher
// here produces `FeedItem<DevtoMeta>` so its meta lines up with what the devto
// renderer reads. Re-exported so call sites that grab DevtoMeta from the
// integration keep working.
export type { DevtoMeta };

// DEV.to public REST API — keyless for read endpoints.
// https://developers.forem.com/api/v1#tag/articles
//
// /api/articles is the main feed; query params shape the slice:
//   - top=N            most-reacted in the last N days (1, 7, 30, 365…)
//   - tag=slug         single-tag filter (combine with top= for "best of week
//                      in `ai`")
//   - tags=slug,slug2  comma-separated AND across tags
//   - per_page=30      page size, max 1000
//   - page=N           1-indexed pagination
//   - state=fresh      relaxed sort: ranks recent posts above raw reactions
//
// Anonymous reads aren't rate-limited per docs (Forem self-hosting routes the
// same endpoint, so cadence is on the Forem hosts, not the API consumer).
const BASE = "https://dev.to/api";

export type DevtoMode = "top" | "latest" | "rising";

interface DevtoUser {
  name?: string;
  username?: string;
  twitter_username?: string | null;
  github_username?: string | null;
  website_url?: string | null;
  profile_image?: string;
  profile_image_90?: string;
}

interface DevtoOrganization {
  name?: string;
  username?: string;
  slug?: string;
  profile_image?: string;
}

interface DevtoArticle {
  id?: number;
  type_of?: string;
  title?: string;
  description?: string;
  url?: string;
  canonical_url?: string;
  cover_image?: string | null;
  social_image?: string;
  reading_time_minutes?: number;
  published_at?: string;
  edited_at?: string | null;
  crossposted_at?: string | null;
  comments_count?: number;
  public_reactions_count?: number;
  positive_reactions_count?: number;
  tag_list?: string[] | string;
  tags?: string;
  user?: DevtoUser;
  organization?: DevtoOrganization;
}

function normaliseTagFilter(tag: string): string[] {
  // Accept commas / semicolons / spaces; lowercase, dedupe, clamp to 5 tags
  // (the API doesn't document a hard cap, but >5 narrows aggressively to no
  // results on most slices and makes the cache key explode).
  const parts = tag
    .split(/[,;\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p);
      uniq.push(p);
    }
    if (uniq.length === 5) break;
  }
  return uniq;
}

function endpointFor(
  mode: DevtoMode,
  tags: string[],
  perPage: number,
  page: number,
): string {
  const params = new URLSearchParams();
  params.set("per_page", String(Math.min(Math.max(perPage, 1), 100)));
  params.set("page", String(Math.max(page, 0) + 1));

  switch (mode) {
    case "top":
      // Reactions over the last 7 days. The DEV.to UI's "Top → Week" tab.
      params.set("top", "7");
      break;
    case "latest":
      // No `top=` param + state=fresh sorts by published_at desc.
      params.set("state", "fresh");
      break;
    case "rising":
      // Reactions in the last 24h — the "Top → Day" slice. Tighter than top
      // and biased toward posts still climbing rather than already viral.
      params.set("top", "1");
      break;
  }

  if (tags.length === 1) {
    params.set("tag", tags[0]);
  } else if (tags.length > 1) {
    // The API documents `tags` (plural) as a comma-separated AND filter.
    params.set("tags", tags.join(","));
  }

  return `${BASE}/articles?${params}`;
}

function tagListOf(a: DevtoArticle): string[] {
  // The API has shipped both `tag_list` (array) and `tags` (comma string) over
  // the years; some endpoints return one, some return both. Accept either,
  // normalise to a deduped array, drop empties.
  const fromList = Array.isArray(a.tag_list) ? a.tag_list : [];
  const fromString =
    typeof a.tag_list === "string"
      ? a.tag_list.split(",")
      : typeof a.tags === "string"
        ? a.tags.split(",")
        : [];
  const all = [...fromList, ...fromString]
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(all));
}

function authorOf(a: DevtoArticle): {
  name: string;
  handle: string;
  avatarUrl?: string;
} {
  const u = a.user;
  const handle = u?.username?.trim() || "anonymous";
  const name = u?.name?.trim() || handle;
  // profile_image_90 is the smaller variant; fall back to the larger profile_image
  // when the 90px one isn't returned. Both are absolute URLs on the dev.to CDN.
  const avatarUrl = u?.profile_image_90 || u?.profile_image;
  return { name, handle, avatarUrl };
}

function organizationOf(a: DevtoArticle): DevtoMeta["organization"] {
  const o = a.organization;
  if (!o) return undefined;
  const name = o.name?.trim();
  const slug = o.slug?.trim() || o.username?.trim();
  if (!name || !slug) return undefined;
  return { name, slug, avatarUrl: o.profile_image };
}

function mapArticle(a: DevtoArticle): FeedItem<DevtoMeta> | null {
  // Schema-drift safe: an article without an id, title, or url has nothing to
  // render or link to, so drop rather than emit a dead row.
  if (!a.id || !a.title || !a.url) return null;

  const author = authorOf(a);
  const reactions =
    a.public_reactions_count ?? a.positive_reactions_count ?? 0;
  const comments = a.comments_count ?? 0;
  const readingTimeMinutes = a.reading_time_minutes ?? 0;
  const tags = tagListOf(a);
  const createdMs = a.published_at ? Date.parse(a.published_at) : Date.now();
  const description = a.description?.trim() || "";
  const content = description ? `${a.title}\n\n${description}` : a.title;

  return {
    id: String(a.id),
    author,
    content,
    url: a.url,
    createdAt: new Date(createdMs).toISOString(),
    meta: {
      reactions,
      comments,
      readingTimeMinutes,
      tags,
      organization: organizationOf(a),
      coverImage: a.cover_image || a.social_image,
    },
  };
}

export async function fetchDevtoPage(
  mode: DevtoMode,
  tag: string,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<DevtoMeta>[]; hasMore: boolean }> {
  const tags = normaliseTagFilter(tag);
  const url = endpointFor(mode, tags, Math.max(limit, 30), page);
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "minitor/1.0 (+https://github.com/aaronjmars/minitor)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `DEV.to ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as DevtoArticle[] | { error?: string };
  if (!Array.isArray(json)) {
    // Some upstream errors come back as `{ error: "..." }` with a 200; treat
    // them as empty rather than throw, so the column renders an empty state
    // instead of a generic crash.
    return { items: [], hasMore: false };
  }

  const mapped = json
    .map(mapArticle)
    .filter((a): a is FeedItem<DevtoMeta> => a !== null);

  // The /articles endpoint returns `per_page` items on a full page; fewer
  // means we've hit the tail of the slice. Per_page is requested at >= limit
  // so the trim is independent of upstream page size.
  const hasMore = json.length >= Math.max(limit, 30);
  return { items: mapped.slice(0, limit), hasMore };
}
