import type { FeedItem } from "@/lib/columns/types";
import type { StackOverflowMeta } from "@/lib/columns/plugins/stack-overflow/plugin";

// `StackOverflowMeta` is the renderer contract owned by the stack-overflow
// plugin; the fetcher here produces `FeedItem<StackOverflowMeta>` so its meta
// lines up with what the stack-overflow renderer reads. Re-exported so call
// sites that grab StackOverflowMeta from the integration keep working.
export type { StackOverflowMeta };

// Stack Exchange API 2.3 — public, no auth, generous quota.
// https://api.stackexchange.com/docs/questions
//
// We hit /questions on the stackoverflow site filtered by sort (hot, votes,
// creation, week, month) and an optional tag filter. The endpoint returns
// gzip-encoded JSON; fetch decompresses transparently when Accept-Encoding
// is the default. Anonymous quota is 300 req/IP/day — comfortably above a
// dashboard polling cadence.
const BASE = "https://api.stackexchange.com/2.3";

export type StackOverflowMode = "hot" | "votes" | "newest" | "week" | "month";

interface SOOwner {
  display_name?: string;
  link?: string;
  profile_image?: string;
  user_id?: number;
  user_type?: string;
}

interface SOQuestion {
  question_id: number;
  title: string;
  link: string;
  tags?: string[];
  is_answered?: boolean;
  view_count?: number;
  answer_count?: number;
  score?: number;
  creation_date?: number;
  last_activity_date?: number;
  accepted_answer_id?: number;
  owner?: SOOwner;
}

interface SOResponse {
  items?: SOQuestion[];
  has_more?: boolean;
  quota_max?: number;
  quota_remaining?: number;
  error_id?: number;
  error_message?: string;
}

function sortFor(mode: StackOverflowMode): string {
  // Stack Exchange `/questions` accepts sort=activity|votes|creation|hot|week|month.
  // We map newest → creation; the rest pass through.
  switch (mode) {
    case "newest":
      return "creation";
    default:
      return mode;
  }
}

function decodeEntities(s: string): string {
  // Stack Exchange returns titles with HTML entities (e.g. &quot; &#39; &amp;).
  // The set is small and well-known, so a targeted decoder beats pulling in a
  // full HTML parser for what is always a plain text title.
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function avatarFor(owner: SOOwner | undefined, fallbackId: number): string {
  // Stack Exchange profile_image URLs sometimes embed Gravatar `?s=128` query
  // params; honour them as-is. Fall back to a deterministic identicon-style
  // gravatar when the owner is anonymous (their owner.user_type === "does_not_exist").
  if (owner?.profile_image) return owner.profile_image;
  return `https://www.gravatar.com/avatar/${fallbackId}?d=identicon&s=64`;
}

function mapQuestion(q: SOQuestion): FeedItem<StackOverflowMeta> | null {
  // Schema-drift safe: a question without an id, a title, or a link can't be
  // rendered or linked, so drop rather than emit a dead row.
  if (!q.question_id || !q.title || !q.link) return null;

  const owner = q.owner;
  const displayName = owner?.display_name
    ? decodeEntities(owner.display_name)
    : "anonymous";
  const createdMs =
    typeof q.creation_date === "number" ? q.creation_date * 1000 : Date.now();

  return {
    id: String(q.question_id),
    author: {
      name: displayName,
      handle: displayName,
      avatarUrl: avatarFor(owner, q.question_id),
    },
    content: decodeEntities(q.title),
    url: q.link,
    createdAt: new Date(createdMs).toISOString(),
    meta: {
      score: q.score ?? 0,
      answers: q.answer_count ?? 0,
      views: q.view_count ?? 0,
      isAnswered: !!q.is_answered,
      hasAccepted: typeof q.accepted_answer_id === "number",
      tags: Array.isArray(q.tags) ? q.tags : [],
      questionId: q.question_id,
    },
  };
}

function normaliseTagFilter(tag: string): string {
  // Stack Exchange supports up to five tags joined by `;` (semicolon = AND).
  // Accept commas or spaces from the user, normalise, dedupe, and clamp.
  const parts = tag
    .split(/[,;\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p);
      uniq.push(p);
    }
    if (uniq.length === 5) break;
  }
  return uniq.join(";");
}

export async function fetchStackOverflowPage(
  mode: StackOverflowMode,
  tag: string,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<StackOverflowMeta>[]; hasMore: boolean }> {
  const params = new URLSearchParams({
    site: "stackoverflow",
    order: "desc",
    sort: sortFor(mode),
    pagesize: String(Math.min(Math.max(limit, 1), 100)),
    page: String(Math.max(page, 0) + 1),
  });

  const tagFilter = normaliseTagFilter(tag);
  if (tagFilter) params.set("tagged", tagFilter);

  const url = `${BASE}/questions?${params}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "minitor/1.0 (+https://github.com/aaronjmars/minitor)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Stack Overflow ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as SOResponse;
  if (json.error_message) {
    throw new Error(`Stack Overflow API error: ${json.error_message}`);
  }

  const items = Array.isArray(json.items)
    ? json.items
        .map(mapQuestion)
        .filter((q): q is FeedItem<StackOverflowMeta> => q !== null)
    : [];

  return { items, hasMore: !!json.has_more };
}
