import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import { identiconUrl } from "@/lib/utils";
import { decodeEntities, stripHtml } from "@/lib/integrations/text";

// Reddit's JSON API (`/r/<sub>/<sort>.json`, `/search.json`) now returns HTTP
// 403 with an HTML anti-bot page to unauthenticated clients from most IPs —
// datacenter and residential alike. Reddit's Atom feeds (`/.rss`) are still
// served keyless to a descriptive User-Agent, so we read those instead.
//
// The trade-off vs. the old JSON path: the feed carries no score / comment
// count and no `after` cursor, so the card omits engagement stats and each
// column shows a single feed page (~25 items) instead of paginating.
// Everything else — title, author, permalink, outbound link, timestamp —
// comes through.
const UA = "minitor/0.1 (https://github.com/anthropics/claude-code dashboard)";
const ACCEPT = "application/atom+xml, application/xml;q=0.9, */*;q=0.8";

const SORTS = new Set(["hot", "new", "top", "rising"]);

// --- tiny Atom helpers (regex, matching the lib/integrations/rss.ts style) ---

function getTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  return xml.match(re)?.[1] ?? "";
}

// The first `<link>` in an entry with no `rel` (or rel="alternate") is the
// submission's permalink (the Reddit comments page).
function permalinkOf(entry: string): string {
  const re = /<link\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(entry))) {
    const href = m[1].match(/\bhref=["']([^"']+)["']/)?.[1];
    const rel = m[1].match(/\brel=["']([^"']+)["']/)?.[1];
    if (href && (!rel || rel === "alternate")) return href;
  }
  return "";
}

// Each entry body embeds `<a href="…">[link]</a>` (the submission's outbound
// URL) alongside `<a href="…/comments/…">[comments]</a>`. Pull the `[link]`
// href to use as the item URL when the entry has no permalink.
function outboundLink(contentHtml: string): string | undefined {
  const html = decodeEntities(contentHtml);
  return html.match(/href=["']([^"']+)["'][^>]*>\s*\[link\]/i)?.[1];
}

function parseRedditFeed(xml: string, fallbackSub: string): FeedItem[] {
  const items: FeedItem[] = [];
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml))) {
    const entry = m[1];
    const id = getTag(entry, "id").trim().replace(/^t3_/, "") || permalinkOf(entry);
    const title = decodeEntities(stripHtml(getTag(entry, "title"))).trim();
    const permalink = permalinkOf(entry);
    const author =
      stripHtml(getTag(getTag(entry, "author"), "name")).replace(/^\/u\//, "").trim() ||
      "unknown";
    const subreddit =
      entry.match(/<category\b[^>]*\bterm=["']([^"']+)["']/i)?.[1] || fallbackSub;
    const published = getTag(entry, "published") || getTag(entry, "updated");
    const outbound = outboundLink(getTag(entry, "content"));

    items.push({
      id,
      author: { name: author, handle: author, avatarUrl: identiconUrl(author) },
      content: title,
      url: permalink || outbound,
      createdAt: new Date(published || Date.now()).toISOString(),
      meta: {
        subreddit,
      },
    });
  }
  return items;
}

export async function fetchSubredditPage(
  subreddit: string,
  sortBy: string,
  limit = 12,
  after?: string,
): Promise<{ items: FeedItem[]; nextAfter?: string }> {
  // The Atom feed is a single fixed page with no cursor, so a "load more"
  // (non-empty `after`) has nothing further to return.
  if (after) return { items: [], nextAfter: undefined };

  const sub = subreddit.trim().replace(/^r\//, "") || "popular";
  const sort = SORTS.has(sortBy) ? sortBy : "hot";
  const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/${sort}/.rss?limit=${limit}`;

  const res = await fetchUpstream(url, {
    headers: { "user-agent": UA, accept: ACCEPT },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Reddit ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const items = parseRedditFeed(await res.text(), sub).slice(0, limit);
  return { items, nextAfter: undefined };
}

export async function searchReddit(
  query: string,
  limit = 12,
): Promise<FeedItem[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(q)}&sort=new&limit=${limit}`;
  const res = await fetchUpstream(url, {
    headers: { "user-agent": UA, accept: ACCEPT },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Reddit ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return parseRedditFeed(await res.text(), "all").slice(0, limit);
}
