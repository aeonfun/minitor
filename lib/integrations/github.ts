import type { FeedItem } from "@/lib/columns/types";
import type { GHPRMeta } from "@/lib/columns/plugins/github-prs/plugin";
import type {
  GHActionsMeta,
  GHActionStatus,
  GHActionConclusion,
} from "@/lib/columns/plugins/github-actions/plugin";
import { identiconUrl, truncateText } from "@/lib/utils";

// `GHPRMeta` is the renderer contract owned by the github-prs plugin; the
// fetcher below produces `FeedItem<GHPRMeta>` so its meta lines up with what
// the plugin's renderer reads.

const API = "https://api.github.com";

export type GHMode = "trending" | "releases" | "issues";

export type GHSearchScope = "repositories" | "issues" | "code" | "commits";

interface GHRepo {
  id: number;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  pushed_at: string;
  created_at: string;
  owner?: { login: string; avatar_url?: string };
}

interface GHRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  created_at: string;
  prerelease: boolean;
  draft: boolean;
  author?: { login: string; avatar_url?: string };
}

interface GHIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
  repository_url: string;
  user?: { login: string; avatar_url?: string };
  comments: number;
  reactions?: { total_count?: number };
}

interface GHSearchResponse<T> {
  items?: T[];
  message?: string;
  total_count?: number;
}

interface GHPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: "open" | "closed";
  draft: boolean;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  comments?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  base: { ref: string };
  head: { ref: string };
  user?: { login: string; avatar_url?: string } | null;
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "minitor/0.1",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function isoNDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
}

async function fetchTrending(
  language: string,
  period: "day" | "week" | "month",
  limit: number,
  page = 1,
): Promise<FeedItem[]> {
  const days = period === "day" ? 1 : period === "week" ? 7 : 30;
  const q = [
    `created:>${isoNDaysAgo(days)}`,
    language.trim() ? `language:${language.trim()}` : "",
    "stars:>5",
  ]
    .filter(Boolean)
    .join(" ");
  const params = new URLSearchParams({
    q,
    sort: "stars",
    order: "desc",
    per_page: String(limit),
    page: String(page),
  });
  const json = await ghFetch<GHSearchResponse<GHRepo>>(
    `${API}/search/repositories?${params}`,
  );
  if (json.message) throw new Error(json.message);
  return (json.items ?? []).slice(0, limit).map((r) => {
    const owner = r.owner?.login ?? r.full_name.split("/")[0] ?? "github";
    return {
      id: `repo-${r.id}`,
      author: {
        name: owner,
        handle: owner,
        avatarUrl:
          r.owner?.avatar_url ??
          identiconUrl(owner),
      },
      content: r.description
        ? `${r.full_name}\n\n${r.description}`
        : r.full_name,
      url: r.html_url,
      createdAt: r.created_at,
      meta: {
        kind: "repo",
        stars: r.stargazers_count,
        forks: r.forks_count,
        language: r.language ?? undefined,
        repo: r.full_name,
      },
    } satisfies FeedItem;
  });
}

async function fetchReleases(
  repo: string,
  limit: number,
  page = 1,
): Promise<FeedItem[]> {
  const clean = repo.trim().replace(/^https?:\/\/github\.com\//, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(clean)) {
    throw new Error(`Invalid repo "${repo}". Use owner/repo (e.g. vercel/next.js).`);
  }
  const params = new URLSearchParams({
    per_page: String(limit),
    page: String(page),
  });
  const releases = await ghFetch<GHRelease[]>(
    `${API}/repos/${clean}/releases?${params}`,
  );
  return releases
    .filter((r) => !r.draft)
    .slice(0, limit)
    .map((r) => {
      const author = r.author?.login ?? clean.split("/")[0] ?? "github";
      const title = r.name?.trim() || r.tag_name;
      const body = (r.body ?? "").trim();
      const trimmed = truncateText(body, 600);
      return {
        id: `rel-${r.id}`,
        author: {
          name: clean,
          handle: author,
          avatarUrl:
            r.author?.avatar_url ??
            identiconUrl(clean),
        },
        content: trimmed ? `${title}\n\n${trimmed}` : title,
        url: r.html_url,
        createdAt: r.published_at ?? r.created_at,
        meta: {
          kind: "release",
          repo: clean,
          tag: r.tag_name,
          prerelease: r.prerelease,
        },
      } satisfies FeedItem;
    });
}

async function fetchIssues(
  query: string,
  limit: number,
  page = 1,
): Promise<FeedItem[]> {
  if (!query.trim()) {
    throw new Error("Query is required for issue search.");
  }
  const params = new URLSearchParams({
    q: query.trim(),
    sort: "updated",
    order: "desc",
    per_page: String(limit),
    page: String(page),
  });
  const json = await ghFetch<GHSearchResponse<GHIssue>>(
    `${API}/search/issues?${params}`,
  );
  if (json.message) throw new Error(json.message);
  return (json.items ?? []).slice(0, limit).map((i) => {
    const user = i.user?.login ?? "anonymous";
    const isPR = !!i.pull_request;
    const repo = i.repository_url.replace(`${API}/repos/`, "");
    const body = (i.body ?? "").trim();
    const trimmed = truncateText(body, 400);
    return {
      id: `iss-${i.id}`,
      author: {
        name: user,
        handle: user,
        avatarUrl:
          i.user?.avatar_url ??
          identiconUrl(user),
      },
      content: trimmed ? `${i.title}\n\n${trimmed}` : i.title,
      url: i.html_url,
      createdAt: i.updated_at ?? i.created_at,
      meta: {
        kind: isPR ? "pr" : "issue",
        repo,
        number: i.number,
        state: i.state,
        comments: i.comments,
      },
    } satisfies FeedItem;
  });
}


export async function fetchPullRequests(
  repo: string,
  state: "open" | "closed" | "all",
  sort: "created" | "updated",
  limit: number,
  page = 1,
): Promise<FeedItem<GHPRMeta>[]> {
  const clean = repo.trim().replace(/^https?:\/\/github\.com\//, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(clean)) {
    throw new Error(`Invalid repo "${repo}". Use owner/repo (e.g. vercel/next.js).`);
  }
  const params = new URLSearchParams({
    state,
    sort,
    direction: "desc",
    per_page: String(limit),
    page: String(page),
  });
  const prs = await ghFetch<GHPullRequest[]>(
    `${API}/repos/${clean}/pulls?${params}`,
  );
  return prs.slice(0, limit).map((p) => {
    const user = p.user?.login ?? "anonymous";
    const merged = p.state === "closed" && !!p.merged_at;
    const display: GHPRMeta["state"] = merged
      ? "merged"
      : p.state === "closed"
        ? "closed"
        : "open";
    const body = (p.body ?? "").trim();
    const trimmed = truncateText(body, 400);
    const sortField = sort === "created" ? p.created_at : p.updated_at;
    return {
      id: `pr-${p.id}`,
      author: {
        name: user,
        handle: user,
        avatarUrl:
          p.user?.avatar_url ??
          identiconUrl(user),
      },
      content: trimmed ? `${p.title}\n\n${trimmed}` : p.title,
      url: p.html_url,
      createdAt: sortField,
      meta: {
        number: p.number,
        state: display,
        isDraft: p.draft,
        additions: p.additions,
        deletions: p.deletions,
        changedFiles: p.changed_files,
        baseBranch: p.base.ref,
        headBranch: p.head.ref,
        commentsCount: p.comments ?? 0,
        repo: clean,
        mergedAt: p.merged_at ?? undefined,
      },
    } satisfies FeedItem<GHPRMeta>;
  });
}

interface GHCommitListItem {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: { name?: string; email?: string; date?: string };
    committer?: { name?: string; email?: string; date?: string };
  };
  author?: { login: string; avatar_url?: string } | null;
}

export async function fetchCommits(
  repo: string,
  branch: string,
  limit: number,
  page = 1,
): Promise<FeedItem[]> {
  const clean = repo.trim().replace(/^https?:\/\/github\.com\//, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(clean)) {
    throw new Error(`Invalid repo "${repo}". Use owner/repo (e.g. vercel/next.js).`);
  }
  const params = new URLSearchParams({
    per_page: String(limit),
    page: String(page),
  });
  // `sha` accepts a branch name, tag, or commit SHA. Empty = the default branch.
  const ref = branch.trim();
  if (ref) params.set("sha", ref);
  const commits = await ghFetch<GHCommitListItem[]>(
    `${API}/repos/${clean}/commits?${params}`,
  );
  return commits.slice(0, limit).map((c) => {
    const handle =
      c.author?.login ?? c.commit.author?.name ?? clean.split("/")[0] ?? "github";
    const message = (c.commit.message ?? "").trim();
    const [firstLine, ...rest] = message.split("\n");
    const body = rest.join("\n").trim();
    const trimmed = truncateText(body, 400);
    return {
      id: `ghc-${c.sha}`,
      author: {
        name: handle,
        handle,
        avatarUrl:
          c.author?.avatar_url ??
          identiconUrl(handle),
      },
      content: trimmed ? `${firstLine}\n\n${trimmed}` : firstLine,
      url: c.html_url,
      createdAt:
        c.commit.author?.date ??
        c.commit.committer?.date ??
        new Date().toISOString(),
      meta: {
        kind: "commit",
        repo: clean,
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
      },
    } satisfies FeedItem;
  });
}

export async function fetchGitHub(
  mode: GHMode,
  config: { language?: string; period?: string; repo?: string; query?: string },
  limit = 12,
  page = 1,
): Promise<FeedItem[]> {
  switch (mode) {
    case "releases":
      return fetchReleases(config.repo ?? "", limit, page);
    case "issues":
      return fetchIssues(config.query ?? "", limit, page);
    case "trending":
    default: {
      const period = (config.period === "day" || config.period === "month"
        ? config.period
        : "week") as "day" | "week" | "month";
      return fetchTrending(config.language ?? "", period, limit, page);
    }
  }
}

// ---- Free-form search across scopes (used by github-search plugin) ---------

interface GHCodeResult {
  sha: string;
  name: string;
  path: string;
  html_url: string;
  repository: {
    full_name: string;
    pushed_at?: string;
    owner?: { login: string; avatar_url?: string };
  };
  text_matches?: Array<{ fragment?: string }>;
}

interface GHCommitResult {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: { name?: string; email?: string; date?: string };
  };
  author?: { login: string; avatar_url?: string } | null;
  repository: { full_name: string };
}

function buildQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  // GitHub indexes URLs in code/issues but tokenizes on punctuation, so a
  // bare URL becomes many separate matches. Quote it for an exact match —
  // unless the user already wrapped it themselves.
  if (/^https?:\/\//i.test(trimmed) && !/^".*"$/.test(trimmed)) {
    return `"${trimmed}"`;
  }
  return trimmed;
}

async function searchRepos(
  query: string,
  limit: number,
  page: number,
): Promise<FeedItem[]> {
  const params = new URLSearchParams({
    q: query,
    sort: "updated",
    order: "desc",
    per_page: String(limit),
    page: String(page),
  });
  const json = await ghFetch<GHSearchResponse<GHRepo>>(
    `${API}/search/repositories?${params}`,
  );
  if (json.message) throw new Error(json.message);
  return (json.items ?? []).slice(0, limit).map((r) => {
    const owner = r.owner?.login ?? r.full_name.split("/")[0] ?? "github";
    return {
      id: `ghs-repo-${r.id}`,
      author: {
        name: owner,
        handle: owner,
        avatarUrl:
          r.owner?.avatar_url ??
          identiconUrl(owner),
      },
      content: r.description
        ? `${r.full_name}\n\n${r.description}`
        : r.full_name,
      url: r.html_url,
      createdAt: r.pushed_at ?? r.created_at,
      meta: {
        scope: "repositories" as const,
        repo: r.full_name,
        stars: r.stargazers_count,
        forks: r.forks_count,
        language: r.language ?? undefined,
      },
    } satisfies FeedItem;
  });
}

async function searchIssuesScope(
  query: string,
  limit: number,
  page: number,
): Promise<FeedItem[]> {
  const params = new URLSearchParams({
    q: query,
    sort: "updated",
    order: "desc",
    per_page: String(limit),
    page: String(page),
  });
  const json = await ghFetch<GHSearchResponse<GHIssue>>(
    `${API}/search/issues?${params}`,
  );
  if (json.message) throw new Error(json.message);
  return (json.items ?? []).slice(0, limit).map((i) => {
    const user = i.user?.login ?? "anonymous";
    const isPr = !!i.pull_request;
    const repo = i.repository_url.replace(`${API}/repos/`, "");
    const body = (i.body ?? "").trim();
    const trimmed = truncateText(body, 400);
    return {
      id: `ghs-iss-${i.id}`,
      author: {
        name: user,
        handle: user,
        avatarUrl:
          i.user?.avatar_url ??
          identiconUrl(user),
      },
      content: trimmed ? `${i.title}\n\n${trimmed}` : i.title,
      url: i.html_url,
      createdAt: i.updated_at ?? i.created_at,
      meta: {
        scope: "issues" as const,
        repo,
        number: i.number,
        state: i.state,
        comments: i.comments,
        isPr,
      },
    } satisfies FeedItem;
  });
}

async function searchCode(
  query: string,
  limit: number,
  page: number,
): Promise<FeedItem[]> {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      "GitHub code search requires a token. Set GITHUB_TOKEN in your env (read-only public scope is enough).",
    );
  }
  const params = new URLSearchParams({
    q: query,
    per_page: String(limit),
    page: String(page),
  });
  const res = await fetch(`${API}/search/code?${params}`, {
    headers: {
      ...(headers() as Record<string, string>),
      // text-match returns a `fragment` snippet around each hit
      accept: "application/vnd.github.text-match+json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as GHSearchResponse<GHCodeResult>;
  if (json.message) throw new Error(json.message);
  return (json.items ?? []).slice(0, limit).map((c) => {
    const owner =
      c.repository.owner?.login ??
      c.repository.full_name.split("/")[0] ??
      "github";
    const fragment = (c.text_matches?.[0]?.fragment ?? "").trim();
    const snippet = truncateText(fragment, 400);
    const title = `${c.repository.full_name} · ${c.path}`;
    return {
      id: `ghs-code-${c.repository.full_name}-${c.sha}-${c.path}`,
      author: {
        name: owner,
        handle: owner,
        avatarUrl:
          c.repository.owner?.avatar_url ??
          identiconUrl(owner),
      },
      content: snippet ? `${title}\n\n${snippet}` : title,
      url: c.html_url,
      createdAt: c.repository.pushed_at ?? new Date().toISOString(),
      meta: {
        scope: "code" as const,
        repo: c.repository.full_name,
        path: c.path,
        sha: c.sha,
      },
    } satisfies FeedItem;
  });
}

async function searchCommits(
  query: string,
  limit: number,
  page: number,
): Promise<FeedItem[]> {
  const params = new URLSearchParams({
    q: query,
    sort: "author-date",
    order: "desc",
    per_page: String(limit),
    page: String(page),
  });
  const json = await ghFetch<GHSearchResponse<GHCommitResult>>(
    `${API}/search/commits?${params}`,
  );
  if (json.message) throw new Error(json.message);
  return (json.items ?? []).slice(0, limit).map((c) => {
    const handle =
      c.author?.login ?? c.commit.author?.name ?? "unknown";
    const message = (c.commit.message ?? "").trim();
    const [firstLine, ...rest] = message.split("\n");
    const restJoined = rest.join("\n").trim();
    const trimmed = truncateText(restJoined, 400);
    return {
      id: `ghs-commit-${c.sha}`,
      author: {
        name: handle,
        handle,
        avatarUrl:
          c.author?.avatar_url ??
          identiconUrl(handle),
      },
      content: trimmed ? `${firstLine}\n\n${trimmed}` : firstLine,
      url: c.html_url,
      createdAt: c.commit.author?.date ?? new Date().toISOString(),
      meta: {
        scope: "commits" as const,
        repo: c.repository.full_name,
        sha: c.sha,
      },
    } satisfies FeedItem;
  });
}

export async function searchGitHub(
  scope: GHSearchScope,
  rawQuery: string,
  limit = 12,
  page = 1,
): Promise<FeedItem[]> {
  const query = buildQuery(rawQuery);
  if (!query) {
    throw new Error("Query is required for GitHub search.");
  }
  switch (scope) {
    case "repositories":
      return searchRepos(query, limit, page);
    case "issues":
      return searchIssuesScope(query, limit, page);
    case "code":
      return searchCode(query, limit, page);
    case "commits":
      return searchCommits(query, limit, page);
  }
}

// Stargazers + forks (used by the github-watchers plugin)

export interface GHWatcherItemMeta {
  kind: "star" | "fork";
  repo: string;
  forkUrl?: string;
  starredAt?: string;
  forkedAt?: string;
}

export type GHWatcherItem = FeedItem<GHWatcherItemMeta>;

export interface GHWatcherPage {
  items: GHWatcherItem[];
  nextCursor?: string;
}

export function normalizeGitHubRepo(input: string): string {
  const clean = input
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\/+$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(clean)) {
    throw new Error(
      `Invalid repo "${input}". Use owner/repo (e.g. vercel/next.js).`,
    );
  }
  return clean;
}

function parseLastPage(linkHeader: string | null): number | undefined {
  if (!linkHeader) return undefined;
  // Link: <...&page=42>; rel="last", <...&page=2>; rel="next"
  for (const part of linkHeader.split(",")) {
    const m = /<([^>]+)>;\s*rel="last"/.exec(part.trim());
    if (m) {
      try {
        const u = new URL(m[1]);
        const p = u.searchParams.get("page");
        if (p) return Number(p);
      } catch {
        // The Link-header URL is matched by regex; a malformed match shouldn't
        // be fatal — fall through and let pagination return undefined.
      }
    }
  }
  return undefined;
}

interface GHStargazerEdgeREST {
  starred_at: string;
  user: { login: string; avatar_url?: string; html_url?: string };
}

async function ghFetchStargazersPageREST(
  fullRepo: string,
  page: number,
  perPage: number,
): Promise<{ items: GHWatcherItem[]; lastPage?: number }> {
  const params = new URLSearchParams({
    per_page: String(perPage),
    page: String(page),
  });
  const url = `${API}/repos/${fullRepo}/stargazers?${params}`;
  const res = await fetch(url, {
    headers: {
      ...headers(),
      // star+json is required to receive `starred_at` timestamps.
      accept: "application/vnd.github.star+json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  const lastPage = parseLastPage(res.headers.get("link"));
  const json = (await res.json()) as GHStargazerEdgeREST[];
  const items = json.map((edge) => {
    const u = edge.user;
    return {
      id: `gh-star-${fullRepo}-${u.login}`,
      author: {
        name: u.login,
        handle: u.login,
        avatarUrl:
          u.avatar_url ??
          identiconUrl(u.login),
      },
      content: `${u.login} starred ${fullRepo}`,
      url: u.html_url ?? `https://github.com/${u.login}`,
      createdAt: edge.starred_at,
      meta: {
        kind: "star",
        repo: fullRepo,
        starredAt: edge.starred_at,
      },
    } satisfies GHWatcherItem;
  });
  return { items, lastPage };
}

interface GHGraphQLStargazersResponse {
  data?: {
    repository: {
      stargazers: {
        pageInfo: { endCursor: string | null; hasNextPage: boolean };
        edges: Array<{
          starredAt: string;
          node: { login: string; avatarUrl?: string; url?: string };
        }>;
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

async function fetchStargazersGraphQL(
  fullRepo: string,
  limit: number,
  cursor?: string,
): Promise<GHWatcherPage> {
  const [owner, name] = fullRepo.split("/");
  const query = `
    query($owner:String!, $name:String!, $first:Int!, $after:String) {
      repository(owner:$owner, name:$name) {
        stargazers(first:$first, after:$after, orderBy:{field:STARRED_AT, direction:DESC}) {
          pageInfo { endCursor hasNextPage }
          edges {
            starredAt
            node { login avatarUrl url }
          }
        }
      }
    }
  `;
  const res = await fetch(`${API}/graphql`, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { owner, name, first: limit, after: cursor ?? null },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub GraphQL ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as GHGraphQLStargazersResponse;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const sg = json.data?.repository?.stargazers;
  if (!sg) throw new Error(`Repository ${fullRepo} not found.`);
  const items = sg.edges.map((edge) => {
    const u = edge.node;
    return {
      id: `gh-star-${fullRepo}-${u.login}`,
      author: {
        name: u.login,
        handle: u.login,
        avatarUrl:
          u.avatarUrl ??
          identiconUrl(u.login),
      },
      content: `${u.login} starred ${fullRepo}`,
      url: u.url ?? `https://github.com/${u.login}`,
      createdAt: edge.starredAt,
      meta: {
        kind: "star",
        repo: fullRepo,
        starredAt: edge.starredAt,
      },
    } satisfies GHWatcherItem;
  });
  return {
    items,
    nextCursor:
      sg.pageInfo.hasNextPage && sg.pageInfo.endCursor
        ? `gql:${sg.pageInfo.endCursor}`
        : undefined,
  };
}

async function fetchStargazersREST(
  fullRepo: string,
  limit: number,
  cursor?: string,
): Promise<GHWatcherPage> {
  // REST sorts oldest-first. To surface newest-first we must walk the Link
  // header to find the last page, then page backwards from there.
  let pageToFetch: number;
  if (cursor) {
    pageToFetch = Number(cursor);
    if (!Number.isFinite(pageToFetch) || pageToFetch < 1) {
      return { items: [] };
    }
  } else {
    const probe = await ghFetchStargazersPageREST(fullRepo, 1, limit);
    pageToFetch = probe.lastPage ?? 1;
  }
  const { items } = await ghFetchStargazersPageREST(
    fullRepo,
    pageToFetch,
    limit,
  );
  items.reverse();
  return {
    items,
    nextCursor: pageToFetch > 1 ? String(pageToFetch - 1) : undefined,
  };
}

export async function fetchStargazers(
  repo: string,
  limit = 12,
  cursor?: string,
): Promise<GHWatcherPage> {
  const fullRepo = normalizeGitHubRepo(repo);
  if (process.env.GITHUB_TOKEN) {
    return fetchStargazersGraphQL(
      fullRepo,
      limit,
      cursor?.startsWith("gql:") ? cursor.slice(4) : undefined,
    );
  }
  return fetchStargazersREST(fullRepo, limit, cursor);
}

interface GHForkREST {
  id: number;
  full_name: string;
  html_url: string;
  created_at: string;
  owner?: { login: string; avatar_url?: string; html_url?: string };
}

export async function fetchForks(
  repo: string,
  limit = 12,
  cursor?: string,
): Promise<GHWatcherPage> {
  const fullRepo = normalizeGitHubRepo(repo);
  const page = cursor ? Number(cursor) || 1 : 1;
  const params = new URLSearchParams({
    sort: "newest",
    per_page: String(limit),
    page: String(page),
  });
  const forks = await ghFetch<GHForkREST[]>(
    `${API}/repos/${fullRepo}/forks?${params}`,
  );
  const items: GHWatcherItem[] = forks.map((f) => {
    const owner = f.owner?.login ?? f.full_name.split("/")[0] ?? "github";
    return {
      id: `gh-fork-${f.id}`,
      author: {
        name: owner,
        handle: owner,
        avatarUrl:
          f.owner?.avatar_url ??
          identiconUrl(owner),
      },
      content: `${owner} forked ${fullRepo}`,
      url: f.owner?.html_url ?? `https://github.com/${owner}`,
      createdAt: f.created_at,
      meta: {
        kind: "fork",
        repo: fullRepo,
        forkUrl: f.html_url,
        forkedAt: f.created_at,
      },
    };
  });
  return {
    items,
    nextCursor: items.length === limit ? String(page + 1) : undefined,
  };
}

// ---- Actions / workflow runs (used by the github-actions plugin) -----------

// `GHActionsMeta` (+ its `GHActionStatus` / `GHActionConclusion` field unions)
// is the renderer contract owned by the github-actions plugin; the fetcher
// below produces `FeedItem<GHActionsMeta>` so its meta lines up with what the
// github-actions renderer reads. Re-exported (and aliased as `GHActionRunMeta`)
// so call sites that grab these from the integration keep working.
export type { GHActionsMeta, GHActionStatus, GHActionConclusion };
export type GHActionRunMeta = GHActionsMeta;

interface GHWorkflowRun {
  id: number;
  name: string | null;
  path?: string;
  display_title?: string;
  run_number: number;
  event: string;
  status: GHActionStatus;
  conclusion: GHActionConclusion | null;
  head_branch: string | null;
  head_sha: string;
  html_url: string;
  run_started_at?: string;
  created_at: string;
  updated_at: string;
  head_commit?: {
    id?: string;
    message?: string;
    author?: { name?: string; email?: string };
  } | null;
  actor?: { login: string; avatar_url?: string } | null;
  triggering_actor?: { login: string; avatar_url?: string } | null;
}

interface GHWorkflowRunsResponse {
  total_count?: number;
  workflow_runs?: GHWorkflowRun[];
  message?: string;
}

/**
 * Fetch recent workflow runs for a repository.
 *
 * - `workflow` (optional): filter to runs whose `name` or `path` equals this
 *   value. Matched case-insensitively after a trim. We can't push the filter
 *   into the API directly without knowing the numeric workflow_id, so it's
 *   applied client-side over the requested page. That means a filter narrower
 *   than the page can return fewer than `limit` rows even when more pages
 *   exist upstream — the `hasMore` decision still uses raw upstream count so
 *   "Load more" pages through correctly.
 * - `branch` (optional): pushed as `branch=` query param. The API supports
 *   exact branch matches only; partials don't work.
 */
export async function fetchWorkflowRuns(
  repo: string,
  workflow: string,
  branch: string,
  limit: number,
  page = 1,
): Promise<{ items: FeedItem<GHActionRunMeta>[]; hasMore: boolean }> {
  const fullRepo = normalizeGitHubRepo(repo);
  const params = new URLSearchParams({
    per_page: String(Math.min(Math.max(limit, 1), 100)),
    page: String(Math.max(page, 1)),
  });
  const trimmedBranch = branch.trim();
  if (trimmedBranch) params.set("branch", trimmedBranch);
  const url = `${API}/repos/${fullRepo}/actions/runs?${params}`;
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as GHWorkflowRunsResponse;
  if (json.message) throw new Error(json.message);
  const raw = json.workflow_runs ?? [];
  const wf = workflow.trim().toLowerCase();
  const filtered = wf
    ? raw.filter((r) => {
        const name = (r.name ?? "").toLowerCase();
        const path = (r.path ?? "").toLowerCase();
        // Match the workflow name exactly, or against the filename portion of
        // its path (".github/workflows/foo.yml" → "foo.yml"), so users can
        // copy either the display label or the workflow filename.
        const file = path.split("/").pop() ?? "";
        return name === wf || file === wf;
      })
    : raw;

  const items: FeedItem<GHActionRunMeta>[] = filtered.map((r) => {
    const actor =
      r.actor?.login ?? r.triggering_actor?.login ?? r.head_commit?.author?.name ?? "github";
    const avatarUrl =
      r.actor?.avatar_url ??
      r.triggering_actor?.avatar_url ??
      identiconUrl(actor);
    const startedAt = r.run_started_at ?? r.created_at;
    // The "completed" status carries an `updated_at` that reliably matches the
    // run-finished moment; for in-flight runs we leave duration undefined
    // rather than render a misleading partial-duration number.
    const durationMs =
      r.status === "completed"
        ? Math.max(0, Date.parse(r.updated_at) - Date.parse(startedAt))
        : undefined;
    const commitMessage = (r.head_commit?.message ?? "").split("\n")[0]?.trim();
    const title =
      r.display_title?.trim() ||
      commitMessage ||
      r.name?.trim() ||
      `Run #${r.run_number}`;
    const sha = r.head_sha ?? "";
    const shortSha = sha ? sha.slice(0, 7) : undefined;
    const workflowName = (r.name ?? "").trim() || (r.path?.split("/").pop() ?? "workflow");
    return {
      id: `ghact-${r.id}`,
      author: { name: actor, handle: actor, avatarUrl },
      content: title,
      url: r.html_url,
      // Sort key: when status is "completed" we use updated_at (finished moment),
      // otherwise we use the started timestamp so in-flight runs surface near
      // the top of the column.
      createdAt: r.status === "completed" ? r.updated_at : startedAt,
      meta: {
        kind: "run",
        repo: fullRepo,
        runId: r.id,
        runNumber: r.run_number,
        workflowName,
        workflowPath: r.path,
        status: r.status,
        conclusion: r.conclusion ?? undefined,
        branch: r.head_branch ?? undefined,
        event: r.event,
        sha,
        shortSha,
        fullRepo,
        startedAt,
        durationMs,
        commitMessage,
      },
    } satisfies FeedItem<GHActionRunMeta>;
  });

  // Page-completeness uses raw upstream length, NOT the post-filter length,
  // so workflow-name filtering doesn't prematurely terminate pagination.
  const hasMore = raw.length >= Math.min(Math.max(limit, 1), 100);
  return { items: items.slice(0, limit), hasMore };
}
