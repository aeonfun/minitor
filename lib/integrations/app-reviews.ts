import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";

// Single source of truth for App Store + Google Play review fetching. Two
// keyless paths today (Apple's iTunes RSS for App Store; the public
// batchexecute scrape for Google Play). Env-var-gated upgrade paths
// (APP_STORE_CONNECT_KEY for App Store Connect API, GOOGLE_PLAY_SA_JSON for
// Google Play Developer Reporting API) can drop in here without changing
// the plugin contract.

export type AppReviewPlatform = "app-store" | "google-play";

export interface AppReviewMeta {
  rating: number;
  version?: string;
  country: string;
  platform: AppReviewPlatform;
  title?: string;
  thumbsUp?: number;
}

const UA =
  "minitor/0.1 (+https://github.com/anthropics/claude-code)";

// App Store (iTunes RSS, keyless)

interface AppleEntryField {
  label?: string;
  attributes?: Record<string, string>;
}

interface AppleReviewEntry {
  id?: AppleEntryField;
  title?: AppleEntryField;
  content?: AppleEntryField;
  updated?: AppleEntryField;
  author?: { name?: AppleEntryField; uri?: AppleEntryField };
  link?: AppleEntryField | AppleEntryField[];
  "im:rating"?: AppleEntryField;
  "im:version"?: AppleEntryField;
  "im:voteSum"?: AppleEntryField;
}

interface AppleFeedResponse {
  feed?: {
    entry?: AppleReviewEntry | AppleReviewEntry[];
  };
}

function appleReviewLink(
  entry: AppleReviewEntry,
  appId: string,
  country: string,
): string {
  const link = Array.isArray(entry.link) ? entry.link[0] : entry.link;
  const href = link?.attributes?.href;
  if (href) return href;
  return `https://apps.apple.com/${country}/app/id${appId}`;
}

async function fetchAppStoreReviews(
  appId: string,
  country: string,
): Promise<FeedItem<AppReviewMeta>[]> {
  const url = `https://itunes.apple.com/${encodeURIComponent(country)}/rss/customerreviews/page=1/id=${encodeURIComponent(appId)}/sortby=mostrecent/json`;
  const res = await fetchUpstream(url, {
    headers: { accept: "application/json", "user-agent": UA },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `App Store RSS ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as AppleFeedResponse;
  const raw = json.feed?.entry;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return entries
    .filter((e): e is AppleReviewEntry => Boolean(e?.id?.label))
    .map((e) => {
      const id = e.id!.label!;
      const title = e.title?.label?.trim() ?? "";
      const body = e.content?.label?.trim() ?? "";
      const ratingNum = Number(e["im:rating"]?.label ?? "0") || 0;
      const version = e["im:version"]?.label || undefined;
      const author = e.author?.name?.label ?? "Anonymous";
      const updated = e.updated?.label;
      return {
        id: `app-store-${id}`,
        author: { name: author, handle: author },
        content: title && body ? `${title}\n\n${body}` : body || title,
        url: appleReviewLink(e, appId, country),
        createdAt: updated ? new Date(updated).toISOString() : new Date().toISOString(),
        meta: {
          rating: ratingNum,
          version,
          country,
          platform: "app-store",
          title: title || undefined,
        },
      } satisfies FeedItem<AppReviewMeta>;
    });
}

// Google Play (batchexecute scrape, keyless).
// Google Play has no public reviews API. The batchexecute endpoint that powers
// the Play Store web UI accepts an RPC id (UsvDTd) that returns the most recent
// reviews for a package. Response is wrapped in `)]}'\n`, then a JSON envelope
// whose third field is itself a stringified JSON array.

const PLAY_RPC = "UsvDTd";

interface PlayReviewParsed {
  id: string;
  rating: number;
  text: string;
  author: string;
  avatarUrl?: string;
  thumbsUp: number;
  version?: string;
  timestampMs: number;
}

function safeArrayAt(value: unknown, idx: number): unknown {
  return Array.isArray(value) ? value[idx] : undefined;
}

function parsePlayReview(raw: unknown): PlayReviewParsed | null {
  if (!Array.isArray(raw)) return null;
  const id = typeof raw[0] === "string" ? raw[0] : null;
  if (!id) return null;
  const authorBlock = safeArrayAt(raw, 1);
  const author =
    typeof safeArrayAt(authorBlock, 0) === "string"
      ? (safeArrayAt(authorBlock, 0) as string)
      : "Anonymous";
  const avatarTriple = safeArrayAt(safeArrayAt(authorBlock, 1), 3);
  const avatarUrl =
    typeof safeArrayAt(avatarTriple, 2) === "string"
      ? (safeArrayAt(avatarTriple, 2) as string)
      : undefined;
  const rating = typeof raw[2] === "number" ? raw[2] : 0;
  const text = typeof raw[4] === "string" ? raw[4] : "";
  const ts = safeArrayAt(raw, 5);
  const seconds = typeof safeArrayAt(ts, 0) === "number" ? (safeArrayAt(ts, 0) as number) : 0;
  const thumbsUp = typeof raw[6] === "number" ? raw[6] : 0;
  const version = typeof raw[10] === "string" ? raw[10] : undefined;
  return {
    id,
    rating,
    text,
    author,
    avatarUrl,
    thumbsUp,
    version,
    timestampMs: seconds * 1000,
  };
}

async function fetchGooglePlayReviews(
  appId: string,
  country: string,
): Promise<FeedItem<AppReviewMeta>[]> {
  // [null,null,[2,1,[40,null,null],null,[]],[appId,7]] — 7 = newest, 40 = page size
  const reqArg = JSON.stringify([
    null,
    null,
    [2, 1, [40, null, null], null, []],
    [appId, 7],
  ]);
  const fReq = JSON.stringify([[[PLAY_RPC, reqArg, null, "generic"]]]);
  const body = new URLSearchParams({ "f.req": fReq });
  const url = `https://play.google.com/_/PlayStoreUi/data/batchexecute?hl=en&gl=${encodeURIComponent(country)}`;

  const res = await fetchUpstream(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      accept: "*/*",
      "user-agent": UA,
    },
    body: body.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Google Play ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const text = await res.text();
  // Strip `)]}'` prefix.
  const stripped = text.replace(/^\)\]\}'\s*/, "");
  const envelope = JSON.parse(stripped) as unknown[];
  const firstFrame = Array.isArray(envelope) ? (envelope[0] as unknown[]) : null;
  const payloadStr =
    Array.isArray(firstFrame) && typeof firstFrame[2] === "string"
      ? (firstFrame[2] as string)
      : null;
  if (!payloadStr) return [];
  const payload = JSON.parse(payloadStr) as unknown[];
  const reviewList = Array.isArray(payload[0]) ? (payload[0] as unknown[]) : [];

  const items: FeedItem<AppReviewMeta>[] = [];
  for (const r of reviewList) {
    const parsed = parsePlayReview(r);
    if (!parsed) continue;
    items.push({
      id: `google-play-${parsed.id}`,
      author: {
        name: parsed.author,
        handle: parsed.author,
        avatarUrl: parsed.avatarUrl,
      },
      content: parsed.text,
      url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}&reviewId=${encodeURIComponent(parsed.id)}`,
      createdAt: new Date(parsed.timestampMs || Date.now()).toISOString(),
      meta: {
        rating: parsed.rating,
        version: parsed.version,
        country,
        platform: "google-play",
        thumbsUp: parsed.thumbsUp,
      },
    });
  }
  return items;
}

export async function fetchReviews(
  platform: AppReviewPlatform,
  appId: string,
  country: string,
): Promise<FeedItem<AppReviewMeta>[]> {
  const id = appId.trim();
  if (!id) throw new Error("App ID is required.");
  const c = (country.trim() || "us").toLowerCase();
  if (platform === "app-store") {
    if (!/^\d+$/.test(id)) {
      throw new Error("App Store ID must be numeric (e.g. 284882215).");
    }
    return fetchAppStoreReviews(id, c);
  }
  return fetchGooglePlayReviews(id, c);
}
