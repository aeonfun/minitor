import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";

// Mastodon via the public REST API. Two keyless modes exposed:
//   - HASHTAG: GET /api/v1/timelines/tag/{tag}      — public timeline by tag
//   - AUTHOR:  GET /api/v1/accounts/lookup?acct=…   — federated handle lookup
//              + GET /api/v1/accounts/{id}/statuses — that account's posts
//
// Mastodon's full-text status search (/api/v2/search?type=statuses) requires
// authentication on every public instance and is intentionally NOT used here
// — keeping the column keyless is the whole point. Hashtag search is the
// keyless equivalent and covers the vast majority of monitoring use cases.
//
// Federation note: any public Mastodon instance exposes these endpoints. The
// `instance` config is the host the column queries directly. To monitor a
// user on a different server, set `instance` to *their* server (e.g. for
// @gargron@mastodon.social, instance="mastodon.social", handle="gargron"),
// or pass the fully-qualified `user@server` form and we'll route the lookup
// to that server transparently.

const DEFAULT_INSTANCE = "mastodon.social";
const HASHTAG_LIMIT = 30;
const AUTHOR_LIMIT = 30;

interface MastodonAccount {
  id?: string;
  username?: string;
  acct?: string;
  display_name?: string;
  avatar?: string;
  avatar_static?: string;
  url?: string;
  followers_count?: number;
  bot?: boolean;
}

interface MastodonStatus {
  id?: string;
  uri?: string;
  url?: string;
  account?: MastodonAccount;
  content?: string;
  created_at?: string;
  reblog?: MastodonStatus | null;
  reblogs_count?: number;
  favourites_count?: number;
  replies_count?: number;
  visibility?: string;
  spoiler_text?: string;
  language?: string;
}

function normalizeInstance(raw: string | undefined): string {
  const s = (raw ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return s || DEFAULT_INSTANCE;
}

function buildHeaders(): HeadersInit {
  return {
    accept: "application/json",
    "user-agent": "minitor/0.1",
  };
}

async function mastodonGet<T>(url: string): Promise<T> {
  const res = await fetchUpstream(url, { headers: buildHeaders(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Mastodon ${res.status} (${url}): ${body.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

// Strip Mastodon's HTML status content down to plain text. Mastodon returns
// `content` as a sanitized HTML fragment with <p>, <br>, <a>, <span> only —
// safe to text-strip without a full parser. Newlines come from <br> and </p>.
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, (_m, _href, text) =>
      String(text),
    )
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

function avatarUrl(account: MastodonAccount | undefined): string {
  const a = account?.avatar_static ?? account?.avatar;
  if (a) return a;
  const seed = account?.username ?? "mastodon";
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

function authorHandle(
  account: MastodonAccount | undefined,
  fallbackInstance: string,
): string {
  const acct = account?.acct ?? account?.username ?? "";
  if (!acct) return "unknown";
  // Local accounts return `acct: "user"`; remote accounts return
  // `acct: "user@server"`. Normalize local accounts so the rendered handle
  // includes the column's instance for unambiguous attribution.
  if (acct.includes("@")) return acct;
  return `${acct}@${fallbackInstance}`;
}

function statusUrl(s: MastodonStatus): string | undefined {
  // `url` is the canonical permalink (handles federation correctly); fall
  // back to `uri` (the ActivityPub object id) only when `url` is missing.
  return s.url ?? s.uri;
}

function statusToFeedItem(
  s: MastodonStatus,
  instance: string,
): FeedItem | null {
  // Skip boosts (reblogs) on author timelines — the column attribution would
  // otherwise be misleading ("by @actor" but content authored by someone
  // else). Hashtag timeline doesn't include reblogs by default, but keep the
  // guard anyway in case the upstream contract changes.
  if (s.reblog) return null;

  const id = s.id;
  const url = statusUrl(s);
  if (!id || !url) return null;

  const text = stripHtml(s.content ?? "").trim();
  if (!text) return null;

  const account = s.account;
  const handle = authorHandle(account, instance);
  const display = account?.display_name?.trim() || account?.username || handle;

  return {
    id,
    author: {
      name: display,
      handle,
      avatarUrl: avatarUrl(account),
    },
    content: s.spoiler_text
      ? `[CW: ${s.spoiler_text.trim()}] ${text}`
      : text,
    url,
    createdAt: s.created_at ?? new Date().toISOString(),
    meta: {
      favourites: s.favourites_count ?? 0,
      reblogs: s.reblogs_count ?? 0,
      replies: s.replies_count ?? 0,
      followers: account?.followers_count ?? 0,
      visibility: s.visibility ?? "public",
      bot: !!account?.bot,
      isMastodon: true,
    },
  };
}

function mapStatuses(
  statuses: MastodonStatus[],
  instance: string,
  limit: number,
): FeedItem[] {
  return statuses
    .map((s) => statusToFeedItem(s, instance))
    .filter((it): it is FeedItem => it !== null)
    .slice(0, limit);
}

export async function fetchMastodonHashtag(
  rawInstance: string,
  hashtag: string,
  limit = HASHTAG_LIMIT,
): Promise<FeedItem[]> {
  const tag = hashtag.trim().replace(/^#/, "");
  if (!tag) throw new Error("Hashtag is required.");
  const instance = normalizeInstance(rawInstance);
  const params = new URLSearchParams({
    limit: String(limit),
    only_media: "false",
  });
  const url = `https://${instance}/api/v1/timelines/tag/${encodeURIComponent(
    tag,
  )}?${params}`;
  const json = await mastodonGet<MastodonStatus[]>(url);
  return mapStatuses(json, instance, limit);
}

// Splits a handle into (server, localpart). Accepts:
//   "user"               → (configured instance, "user")
//   "@user"              → strip @, route via configured instance
//   "user@server"        → ("server", "user")  — federated lookup
//   "@user@server"       → strip leading @, ("server", "user")
function parseHandle(
  raw: string,
  configuredInstance: string,
): { server: string; localpart: string } {
  const trimmed = raw.trim().replace(/^@/, "");
  if (!trimmed) throw new Error("Handle is required.");
  const at = trimmed.indexOf("@");
  if (at === -1) {
    return { server: configuredInstance, localpart: trimmed };
  }
  return {
    server: normalizeInstance(trimmed.slice(at + 1)),
    localpart: trimmed.slice(0, at),
  };
}

export async function fetchMastodonAuthor(
  rawInstance: string,
  handle: string,
  limit = AUTHOR_LIMIT,
): Promise<FeedItem[]> {
  const configured = normalizeInstance(rawInstance);
  const { server, localpart } = parseHandle(handle, configured);

  // Look the account up on its own server — that's the only place /lookup
  // can resolve a local username without authentication on most instances.
  const acct = `${localpart}`;
  const lookupUrl = `https://${server}/api/v1/accounts/lookup?acct=${encodeURIComponent(
    acct,
  )}`;
  const account = await mastodonGet<MastodonAccount>(lookupUrl);
  if (!account.id) {
    throw new Error(`Couldn't resolve @${localpart} on ${server}.`);
  }

  const params = new URLSearchParams({
    limit: String(limit),
    exclude_replies: "true",
    exclude_reblogs: "true",
  });
  const statusesUrl = `https://${server}/api/v1/accounts/${encodeURIComponent(
    account.id,
  )}/statuses?${params}`;
  const statuses = await mastodonGet<MastodonStatus[]>(statusesUrl);
  return mapStatuses(statuses, server, limit);
}
