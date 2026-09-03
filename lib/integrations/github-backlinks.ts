import type { FeedItem } from "@/lib/columns/types";
import type {
  BacklinkSource,
  BacklinksConfig as PluginBacklinksConfig,
} from "@/lib/columns/plugins/github-backlinks/plugin";
import { fetchGitHub } from "@/lib/integrations/github";
import { fetchHackerNews } from "@/lib/integrations/hackernews";
import { searchReddit } from "@/lib/integrations/reddit";
import { fetchFeed, googleNewsUrl } from "@/lib/integrations/rss";

// `BacklinkSource` is the renderer contract (used by the plugin's
// SOURCE_LABEL / SOURCE_BG maps). Re-export so the integration stays its
// own importable surface for callers that don't reach into the plugin.
export type { BacklinkSource };

// The integration accepts a superset of the plugin's config — the plugin
// schema doesn't expose `limitPerSource`, but the underlying fetcher does.
export interface BacklinksConfig extends PluginBacklinksConfig {
  limitPerSource?: number;
}

export interface NormalizedRepo {
  ownerRepo: string;
  canonicalUrl: string;
}

export function normalizeRepo(input: string): NormalizedRepo {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Repo is required (owner/repo or full URL).");
  const stripped = trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(stripped)) {
    throw new Error(
      `Invalid repo "${input}". Use owner/repo (e.g. vercel/next.js) or https://github.com/owner/repo.`,
    );
  }
  return {
    ownerRepo: stripped,
    canonicalUrl: `https://github.com/${stripped}`,
  };
}

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
]);

function canonicalize(url: string): string {
  try {
    const u = new URL(url);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const p of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(p.toLowerCase())) u.searchParams.delete(p);
    }
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return url;
  }
}

function tag(items: FeedItem[], source: BacklinkSource, canonicalUrl: string): FeedItem[] {
  return items.map((it) => ({
    ...it,
    id: `${source}-${it.id}`,
    meta: { ...(it.meta ?? {}), source, canonicalUrl },
  }));
}

export async function fetchBacklinks(config: BacklinksConfig): Promise<FeedItem[]> {
  const { ownerRepo, canonicalUrl } = normalizeRepo(config.repo);
  const limit = config.limitPerSource ?? 8;

  const tasks: Promise<FeedItem[]>[] = [];

  // Algolia indexes HN submissions by URL — full URL query matches against the url field.
  tasks.push(
    fetchHackerNews("query", canonicalUrl, limit).then((items) => tag(items, "hn", canonicalUrl)),
  );

  // Reddit search — returns posts whose body or link URL matches.
  tasks.push(searchReddit(canonicalUrl, limit).then((items) => tag(items, "reddit", canonicalUrl)));

  // Google News + Bing News scoped to canonical URL OR owner/repo phrase.
  const newsQuery = `"${canonicalUrl}" OR "${ownerRepo}"`;
  tasks.push(
    fetchFeed(googleNewsUrl(newsQuery), limit).then((items) =>
      tag(items, "google-news", canonicalUrl),
    ),
  );
  const bingUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(newsQuery)}&format=rss`;
  tasks.push(fetchFeed(bingUrl, limit).then((items) => tag(items, "bing-news", canonicalUrl)));

  // GitHub issues/PRs across the rest of GitHub that mention this repo URL.
  // -repo:owner/name strips out the repo's own self-references.
  if (config.includeIssues ?? true) {
    const ghQuery = `${canonicalUrl} -repo:${ownerRepo}`;
    tasks.push(
      fetchGitHub("issues", { query: ghQuery }, limit).then((items) =>
        tag(items, "github", canonicalUrl),
      ),
    );
  }

  const settled = await Promise.allSettled(tasks);
  const errors: string[] = [];
  const all: FeedItem[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      all.push(...r.value);
    } else {
      errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
    }
  }

  if (all.length === 0 && errors.length > 0) {
    throw new Error(`All sources failed:\n${errors.join("\n")}`);
  }

  const seen = new Set<string>();
  const deduped: FeedItem[] = [];
  for (const it of all) {
    const key = canonicalize(it.url ?? it.id);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }

  deduped.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return deduped.slice(0, limit * 2);
}
