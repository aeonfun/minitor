import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import { identiconUrl, truncateText } from "@/lib/utils";
import { decodeEntities } from "@/lib/integrations/text";

interface ParsedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author?: string;
  source?: string;
}

interface ParsedFeed {
  title: string;
  items: ParsedItem[];
}

// Meta emitted by `fetchFeed`. Owned here so feed-backed plugins (rss,
// google-news) alias it instead of redeclaring the shape.
export interface RssItemMeta {
  source: string;
  feedTitle?: string;
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)</${escaped}>`, "i");
  return xml.match(re)?.[1] ?? "";
}

function clean(raw: string, max = 600): string {
  // Order matters: CDATA-unwrap, then decode entities (which may turn `&lt;a&gt;`
  // back into real `<a>` tags — common in Google News descriptions), then strip.
  const out = stripTags(decodeEntities(stripCdata(raw))).trim();
  return truncateText(out, max);
}

function parseRss(xml: string): ParsedFeed {
  const channel = xml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i)?.[1] ?? xml;
  const feedTitle = clean(getTag(channel, "title"), 200);
  const items: ParsedItem[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const link = stripCdata(getTag(block, "link")).trim();
    const guid = stripCdata(getTag(block, "guid")).trim();
    const sourceBlock = block.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i)?.[1];
    items.push({
      id: guid || link,
      title: clean(getTag(block, "title"), 280),
      link,
      description: clean(
        getTag(block, "description") || getTag(block, "content:encoded"),
        600,
      ),
      pubDate:
        getTag(block, "pubDate") ||
        getTag(block, "dc:date") ||
        getTag(block, "published"),
      author: clean(
        getTag(block, "dc:creator") || getTag(block, "author"),
        100,
      ),
      source: sourceBlock ? clean(sourceBlock, 100) : undefined,
    });
  }
  return { title: feedTitle, items };
}

function parseAtom(xml: string): ParsedFeed {
  const headBlock = xml.slice(0, 4000);
  const feedTitle = clean(getTag(headBlock, "title"), 200);
  const items: ParsedItem[] = [];
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml))) {
    const block = m[1];
    let link = "";
    const linkRe = /<link\b([^>]*?)\/?>/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(block))) {
      const attrs = lm[1];
      const href = attrs.match(/\bhref=["']([^"']+)["']/)?.[1];
      const rel = attrs.match(/\brel=["']([^"']+)["']/)?.[1];
      if (href && (!rel || rel === "alternate")) {
        link = href;
        break;
      }
    }
    const authorBlock = getTag(block, "author");
    const author = authorBlock
      ? clean(getTag(authorBlock, "name") || authorBlock, 100)
      : "";
    items.push({
      id: stripCdata(getTag(block, "id")).trim() || link,
      title: clean(getTag(block, "title"), 280),
      link,
      description: clean(
        getTag(block, "summary") || getTag(block, "content"),
        600,
      ),
      pubDate: getTag(block, "updated") || getTag(block, "published"),
      author,
    });
  }
  return { title: feedTitle, items };
}

function parseFeed(xml: string): ParsedFeed {
  if (/<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom/i.test(xml)) {
    return parseAtom(xml);
  }
  return parseRss(xml);
}

function safeDate(s: string): string {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function unwrapGoogleRedirect(url: string): string {
  // Google News links sometimes look like https://news.google.com/articles/... — pass through.
  // Older /url?q= redirects:
  if (!/google\.com\/url\?/.test(url)) return url;
  try {
    const u = new URL(url);
    return u.searchParams.get("q") ?? u.searchParams.get("url") ?? url;
  } catch {
    return url;
  }
}

export async function fetchFeed(url: string, limit = 12): Promise<FeedItem[]> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("Feed URL is required.");

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid feed URL: ${trimmed}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https feed URLs are supported.");
  }

  const res = await fetchUpstream(parsed.toString(), {
    headers: {
      accept:
        "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5",
      "user-agent": "minitor/0.1 (+https://github.com/anthropics/claude-code)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Feed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const xml = await res.text();
  const feed = parseFeed(xml);
  const host = parsed.hostname.replace(/^www\./, "");

  return feed.items.slice(0, limit).map((it, idx) => {
    const link = unwrapGoogleRedirect(it.link || trimmed);
    const source = it.source || it.author || feed.title || host;
    return {
      id: it.id || `${link}#${idx}`,
      author: {
        name: source,
        handle: source,
        avatarUrl: identiconUrl(source),
      },
      content: it.description ? `${it.title}\n\n${it.description}` : it.title,
      url: link,
      createdAt: safeDate(it.pubDate),
      meta: {
        source,
        feedTitle: feed.title || host,
      },
    } satisfies FeedItem<RssItemMeta>;
  });
}

export function googleNewsUrl(
  query: string,
  hl?: string,
  gl?: string,
): string {
  const params = new URLSearchParams({ q: query.trim() });
  // Region/language are optional. When unset, Google News returns its
  // global default (mixed languages, IP-region-detected) — closer to an
  // "all languages / all countries" feed than any single hl/gl combo.
  if (hl && hl.trim()) {
    params.set("hl", hl);
    if (gl && gl.trim()) {
      params.set("gl", gl);
      params.set("ceid", `${gl}:${hl.split("-")[0]}`);
    }
  }
  return `https://news.google.com/rss/search?${params}`;
}
