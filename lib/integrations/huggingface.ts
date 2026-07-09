import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import type { HuggingfaceMeta } from "@/lib/columns/plugins/huggingface/plugin";
import { identiconUrl } from "@/lib/utils";

// `HuggingfaceMeta` is the renderer contract owned by the huggingface plugin;
// the fetcher here produces `FeedItem<HuggingfaceMeta>` so its meta lines up
// with what the huggingface renderer reads. Re-exported so call sites that grab
// HuggingfaceMeta from the integration keep working.
export type { HuggingfaceMeta };

// Hugging Face Hub REST API — public, no auth, generous rate limits for
// anonymous list endpoints. https://huggingface.co/docs/hub/api
//
// We hit /api/{models,datasets,spaces} with a sort key (trendingScore, likes,
// or createdAt) and an optional `search` substring filter. Each list response
// is a JSON array of repo objects whose shape varies by resource type — only
// `id`, `_id`, `tags`, `likes`, and `createdAt` are guaranteed across all
// three. The mapper handles the type-specific extras (downloads, pipeline_tag,
// sdk, etc.) and falls back gracefully when a field is missing.
const BASE = "https://huggingface.co";
const FETCH_BATCH = 50; // upstream cap is 1000, but 50 is plenty for slice-pagination.

export type HuggingfaceResource = "models" | "datasets" | "spaces";
export type HuggingfaceMode = "trending" | "most-likes" | "newest";

interface HFRepo {
  _id?: string;
  id?: string;
  modelId?: string;
  author?: string;
  likes?: number;
  downloads?: number;
  trendingScore?: number;
  private?: boolean;
  gated?: boolean | string;
  tags?: string[];
  pipeline_tag?: string;
  library_name?: string;
  sdk?: string;
  description?: string;
  createdAt?: string;
  lastModified?: string;
}

interface HFErrorResponse {
  error?: string;
}

function sortFor(mode: HuggingfaceMode): string {
  switch (mode) {
    case "most-likes":
      return "likes";
    case "newest":
      return "createdAt";
    case "trending":
    default:
      return "trendingScore";
  }
}

function permalinkFor(resource: HuggingfaceResource, id: string): string {
  // Models live at huggingface.co/{id}; datasets and spaces have a path
  // prefix. The id is always "owner/name" (or just "name" for legacy single-
  // segment ids), and HF normalises the URL form on its side.
  const slug = id.replace(/^\/+/, "");
  switch (resource) {
    case "datasets":
      return `${BASE}/datasets/${slug}`;
    case "spaces":
      return `${BASE}/spaces/${slug}`;
    case "models":
    default:
      return `${BASE}/${slug}`;
  }
}

function deriveAuthor(repo: HFRepo): { author: string; name: string } {
  // HF list responses for models omit `author` but pack it into `id` as
  // "owner/name". Datasets include `author` explicitly. Spaces omit it. Treat
  // `id` as the source of truth and use `author` only as a confirming hint.
  const id = repo.id ?? repo.modelId ?? "";
  const slash = id.indexOf("/");
  if (slash > 0) {
    return { author: id.slice(0, slash), name: id.slice(slash + 1) };
  }
  // Legacy single-segment ids (rare, mostly old community models): the id is
  // the model name and the org is the implicit "huggingface" namespace.
  return { author: repo.author ?? "huggingface", name: id || "(unknown)" };
}

function isGated(value: HFRepo["gated"]): boolean {
  // HF reports gating as either a boolean or a string ("auto", "manual").
  // Anything truthy means the repo requires acceptance before download.
  if (typeof value === "string") return value !== "" && value !== "false";
  return !!value;
}

function mapRepo(
  repo: HFRepo,
  resource: HuggingfaceResource,
): FeedItem<HuggingfaceMeta> | null {
  const id = repo.id ?? repo.modelId;
  if (!id) return null;

  const { author, name } = deriveAuthor(repo);
  const createdMs = repo.createdAt
    ? Date.parse(repo.createdAt)
    : repo.lastModified
      ? Date.parse(repo.lastModified)
      : Date.now();

  return {
    id,
    author: {
      name: author,
      handle: author,
      avatarUrl: identiconUrl(author),
    },
    // The "title" line of the card is "owner / name" so users can identify
    // the repo at a glance. Description, when present, lives one block down.
    content:
      author === "huggingface" || !author ? name : `${author} / ${name}`,
    url: permalinkFor(resource, id),
    createdAt: new Date(
      Number.isFinite(createdMs) ? createdMs : Date.now(),
    ).toISOString(),
    meta: {
      resource,
      likes: typeof repo.likes === "number" ? repo.likes : 0,
      downloads:
        typeof repo.downloads === "number" ? repo.downloads : undefined,
      trendingScore:
        typeof repo.trendingScore === "number"
          ? repo.trendingScore
          : undefined,
      pipelineTag: repo.pipeline_tag,
      libraryName: repo.library_name,
      sdk: repo.sdk,
      tags: Array.isArray(repo.tags) ? repo.tags : [],
      gated: isGated(repo.gated),
    },
  };
}

export async function fetchHuggingfacePage(
  resource: HuggingfaceResource,
  mode: HuggingfaceMode,
  search: string,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<HuggingfaceMeta>[]; hasMore: boolean }> {
  const params = new URLSearchParams({
    sort: sortFor(mode),
    direction: "-1",
    limit: String(FETCH_BATCH),
  });

  const trimmed = search.trim();
  if (trimmed) params.set("search", trimmed);

  const url = `${BASE}/api/${resource}?${params}`;
  const res = await fetchUpstream(url, {
    headers: {
      accept: "application/json",
      "user-agent": "minitor/1.0 (+https://github.com/aaronjmars/minitor)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "";
    try {
      const err = (await res.json()) as HFErrorResponse;
      detail = err.error ?? "";
    } catch {
      detail = (await res.text()).slice(0, 200);
    }
    throw new Error(`Hugging Face ${res.status}: ${detail}`);
  }

  const json = (await res.json()) as HFRepo[];
  if (!Array.isArray(json)) return { items: [], hasMore: false };

  const mapped = json
    .map((r) => mapRepo(r, resource))
    .filter((r): r is FeedItem<HuggingfaceMeta> => r !== null);

  // Slice-based pagination — the integration fetches a generous batch up
  // front, then hands out `limit` items per call. The trade-off (refetch on
  // every Load-more) keeps the contract stateless, matching the lobsters /
  // stack-overflow pattern. Cursor-based pagination via the upstream Link
  // header is available but not worth the complexity for this volume.
  const start = Math.max(page, 0) * limit;
  const slice = mapped.slice(start, start + limit);
  const hasMore = mapped.length > start + limit;
  return { items: slice, hasMore };
}
