import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import { identiconUrl } from "@/lib/utils";

// GitHub Discussions integration. Discussions are *only* exposed through the
// GraphQL API — there's no REST surface for them — so this file is a
// purpose-built GraphQL client that lives alongside the REST helpers in
// `github.ts` rather than inside it. The REST module is intentionally left
// untouched so its API surface (legacy callers) stays stable.
//
// Auth: `GITHUB_TOKEN` is REQUIRED. Unlike GitHub's REST API (which serves the
// other github-* plugins keyless at 60 req/hr), the GraphQL API gives
// unauthenticated requests ~0 quota — it returns HTTP 403 "API rate limit
// exceeded" immediately. Discussions have no REST surface, so there is no
// keyless path; we fail fast with a clear message instead of a raw 403.

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

export type GHDiscussionMode = "recent" | "unanswered" | "top";

export interface GHDiscussionMeta {
  kind: "discussion";
  repo: string;
  number: number;
  upvotes: number;
  comments: number;
  isAnswered: boolean;
  categoryName?: string;
  /** Raw emoji HTML returned by GitHub (e.g. `<g-emoji>💬</g-emoji>`). */
  categoryEmojiHTML?: string;
}

interface GHDiscussionNode {
  number: number;
  title: string;
  url: string;
  author: { login: string; avatarUrl?: string } | null;
  createdAt: string;
  upvoteCount: number;
  isAnswered: boolean | null;
  category: { name: string; emojiHTML: string } | null;
  comments: { totalCount: number };
}

interface GHDiscussionsResponse {
  data?: {
    repository: {
      discussions: {
        nodes: GHDiscussionNode[];
      } | null;
    } | null;
  };
  errors?: Array<{
    message: string;
    type?: string;
    path?: Array<string | number>;
  }>;
}

const DISCUSSIONS_QUERY = `
  query($owner: String!, $name: String!, $first: Int!) {
    repository(owner: $owner, name: $name) {
      discussions(first: $first, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          number
          title
          url
          author { login avatarUrl }
          createdAt
          upvoteCount
          isAnswered
          category { name emojiHTML }
          comments { totalCount }
        }
      }
    }
  }
`;

const REPO_REGEX =
  /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function parseRepo(input: string): { owner: string; name: string } {
  const clean = input
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\/+$/, "");
  if (!REPO_REGEX.test(clean)) {
    throw new Error(
      `Invalid repo "${input}". Use owner/repo (e.g. vercel/next.js).`,
    );
  }
  const [owner, name] = clean.split("/");
  return { owner, name };
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    "user-agent": "minitor/0.1",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

// Sentinel error so the column renderer can surface a friendlier empty state
// ("Discussions not enabled on this repo") instead of a generic GraphQL
// failure. GitHub returns either an empty/null `discussions` field or a typed
// error when a repo has the Discussions feature disabled — we normalise both.
export class DiscussionsDisabledError extends Error {
  constructor(repo: string) {
    super(`Discussions are not enabled on ${repo}.`);
    this.name = "DiscussionsDisabledError";
  }
}

function isDiscussionsDisabledError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("discussions") &&
    (m.includes("disabled") ||
      m.includes("not enabled") ||
      m.includes("not available") ||
      m.includes("does not have"))
  );
}

export async function fetchDiscussions(
  repo: string,
  mode: GHDiscussionMode,
  first: number,
): Promise<FeedItem<GHDiscussionMeta>[]> {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      "GitHub Discussions requires a token. Set GITHUB_TOKEN in your env (read-only public scope is enough).",
    );
  }
  const { owner, name } = parseRepo(repo);
  const fullRepo = `${owner}/${name}`;
  // We always pull a generous batch (caller controls `first`, usually 50) so
  // the three modes can do their filtering / re-sorting client-side without
  // running multiple round trips. GraphQL's `orderBy` only supports
  // CREATED_AT / UPDATED_AT, not upvotes; "top" mode needs the full batch in
  // memory to sort by upvotes anyway.
  const res = await fetchUpstream(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      query: DISCUSSIONS_QUERY,
      variables: { owner, name, first },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GitHub GraphQL ${res.status}: ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as GHDiscussionsResponse;

  if (json.errors?.length) {
    const joined = json.errors.map((e) => e.message).join("; ");
    if (isDiscussionsDisabledError(joined)) {
      throw new DiscussionsDisabledError(fullRepo);
    }
    throw new Error(`GitHub GraphQL: ${joined}`);
  }

  const repository = json.data?.repository;
  if (!repository) {
    throw new Error(`Repository ${fullRepo} not found.`);
  }
  if (!repository.discussions) {
    // GraphQL returns `discussions: null` on repos where the feature is off.
    throw new DiscussionsDisabledError(fullRepo);
  }

  const nodes = repository.discussions.nodes ?? [];
  const items: FeedItem<GHDiscussionMeta>[] = nodes.map((n) => {
    const login = n.author?.login ?? "ghost";
    const avatarUrl = n.author?.avatarUrl ?? identiconUrl(login);
    return {
      // Stable, dedupe-friendly id so the same discussion across refreshes /
      // re-fetches collapses to one row in the column store.
      id: `github-discussions:${fullRepo}#${n.number}`,
      author: { name: login, handle: login, avatarUrl },
      content: n.title,
      url: n.url,
      createdAt: n.createdAt,
      meta: {
        kind: "discussion",
        repo: fullRepo,
        number: n.number,
        upvotes: n.upvoteCount,
        comments: n.comments.totalCount,
        // `isAnswered` is only meaningful for Q&A-category discussions; for
        // Announcements / General / Polls etc. the field is null. Treat null
        // as "no concept of answered" — we map it to `false` here so the
        // unanswered filter still surfaces those rows, but the renderer uses
        // the raw category to decide whether to show the indicator at all.
        isAnswered: n.isAnswered === true,
        categoryName: n.category?.name,
        categoryEmojiHTML: n.category?.emojiHTML,
      },
    } satisfies FeedItem<GHDiscussionMeta>;
  });

  switch (mode) {
    case "unanswered":
      // Drop discussions that are answered. We don't restrict to Q&A category
      // here — repos use lots of category layouts, and an "unanswered" filter
      // that hides every General / Announcement row would be confusing. Items
      // without an isAnswered concept (null upstream → false in meta) pass.
      return items.filter((it) => it.meta?.isAnswered !== true);
    case "top":
      // Sort by upvotes desc, with comments as a tiebreaker. Original
      // `createdAt` order is preserved for items with identical scores.
      return [...items].sort((a, b) => {
        const upA = a.meta?.upvotes ?? 0;
        const upB = b.meta?.upvotes ?? 0;
        if (upA !== upB) return upB - upA;
        const cA = a.meta?.comments ?? 0;
        const cB = b.meta?.comments ?? 0;
        return cB - cA;
      });
    case "recent":
    default:
      return items;
  }
}
