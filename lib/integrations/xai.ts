import { fetchUpstream } from "@/lib/integrations/fetch";
import { nanoid } from "nanoid";
import type { FeedItem } from "@/lib/columns/types";
import { identiconUrl } from "@/lib/utils";

const XAI_URL = "https://api.x.ai/v1/responses";

interface GrokItem {
  id?: string | number;
  author_handle?: string;
  author_name?: string;
  content?: string;
  created_at?: string;
  url?: string;
  likes?: number;
  reposts?: number;
  replies?: number;
  views?: number;
  source?: string; // for web/news
  published_at?: string; // alt field
  title?: string; // for news
  snippet?: string; // for web
}

interface GrokResponse {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: { total_tokens?: number; cost_in_usd_ticks?: number };
}

export type GrokTool =
  | { type: "x_search" }
  | { type: "web_search" };

// Meta emitted by the web/news searches (grokWebSearch, grokNewsSearch,
// grokFacebookSearch). Owned here so the consuming plugins alias it.
export interface WebSearchMeta {
  source: string;
  kind: "web" | "news";
}

interface GrokSearchOptions {
  prompt: string;
  tools: GrokTool[];
  /** Override the default model set via XAI_MODEL. */
  model?: string;
}

const AVATAR_CACHE = new Map<string, string>();
function avatarFor(handle: string): string {
  const clean = handle.replace(/^@/, "");
  let cached = AVATAR_CACHE.get(clean);
  if (!cached) {
    // unavatar proxies the real X profile picture; falls back to a stable
    // dicebear avatar when the handle has no public avatar / doesn't exist.
    const fallback = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(clean)}`;
    cached = `https://unavatar.io/x/${encodeURIComponent(clean)}?fallback=${encodeURIComponent(fallback)}`;
    AVATAR_CACHE.set(clean, cached);
  }
  return cached;
}

function stripAt(handle: string): string {
  return handle.replace(/^@/, "").trim();
}

function extractJsonArray(text: string): GrokItem[] {
  // Grok sometimes wraps the array in code fences or prose — strip them.
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fence ? fence[1].trim() : text.trim();
  // Find first '[' and last ']' to trim any leading/trailing prose.
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Grok returned non-JSON output: ${text.slice(0, 200)}`);
  }
  const slice = candidate.slice(start, end + 1);
  const parsed = JSON.parse(slice);
  if (!Array.isArray(parsed)) {
    throw new Error("Grok JSON was not an array");
  }
  return parsed as GrokItem[];
}

async function callGrok(options: GrokSearchOptions): Promise<GrokItem[]> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY is not set in .env.local");
  }
  const model = options.model ?? process.env.XAI_MODEL ?? "grok-4-fast-reasoning";

  const res = await fetchUpstream(XAI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content: options.prompt }],
      tools: options.tools,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`xAI ${res.status}: ${body.slice(0, 400)}`);
  }

  const json = (await res.json()) as GrokResponse;
  const text = json.output
    ?.flatMap((o) => o.content ?? [])
    .find((c) => c.type === "output_text")?.text;

  if (!text) {
    throw new Error("xAI response missing output_text");
  }

  return extractJsonArray(text);
}

function toXFeedItem(g: GrokItem): FeedItem | null {
  const handle = stripAt(g.author_handle ?? "");
  const content = (g.content ?? "").trim();
  if (!content) return null;
  const id = g.id !== undefined ? String(g.id) : nanoid();
  const url =
    g.url ??
    (handle ? `https://x.com/${handle}/status/${id}` : undefined);

  return {
    id,
    author: {
      name: g.author_name ?? handle ?? "Unknown",
      handle: handle || undefined,
      avatarUrl: handle ? avatarFor(handle) : undefined,
    },
    content,
    url,
    createdAt: g.created_at ?? new Date().toISOString(),
    meta: {
      likes: Number(g.likes ?? 0),
      retweets: Number(g.reposts ?? 0),
      replies: Number(g.replies ?? 0),
      views: Number(g.views ?? 0),
    },
  };
}

function toWebFeedItem(
  g: GrokItem,
  kind: "web" | "news",
): FeedItem<WebSearchMeta> | null {
  const url = g.url;
  const content = (g.content ?? g.snippet ?? g.title ?? "").trim();
  if (!url || !content) return null;
  const source = g.source ?? g.author_name ?? new URL(url).hostname.replace(/^www\./, "");
  const id = g.id !== undefined ? String(g.id) : url;
  return {
    id,
    author: {
      name: source,
      handle: source,
      avatarUrl: identiconUrl(source),
    },
    content: g.title ? `${g.title}\n\n${g.snippet ?? ""}`.trim() : content,
    url,
    createdAt: g.created_at ?? g.published_at ?? new Date().toISOString(),
    meta: { source, kind },
  };
}

const X_ITEM_SHAPE =
  '[{"id":"string","author_handle":"string","author_name":"string","content":"string","created_at":"ISO8601","url":"string","likes":0,"reposts":0,"replies":0}]';

const WEB_ITEM_SHAPE =
  '[{"id":"string-or-url","title":"string","snippet":"string","source":"string","url":"string","created_at":"ISO8601 if known"}]';

export async function grokXSearch(query: string, limit = 6): Promise<FeedItem[]> {
  const prompt = `Search X for the ${limit} most recent posts matching: ${JSON.stringify(
    query,
  )}. Sort by newest first. Return ONLY a JSON array (no prose, no code fences) matching this shape: ${X_ITEM_SHAPE}.`;
  const items = await callGrok({ prompt, tools: [{ type: "x_search" }] });
  return items
    .map(toXFeedItem)
    .filter((i): i is FeedItem => i !== null)
    .slice(0, limit);
}

export async function grokXTrending(topic: string, limit = 6): Promise<FeedItem[]> {
  const scope = topic.trim()
    ? `about ${JSON.stringify(topic.trim())}`
    : "across X right now (any topic)";
  const prompt = `Find the ${limit} highest-engagement X posts trending ${scope} in the last 24 hours. Prioritize posts with many likes, reposts, and replies. Return ONLY a JSON array (no prose, no code fences) matching this shape: ${X_ITEM_SHAPE}.`;
  const items = await callGrok({ prompt, tools: [{ type: "x_search" }] });
  return items
    .map(toXFeedItem)
    .filter((i): i is FeedItem => i !== null)
    .slice(0, limit);
}

export async function grokWebSearch(query: string, limit = 6): Promise<FeedItem[]> {
  const prompt = `Search the web for the ${limit} most recent results matching: ${JSON.stringify(
    query,
  )}. Sort newest first. Return ONLY a JSON array (no prose, no code fences) matching this shape: ${WEB_ITEM_SHAPE}.`;
  const items = await callGrok({ prompt, tools: [{ type: "web_search" }] });
  return items
    .map((g) => toWebFeedItem(g, "web"))
    .filter((i): i is FeedItem<WebSearchMeta> => i !== null)
    .slice(0, limit);
}

export async function grokNewsSearch(query: string, limit = 6): Promise<FeedItem[]> {
  const prompt = `Search recent news articles for: ${JSON.stringify(
    query,
  )}. Prefer major publications from the last 48 hours. Return the ${limit} latest. Return ONLY a JSON array (no prose, no code fences) matching this shape: ${WEB_ITEM_SHAPE}.`;
  const items = await callGrok({ prompt, tools: [{ type: "web_search" }] });
  return items
    .map((g) => toWebFeedItem(g, "news"))
    .filter((i): i is FeedItem<WebSearchMeta> => i !== null)
    .slice(0, limit);
}

export async function grokFacebookSearch(query: string, limit = 6): Promise<FeedItem[]> {
  const q = query.trim();
  const scoped = q ? `site:facebook.com ${q}` : "site:facebook.com";
  const prompt = `Search the web for the ${limit} most recent public Facebook posts or pages matching: ${JSON.stringify(
    scoped,
  )}. Restrict results to facebook.com URLs (posts, page wall items, public group posts). Sort newest first. For each, set "source" to the page or profile name (not the domain), and "title" to a short snippet from the post. Return ONLY a JSON array (no prose, no code fences) matching this shape: ${WEB_ITEM_SHAPE}.`;
  const items = await callGrok({ prompt, tools: [{ type: "web_search" }] });
  return items
    .map((g) => toWebFeedItem(g, "web"))
    .filter((i): i is FeedItem<WebSearchMeta> => i !== null)
    .filter((i) => /(^|\.)facebook\.com\//i.test(i.url ?? ""))
    .slice(0, limit);
}
