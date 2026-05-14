import "server-only";

// Substack has no global, key-free search API (substack.com/api/v1/post/search
// exists but always returns empty results without auth). Per-publication RSS
// is stable and zero-dep — every Substack newsletter exposes <handle>.substack.com/feed.
// We fetch one feed per handle in parallel, optionally filter items by a
// keyword or URL, and merge them newest-first.
//
// When the user gives a query but no publications, fall back to xAI Grok
// web_search with a site:substack.com filter — same pattern as LinkedIn.

import type { FeedItem } from "@/lib/columns/types";
import type { SubstackMeta } from "@/lib/columns/plugins/substack/plugin";
import { fetchFeed } from "@/lib/integrations/rss";
import { grokWebSearch } from "@/lib/integrations/xai";
import { identiconUrl } from "@/lib/utils";

// `SubstackMeta` is the renderer contract (defined alongside the plugin so
// `ItemRendererProps<SubstackMeta>` types correctly). Re-exported here so
// integration consumers can grab it without reaching into the plugin folder.
export type { SubstackMeta };

export interface ParsedHandle {
  // Display label — bare handle for `.substack.com` subdomains, full host for
  // custom domains (e.g. `pluralistic.net`, `astralcodexten.com`).
  handle: string;
  // Canonical hostname used for the feed URL and for `publication` in meta.
  host: string;
  feedUrl: string;
}

export function parseHandles(input: string): ParsedHandle[] {
  const seen = new Set<string>();
  const out: ParsedHandle[] = [];
  for (const raw of input.split(/[\s,]+/)) {
    const piece = raw.trim();
    if (!piece) continue;
    const parsed = handleFromInput(piece);
    if (!parsed || seen.has(parsed.host)) continue;
    seen.add(parsed.host);
    out.push({ ...parsed, feedUrl: `https://${parsed.host}/feed` });
  }
  return out;
}

function handleFromInput(
  s: string,
): { handle: string; host: string } | null {
  const lower = s.toLowerCase();
  // Full URL or bare host on .substack.com → bare handle, canonical host.
  const subMatch = lower.match(
    /^(?:https?:\/\/)?([a-z0-9-]+)\.substack\.com\b/,
  );
  if (subMatch) {
    const handle = subMatch[1];
    return { handle, host: `${handle}.substack.com` };
  }
  // Custom domain — many popular Substacks (astralcodexten.com,
  // pluralistic.net, noahpinion.blog, every.to) live on their own
  // hostname. They still expose `/feed` so the same fetch path works.
  // Accept any URL or bare host with at least one dot in the body of the
  // hostname; strip a leading `www.` for canonicalisation.
  const urlMatch = lower.match(
    /^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[\/?#]|$)/,
  );
  if (urlMatch) {
    const host = urlMatch[1];
    // Defensive: reject `substack.com` bare (no publication) and anything
    // ending in a leading `.` from the regex.
    if (host === "substack.com" || host.startsWith(".")) return null;
    return { handle: host, host };
  }
  // Plain handle. Allow alphanumerics and hyphens; reject anything else.
  if (/^[a-z0-9][a-z0-9-]*$/.test(lower)) {
    return { handle: lower, host: `${lower}.substack.com` };
  }
  return null;
}

function looksLikeUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(t);
}

function normalizeUrlForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function matchesQuery(item: FeedItem, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (looksLikeUrl(q)) {
    const needle = normalizeUrlForMatch(q);
    const hay = (item.url ?? "").toLowerCase();
    return hay.includes(needle);
  }
  const needle = q.toLowerCase();
  return (
    item.content.toLowerCase().includes(needle) ||
    (item.url?.toLowerCase().includes(needle) ?? false)
  );
}

export async function searchSubstackPublications(
  handles: ParsedHandle[],
  query: string,
  perFeed = 20,
  totalLimit = 30,
): Promise<FeedItem<SubstackMeta>[]> {
  if (handles.length === 0) return [];

  const results = await Promise.allSettled(
    handles.map(async ({ host, feedUrl }) => {
      const items = await fetchFeed(feedUrl, perFeed);
      return items.map((item) => tagWithPublication(item, host, feedUrl));
    }),
  );

  const merged: FeedItem<SubstackMeta>[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") merged.push(...r.value);
  }

  const filtered = query.trim()
    ? merged.filter((it) => matchesQuery(it, query))
    : merged;

  filtered.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return filtered.slice(0, totalLimit);
}

function isSubstackUrl(u: string | undefined): boolean {
  if (!u) return false;
  try {
    const host = new URL(u).hostname.toLowerCase();
    return host === "substack.com" || host.endsWith(".substack.com");
  } catch {
    return false;
  }
}

function publicationFromUrl(u: string | undefined): string | null {
  if (!u) return null;
  try {
    const host = new URL(u).hostname.toLowerCase();
    if (host === "substack.com") return "substack.com";
    if (host.endsWith(".substack.com")) return host;
    return null;
  } catch {
    return null;
  }
}

export async function searchSubstackByKeyword(
  query: string,
  limit = 20,
): Promise<FeedItem<SubstackMeta>[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const isUrl = /^https?:\/\//i.test(trimmed);
  const term = isUrl ? `"${trimmed}"` : trimmed;
  const composed = `site:substack.com ${term}`;
  const items = await grokWebSearch(composed, limit * 2);
  const out: FeedItem<SubstackMeta>[] = [];
  for (const i of items) {
    const publication = publicationFromUrl(i.url);
    if (!publication || !isSubstackUrl(i.url)) continue;
    const feedTitle =
      typeof i.author?.name === "string" && i.author.name
        ? i.author.name
        : publication;
    out.push({
      ...i,
      meta: { publication, feedTitle, source: feedTitle },
    });
    if (out.length >= limit) break;
  }
  return out;
}

function tagWithPublication(
  item: FeedItem,
  host: string,
  feedUrl: string,
): FeedItem<SubstackMeta> {
  const publication = host;
  const prevMeta = item.meta as { source?: string; feedTitle?: string } | undefined;
  const feedTitle = prevMeta?.feedTitle ?? publication;
  const source = prevMeta?.source ?? feedTitle;
  return {
    ...item,
    // Prefix with publication to avoid id collisions across feeds.
    id: `${publication}#${item.id || item.url || feedUrl}`,
    author: {
      ...item.author,
      name: feedTitle,
      handle: publication,
      avatarUrl:
        item.author.avatarUrl ??
        identiconUrl(publication),
    },
    meta: { publication, feedTitle, source },
  };
}
