import type { FeedItem } from "@/lib/columns/types";
import type { NpmMeta } from "@/lib/columns/plugins/npm/plugin";

// `NpmMeta` is the renderer contract owned by the npm plugin; the fetcher here
// produces `FeedItem<NpmMeta>` so its meta lines up with what the npm renderer
// reads. Re-exported so call sites that grab NpmMeta from the integration keep
// working.
export type { NpmMeta };

// npm public registry + downloads API — both keyless, both rate-limited
// generously enough for anonymous polling. The two surfaces:
//   - https://registry.npmjs.org/-/v1/search?text=...&size=N
//       Returns ranked package metadata (name, version, description,
//       maintainers, keywords, links, scoreDetail). Used for discovery.
//   - https://api.npmjs.org/downloads/point/last-week/{package}
//       Returns { downloads, start, end, package }. Used for the
//       weekly-downloads badge on each row.
//
// The search endpoint exposes a ranking model where the final `score`
// is a weighted blend of quality / popularity / maintenance. The
// weights are tunable via `quality=`, `popularity=`, `maintenance=`
// query params (they must sum to 1.0 — if not, npm normalises silently).
// "trending" in the column UI maps to popularity-weighted; "quality"
// maps to quality-weighted; "maintenance" maps to maintenance-weighted;
// "combined" uses the default balanced weights.
const REGISTRY_BASE = "https://registry.npmjs.org";
const DOWNLOADS_BASE = "https://api.npmjs.org";

export type NpmMode = "popularity" | "quality" | "maintenance" | "combined";

interface NpmSearchObject {
  package: {
    name?: string;
    scope?: string;
    version?: string;
    description?: string;
    keywords?: string[];
    date?: string;
    links?: {
      npm?: string;
      homepage?: string;
      repository?: string;
      bugs?: string;
    };
    publisher?: { username?: string; email?: string };
    maintainers?: Array<{ username?: string; email?: string }>;
  };
  score?: {
    final?: number;
    detail?: {
      quality?: number;
      popularity?: number;
      maintenance?: number;
    };
  };
  searchScore?: number;
  flags?: {
    insecure?: number;
    unstable?: boolean;
    deprecated?: string;
  };
}

interface NpmSearchResponse {
  objects?: NpmSearchObject[];
  total?: number;
  time?: string;
}

interface NpmDownloadsResponse {
  downloads?: number;
  start?: string;
  end?: string;
  package?: string;
  error?: string;
}

function weightsFor(mode: NpmMode): {
  quality: string;
  popularity: string;
  maintenance: string;
} {
  // The npm search API requires the three weights to sum to ~1.0. Heavy-
  // weight the chosen axis to 0.8 and split the remaining 0.2 evenly across
  // the other two so the resulting ranking is dominated by the intent of
  // the column without zeroing the other signals (a zeroed axis lets one-
  // off zombie packages rank highly on the heavy axis).
  switch (mode) {
    case "quality":
      return { quality: "0.8", popularity: "0.1", maintenance: "0.1" };
    case "maintenance":
      return { quality: "0.1", popularity: "0.1", maintenance: "0.8" };
    case "popularity":
      return { quality: "0.1", popularity: "0.8", maintenance: "0.1" };
    case "combined":
    default:
      // Defaults documented at registry.npmjs.org/-/v1/search — quality 0.65,
      // popularity 0.98, maintenance 0.5 — which the API renormalises. We
      // pass them explicitly so the ranking is reproducible across npm's
      // own weight tweaks.
      return { quality: "0.65", popularity: "0.98", maintenance: "0.5" };
  }
}

function endpointFor(
  query: string,
  mode: NpmMode,
  perPage: number,
  page: number,
): string {
  const params = new URLSearchParams();
  // npm's search endpoint requires a non-empty `text=` query — there is no
  // "list all packages" mode. We default the query upstream so the caller
  // doesn't have to think about it.
  params.set("text", query.trim() || "javascript");
  params.set("size", String(Math.min(Math.max(perPage, 1), 250)));
  params.set("from", String(Math.max(page, 0) * perPage));
  const w = weightsFor(mode);
  params.set("quality", w.quality);
  params.set("popularity", w.popularity);
  params.set("maintenance", w.maintenance);
  return `${REGISTRY_BASE}/-/v1/search?${params}`;
}

function permalinkFor(name: string): string {
  return `https://www.npmjs.com/package/${name.replace(/^\/+/, "")}`;
}

function authorOf(obj: NpmSearchObject): {
  name: string;
  handle: string;
  avatarUrl?: string;
} {
  // npm exposes `publisher` (the account that pushed the last version) and
  // `maintainers` (the full ACL list). The publisher is the right "author"
  // for a feed row — it's whose action produced the version on this page.
  const publisher = obj.package?.publisher;
  const handle = publisher?.username?.trim() || "anonymous";
  const name = handle;
  // npm exposes gravatar URLs by hashing the publisher email, but the email
  // field is sometimes withheld. The handle alone is enough — the renderer
  // builds an identicon fallback when avatarUrl is undefined.
  return { name, handle };
}

async function fetchWeeklyDownloads(pkgName: string): Promise<number> {
  // The downloads endpoint accepts the URL-encoded package name. Scoped
  // packages (`@scope/name`) need the `/` left raw — encodeURIComponent
  // turns `/` into `%2F`, which the downloads API rejects with a 404.
  const url = `${DOWNLOADS_BASE}/downloads/point/last-week/${pkgName}`;
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "minitor/1.0 (+https://github.com/aaronjmars/minitor)",
      },
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const json = (await res.json()) as NpmDownloadsResponse;
    if (json.error) return 0;
    return Math.max(0, json.downloads ?? 0);
  } catch {
    // Network / parse failures degrade silently to 0 — the row still renders
    // with the rest of the metadata; missing a download count is not a
    // reason to drop the package from the feed.
    return 0;
  }
}

function mapObject(
  obj: NpmSearchObject,
  weeklyDownloads: number,
): FeedItem<NpmMeta> | null {
  const pkg = obj.package;
  // Schema-drift safe: a search result without a name, version, or registry
  // link is unrenderable, drop it rather than emit a dead row.
  if (!pkg?.name || !pkg.version) return null;

  const detail = obj.score?.detail ?? {};
  const description = pkg.description?.trim() || "";
  const content = description ? `${pkg.name}\n\n${description}` : pkg.name;
  const createdMs = pkg.date ? Date.parse(pkg.date) : Date.now();

  return {
    id: pkg.name,
    author: authorOf(obj),
    content,
    url: pkg.links?.npm || permalinkFor(pkg.name),
    createdAt: new Date(createdMs).toISOString(),
    meta: {
      version: pkg.version,
      weeklyDownloads,
      keywords: Array.from(
        new Set((pkg.keywords ?? []).map((k) => k.trim()).filter(Boolean)),
      ).slice(0, 8),
      score: obj.score?.final ?? 0,
      scoreDetail: {
        quality: detail.quality ?? 0,
        popularity: detail.popularity ?? 0,
        maintenance: detail.maintenance ?? 0,
      },
      publisher: pkg.publisher
        ? {
            username: pkg.publisher.username,
            email: pkg.publisher.email,
          }
        : undefined,
      homepage: pkg.links?.homepage,
      repository: pkg.links?.repository,
      license: undefined,
      deprecated: typeof obj.flags?.deprecated === "string",
    },
  };
}

export async function fetchNpmPage(
  query: string,
  mode: NpmMode,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<NpmMeta>[]; hasMore: boolean }> {
  const perPage = Math.max(limit, 30);
  const url = endpointFor(query, mode, perPage, page);
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "minitor/1.0 (+https://github.com/aaronjmars/minitor)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `npm registry ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as NpmSearchResponse;
  const objects = Array.isArray(json.objects) ? json.objects : [];
  if (objects.length === 0) {
    return { items: [], hasMore: false };
  }

  // Resolve weekly downloads in parallel. A 30-item page = 30 cheap GET
  // requests — npm's downloads API is fine with that cadence per IP and
  // the failures degrade to `0` rather than failing the page.
  const downloads = await Promise.all(
    objects.map((o) =>
      o.package?.name ? fetchWeeklyDownloads(o.package.name) : Promise.resolve(0),
    ),
  );

  const mapped = objects
    .map((obj, i) => mapObject(obj, downloads[i] ?? 0))
    .filter((a): a is FeedItem<NpmMeta> => a !== null);

  // The search endpoint returns `total` so we know whether more pages exist
  // upstream, but `hasMore` also needs to be true when we trimmed the local
  // batch. Compare raw count to the requested perPage instead of total —
  // some queries return fewer than `total` due to ranking filtering.
  const hasMore = objects.length >= perPage;
  return { items: mapped.slice(0, limit), hasMore };
}
