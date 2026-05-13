import type { FeedItem } from "@/lib/columns/types";

// PyPI exposes three keyless surfaces this column draws from:
//
//   - https://pypi.org/rss/updates.xml
//       RSS 2.0 feed of the ~40 most-recent package updates. Each item
//       carries title (`{name} {version}`), description (summary line),
//       author (PyPI user), link (project page), pubDate. Used for the
//       `updates` mode.
//
//   - https://pypi.org/rss/packages.xml
//       RSS 2.0 feed of the ~40 most-recently registered packages.
//       Same shape as updates, but title is `{name}` (no version yet).
//       Used for the `new-packages` mode.
//
//   - https://hugovk.github.io/top-pypi-packages/top-pypi-packages-30-days.min.json
//       Community-maintained mirror of the BigQuery-backed PyPI download
//       stats. JSON shape: `{ last_update, query, rows: [{project,
//       download_count}, ...] }`. Updated daily; the top 8000 packages
//       are kept. Used for the `top-30d` mode — the only "trending"
//       surface PyPI itself doesn't expose.
//
//   - https://pypistats.org/api/packages/{name}/recent
//       Keyless weekly/monthly download stats. Used for the weekly-
//       downloads badge on each row. Failures degrade silently to 0.
//
// PyPI's terms-of-use ask consumers to identify themselves with a
// descriptive User-Agent; we send `minitor/1.0 (+url)`.

const RSS_BASE = "https://pypi.org/rss";
const TOP_PACKAGES_URL =
  "https://hugovk.github.io/top-pypi-packages/top-pypi-packages-30-days.min.json";
const STATS_BASE = "https://pypistats.org/api/packages";
const PYPI_PROJECT_BASE = "https://pypi.org/project";

const UA = "minitor/1.0 (+https://github.com/aaronjmars/minitor)";

export type PypiMode = "updates" | "new-packages" | "top-30d";

export interface PypiMeta {
  /** Version string when known (always for updates, never for new-packages). */
  version?: string;
  /** 30-day downloads when known (top-30d mode); 0 otherwise. */
  monthlyDownloads: number;
  /** Last-week downloads via pypistats.org; 0 on failure. */
  weeklyDownloads: number;
  /** PyPI author/maintainer login if surfaced by the feed. */
  author?: string;
}

interface RssItem {
  title: string;
  link: string;
  description: string;
  author: string;
  pubDate: string;
}

function stripCdata(s: string): string {
  return s.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/m, "$1").trim();
}

function decodeEntities(s: string): string {
  // RSS bodies are HTML-encoded; decode the entities we care about.
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");
}

function extractTag(block: string, tag: string): string {
  // PyPI's RSS is well-formed and unnested per tag — a single regex per tag
  // is enough. We accept either bare text or a CDATA-wrapped body.
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return decodeEntities(stripCdata(m[1]));
}

function parseRss(xml: string): RssItem[] {
  const out: RssItem[] = [];
  // Split on item boundaries — the RSS body wraps every entry in `<item>...</item>`.
  const blocks = xml.split(/<item>/i).slice(1);
  for (const raw of blocks) {
    const closeIdx = raw.indexOf("</item>");
    const block = closeIdx >= 0 ? raw.slice(0, closeIdx) : raw;
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    if (!title || !link) continue;
    out.push({
      title,
      link,
      description: extractTag(block, "description"),
      author: extractTag(block, "author"),
      pubDate: extractTag(block, "pubDate"),
    });
  }
  return out;
}

interface PypiStatsResponse {
  data?: { last_day?: number; last_week?: number; last_month?: number };
  package?: string;
  type?: string;
}

interface TopPackagesResponse {
  last_update?: string;
  query?: { from?: string; to?: string };
  rows?: Array<{ project?: string; download_count?: number }>;
}

async function fetchWeeklyDownloads(pkgName: string): Promise<number> {
  // Pypistats.org is a thin proxy over the BigQuery-backed `pypi-public`
  // dataset. Public, keyless, polite to call once per row. Failures
  // degrade silently to 0; the column still renders without the badge.
  const url = `${STATS_BASE}/${encodeURIComponent(pkgName.toLowerCase())}/recent?period=week`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const json = (await res.json()) as PypiStatsResponse;
    return Math.max(0, json.data?.last_week ?? 0);
  } catch {
    return 0;
  }
}

function permalinkFor(name: string): string {
  return `${PYPI_PROJECT_BASE}/${name.toLowerCase().replace(/^\/+/, "")}/`;
}

function parseUpdateTitle(title: string): { name: string; version?: string } {
  // The updates feed uses `{name} {version}` (whitespace separator). New-
  // packages feed uses just `{name}`. The package name itself can contain
  // hyphens and underscores but never spaces, so the first space splits
  // cleanly.
  const trimmed = title.trim();
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx < 0) return { name: trimmed };
  const name = trimmed.slice(0, spaceIdx);
  const version = trimmed.slice(spaceIdx + 1).trim();
  return { name, version: version || undefined };
}

function rssItemToFeedItem(
  item: RssItem,
  weeklyDownloads: number,
): FeedItem<PypiMeta> | null {
  const { name, version } = parseUpdateTitle(item.title);
  if (!name) return null;

  const summary = item.description.trim();
  const content = summary ? `${item.title}\n\n${summary}` : item.title;
  const created = item.pubDate
    ? new Date(item.pubDate).toISOString()
    : new Date().toISOString();
  const author = item.author.trim() || undefined;

  return {
    id: `${name.toLowerCase()}@${version ?? "new"}@${created}`,
    author: { name: author ?? name, handle: author },
    content,
    url: item.link || permalinkFor(name),
    createdAt: created,
    meta: {
      version,
      monthlyDownloads: 0,
      weeklyDownloads,
      author,
    },
  };
}

async function fetchRssMode(
  feed: "updates" | "packages",
  keyword: string,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<PypiMeta>[]; hasMore: boolean }> {
  const url = `${RSS_BASE}/${feed}.xml`;
  const res = await fetch(url, {
    headers: {
      accept: "application/rss+xml,application/xml;q=0.9,*/*;q=0.5",
      "user-agent": UA,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `PyPI ${feed} feed ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const xml = await res.text();
  const all = parseRss(xml);

  // Optional keyword filter — substring match on title OR description,
  // case-insensitive. Applied before pagination so the page count
  // reflects the filtered slice, not the raw feed.
  const kw = keyword.trim().toLowerCase();
  const filtered = kw
    ? all.filter((i) => {
        const hay = `${i.title} ${i.description}`.toLowerCase();
        return hay.includes(kw);
      })
    : all;

  // Page through the feed — RSS itself returns at most ~40, so pages
  // beyond the first are usually empty. We still honour the cursor so
  // the UI's "Load more" stays consistent across column types.
  const start = Math.max(page, 0) * limit;
  const slice = filtered.slice(start, start + limit);

  // Enrich each row with weekly downloads (parallel). Failures degrade
  // to 0; we don't drop a row for a missing stats response.
  const downloads = await Promise.all(
    slice.map((i) => {
      const { name } = parseUpdateTitle(i.title);
      return name ? fetchWeeklyDownloads(name) : Promise.resolve(0);
    }),
  );

  const items = slice
    .map((i, idx) => rssItemToFeedItem(i, downloads[idx] ?? 0))
    .filter((x): x is FeedItem<PypiMeta> => x !== null);

  return { items, hasMore: start + limit < filtered.length };
}

async function fetchTopMode(
  keyword: string,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<PypiMeta>[]; hasMore: boolean }> {
  // Top 8000 packages, ranked by 30-day downloads, updated daily by the
  // hugovk/top-pypi-packages mirror. Keyless, served via GitHub Pages.
  // The full JSON is ~250KB; cache aggressively via `cache: "force-cache"`
  // and rely on Next.js's HTTP cache to dedupe across columns/requests.
  const res = await fetch(TOP_PACKAGES_URL, {
    headers: { accept: "application/json", "user-agent": UA },
    cache: "force-cache",
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(
      `top-pypi-packages ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as TopPackagesResponse;
  const rows = Array.isArray(json.rows) ? json.rows : [];

  // Optional keyword filter — substring match on project name, case-
  // insensitive. Top-mode has no description, only names, so the filter
  // is name-only.
  const kw = keyword.trim().toLowerCase();
  const filtered = kw
    ? rows.filter((r) => (r.project ?? "").toLowerCase().includes(kw))
    : rows;

  const start = Math.max(page, 0) * limit;
  const slice = filtered.slice(start, start + limit);

  // Enrich with weekly downloads in parallel — the badge converts the
  // monthly number into a more digestible weekly figure that matches
  // the npm column's badge convention.
  const downloads = await Promise.all(
    slice.map((r) =>
      r.project ? fetchWeeklyDownloads(r.project) : Promise.resolve(0),
    ),
  );

  // Generate a synthetic createdAt from the mirror's last_update — every
  // row in this slice ranks against the same 30-day window, so they
  // share a timestamp. The renderer hides relative time when the value
  // is the mirror's mtime (rank-based feeds aren't time-ordered).
  const updatedAt = json.last_update
    ? new Date(json.last_update).toISOString()
    : new Date().toISOString();

  const items: FeedItem<PypiMeta>[] = slice
    .map((r, idx) => {
      const name = r.project?.trim();
      if (!name) return null;
      return {
        id: `${name.toLowerCase()}@top-30d`,
        author: { name },
        content: name,
        url: permalinkFor(name),
        createdAt: updatedAt,
        meta: {
          monthlyDownloads: Math.max(0, r.download_count ?? 0),
          weeklyDownloads: downloads[idx] ?? 0,
        },
      } satisfies FeedItem<PypiMeta>;
    })
    .filter((x): x is FeedItem<PypiMeta> => x !== null);

  return { items, hasMore: start + limit < filtered.length };
}

export async function fetchPypiPage(
  mode: PypiMode,
  keyword: string,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<PypiMeta>[]; hasMore: boolean }> {
  switch (mode) {
    case "new-packages":
      return fetchRssMode("packages", keyword, limit, page);
    case "top-30d":
      return fetchTopMode(keyword, limit, page);
    case "updates":
    default:
      return fetchRssMode("updates", keyword, limit, page);
  }
}
