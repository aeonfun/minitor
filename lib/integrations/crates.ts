import type { FeedItem } from "@/lib/columns/types";

// crates.io public REST API — fully keyless, generously rate-limited for
// anonymous polling. One rule the docs are explicit about: every request
// MUST include a User-Agent header (crates.io returns 403 otherwise). The
// canonical browse endpoint we use is:
//
//   https://crates.io/api/v1/crates?sort={sort}&per_page=N&page=M
//
// Sort axes the API exposes:
//   - `recent-downloads` — 90d download count, the "trending right now"
//     surface (default; matches the crates.io homepage "Just Updated" tile).
//   - `downloads`        — all-time download count, the cumulative giants.
//   - `recent-updates`   — last `updated_at` desc, what's being maintained.
//   - `new`              — most recently published crates.
//   - `alpha`            — name asc, A→Z (deterministic; useful for fixtures).
//
// Optional query (`q=foo`) does a substring search across name + description
// + keywords. The `category` filter is also supported but we don't surface it
// in the column UI — crates.io's category taxonomy is loose enough that
// keyword search inside a query is the better discovery affordance.
const BASE = "https://crates.io/api/v1";

export type CratesSort =
  | "recent-downloads"
  | "downloads"
  | "recent-updates"
  | "new"
  | "alpha";

export interface CratesMeta {
  version: string;
  totalDownloads: number;
  recentDownloads: number;
  keywords: string[];
  description: string;
  homepage?: string;
  documentation?: string;
  repository?: string;
  updatedAt: string;
  exactMatch: boolean;
}

interface CratesApiCrate {
  id?: string;
  name?: string;
  updated_at?: string;
  created_at?: string;
  description?: string | null;
  homepage?: string | null;
  documentation?: string | null;
  repository?: string | null;
  max_version?: string;
  max_stable_version?: string | null;
  newest_version?: string;
  downloads?: number;
  recent_downloads?: number | null;
  exact_match?: boolean;
  keywords?: string[] | null;
}

interface CratesApiResponse {
  crates?: CratesApiCrate[];
  meta?: { total?: number; next_page?: string | null; prev_page?: string | null };
}

function permalinkFor(name: string): string {
  return `https://crates.io/crates/${encodeURIComponent(name)}`;
}

function endpointFor(
  query: string,
  sort: CratesSort,
  perPage: number,
  page: number,
): string {
  const params = new URLSearchParams();
  params.set("sort", sort);
  // crates.io caps per_page at 100; clamp defensively so a misconfigured
  // upstream caller can't request a 10k-row response.
  params.set("per_page", String(Math.min(Math.max(perPage, 1), 100)));
  // The API uses 1-based pagination.
  params.set("page", String(Math.max(page, 0) + 1));
  const q = query.trim();
  if (q) params.set("q", q);
  return `${BASE}/crates?${params}`;
}

function authorFor(crate: CratesApiCrate): {
  name: string;
  handle: string;
} {
  // The /crates list endpoint doesn't include owners; that needs a follow-up
  // /crates/{name}/owners call per row, which would 50x the request count
  // for marginal UI value (most rows show owner in the linked crates.io
  // page). We surface the crate slug as the handle — it's the stable id and
  // disambiguates rows when names collide across paginated batches.
  const slug = crate.name?.trim() || crate.id?.trim() || "crate";
  return { name: slug, handle: slug };
}

function mapCrate(c: CratesApiCrate): FeedItem<CratesMeta> | null {
  // Schema-drift safe: name + version are the minimum to render a useful row.
  // A crate with no version is unrenderable (no "what to cargo add"), drop it.
  const name = c.name?.trim();
  const version = (c.max_stable_version || c.max_version || c.newest_version || "").trim();
  if (!name || !version) return null;

  const description = (c.description ?? "").trim();
  const content = description ? `${name}\n\n${description}` : name;
  // `updated_at` is the most recent version-publish timestamp; we prefer it
  // over `created_at` so the relative-time pill reflects activity, not crate
  // age (a 2018 crate that shipped this morning should read "1h ago", not
  // "7 years ago").
  const createdMs = c.updated_at ? Date.parse(c.updated_at) : Date.now();

  return {
    id: name,
    author: authorFor(c),
    content,
    url: permalinkFor(name),
    createdAt: new Date(Number.isFinite(createdMs) ? createdMs : Date.now()).toISOString(),
    meta: {
      version,
      totalDownloads: Math.max(0, c.downloads ?? 0),
      recentDownloads: Math.max(0, c.recent_downloads ?? 0),
      keywords: Array.from(
        new Set((c.keywords ?? []).map((k) => k.trim()).filter(Boolean)),
      ).slice(0, 8),
      description,
      homepage: c.homepage ?? undefined,
      documentation: c.documentation ?? undefined,
      repository: c.repository ?? undefined,
      updatedAt: c.updated_at ?? "",
      exactMatch: c.exact_match === true,
    },
  };
}

export async function fetchCratesPage(
  query: string,
  sort: CratesSort,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<CratesMeta>[]; hasMore: boolean }> {
  const perPage = Math.max(limit, 30);
  const url = endpointFor(query, sort, perPage, page);

  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      // crates.io's User-Agent policy is strict — anonymous requests without
      // a UA get 403. Identifying minitor as the caller keeps us in
      // compliance with the documented expectation.
      "user-agent": "minitor/1.0 (+https://github.com/aaronjmars/minitor)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `crates.io ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as CratesApiResponse;
  const crates = Array.isArray(json.crates) ? json.crates : [];
  if (crates.length === 0) {
    return { items: [], hasMore: false };
  }

  const mapped = crates
    .map((c) => mapCrate(c))
    .filter((a): a is FeedItem<CratesMeta> => a !== null);

  // The API exposes `meta.next_page` — when null/empty, the cursor is
  // exhausted. We fall back to a length-based check for hasMore when the
  // upstream omits the field (older deployments, mirrors, etc.).
  const apiHasMore = typeof json.meta?.next_page === "string" && json.meta.next_page.length > 0;
  const hasMore = apiHasMore || crates.length >= perPage;
  return { items: mapped.slice(0, limit), hasMore };
}
