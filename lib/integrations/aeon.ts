// Aeon integration — consumes the output an Aeon agent fork produces.
//
// Aeon (github.com/aaronjmars/aeon) is a GitHub-Actions-native agent: a cron
// scheduler dispatches skills, each run commits its results back into the repo
// and (optionally) serves them from a local dashboard. This client reads that
// output through four interchangeable sources so the column works whether or
// not the operator has the dashboard running:
//
//   dashboard-outputs  GET {baseUrl}/api/outputs  → json-render spec per run
//   dashboard-runs     GET {baseUrl}/api/runs      → gh run list, Aeon-filtered
//   github-runs        GitHub Actions API          → workflow runs on a fork
//   github-articles    GitHub Contents API         → output/articles/*.md
//
// The dashboard sources are richest (a full UI component tree per run) but are
// loopback-gated and need the local server up. The GitHub sources are always-on
// and remote, and reuse minitor's existing GitHub client.

import { fetchUpstream } from "@/lib/integrations/fetch";
import { normalizeGitHubRepo } from "@/lib/integrations/github";
import type { FeedItem } from "@/lib/columns/types";
import type { AeonMeta, AeonSpec } from "@/lib/columns/plugins/aeon/plugin";

const GITHUB_API = "https://api.github.com";

// Aeon's skill runs are the "Skill Runner" workflow. Reading them through the
// per-workflow endpoint (rather than the repo-wide run list + client filter)
// matters: the scheduler and messages workflows fire far more often, so a
// repo-wide page would bury skill runs entirely.
const AEON_WORKFLOW_FILE = "aeon.yml";

export type AeonItem = FeedItem<AeonMeta>;

// ---- Dashboard API response shapes ----------------------------------------

interface DashboardOutput {
  filename: string;
  skill: string;
  timestamp: string; // ISO 8601 (the route converts the file stamp back to ISO)
  spec: AeonSpec;
}
interface OutputsResponse {
  outputs?: DashboardOutput[];
  error?: string;
}

interface DashboardRun {
  id: number;
  workflow: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  url: string;
}
interface RunsResponse {
  runs?: DashboardRun[];
  error?: string;
}

// ---- Spec helpers ---------------------------------------------------------

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Best-effort display title: the root Card's title, else the first Heading. */
function specTitle(spec: AeonSpec): string {
  const rootEl = spec.elements[spec.root];
  const rootTitle = asString(rootEl?.props?.title);
  if (rootTitle) return rootTitle;
  for (const el of Object.values(spec.elements)) {
    if (el.type === "Heading") {
      const t = asString(el.props?.text);
      if (t) return t;
    }
  }
  return "";
}

/**
 * Flatten every human-readable string in a spec into one blob. Used as the
 * FeedItem `content` so minitor's client-side alert / filter keyword matching
 * (which scans author + content + url) works over an output card's text.
 */
function specPlainText(spec: AeonSpec): string {
  const parts: string[] = [];
  for (const el of Object.values(spec.elements)) {
    const p = el.props ?? {};
    for (const key of ["title", "description", "text", "label", "value", "message", "source"]) {
      const s = asString(p[key]);
      if (s) parts.push(s);
    }
    // Table rows: string[][]
    if (Array.isArray(p.rows)) {
      for (const row of p.rows) {
        if (Array.isArray(row)) parts.push(row.map(asString).filter(Boolean).join(" "));
      }
    }
    if (Array.isArray(p.columns)) parts.push(p.columns.map(asString).filter(Boolean).join(" "));
  }
  return parts.join(" · ").slice(0, 4000);
}

function skillMatches(skill: string, filter: string): boolean {
  const f = filter.trim().toLowerCase();
  if (!f) return true;
  return skill.toLowerCase().includes(f);
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "http://localhost:5555";
  return /^https?:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`;
}

// ---- Sources --------------------------------------------------------------

// GET a JSON endpoint on the Aeon dashboard, converting both a network-level
// failure (dashboard down / wrong port) and an HTTP error into an actionable
// message — the dashboard-not-running case is by far the most common.
async function getDashboardJson<T>(baseUrl: string, path: string): Promise<T> {
  const base = normalizeBaseUrl(baseUrl);
  let res: Response;
  try {
    res = await fetchUpstream(
      `${base}${path}`,
      { headers: { accept: "application/json" }, cache: "no-store" },
      { label: "aeon-dashboard" },
    );
  } catch {
    throw new Error(
      `Can't reach the Aeon dashboard at ${base}. Start it with ./aeon in your fork (default http://localhost:5555).`,
    );
  }
  if (!res.ok) throw new Error(dashboardError(res.status));
  return (await res.json()) as T;
}

/** dashboard-outputs — the rich json-render feed. Not paginated (route caps 100). */
export async function fetchAeonOutputs(
  baseUrl: string,
  skill: string,
): Promise<AeonItem[]> {
  const json = await getDashboardJson<OutputsResponse>(baseUrl, "/api/outputs");
  if (json.error) throw new Error(json.error);
  const outputs = (json.outputs ?? []).filter((o) => skillMatches(o.skill, skill));
  return outputs.map((o) => ({
    id: `aeon-out-${o.filename}`,
    author: { name: o.skill || "aeon" },
    content: specTitle(o.spec) || specPlainText(o.spec) || o.skill,
    url: normalizeBaseUrl(baseUrl),
    createdAt: o.timestamp || new Date().toISOString(),
    meta: {
      kind: "output",
      source: "dashboard-outputs",
      skill: o.skill,
      spec: o.spec,
    },
  }));
}

/** dashboard-runs — gh run list, already filtered to Aeon-launched events. */
export async function fetchAeonDashboardRuns(
  baseUrl: string,
  skill: string,
): Promise<AeonItem[]> {
  const json = await getDashboardJson<RunsResponse>(baseUrl, "/api/runs");
  if (json.error) throw new Error(json.error);
  const runs = (json.runs ?? []).filter((r) => skillMatches(r.workflow, skill));
  return runs.map((r) => ({
    id: `aeon-run-${r.id}`,
    author: { name: r.workflow || "aeon" },
    content: r.workflow || `Run ${r.id}`,
    url: r.url,
    createdAt: r.created_at,
    meta: {
      kind: "run",
      source: "dashboard-runs",
      skill: r.workflow,
      status: r.status,
      conclusion: r.conclusion,
    },
  }));
}

function dashboardError(status: number): string {
  if (status === 403) {
    return "Aeon dashboard refused the request (loopback-only). Run minitor and the dashboard on the same machine, or set AEON_DASHBOARD_ALLOWED_HOSTS in the Aeon fork.";
  }
  if (status === 404) {
    return "Aeon dashboard reachable but /api route missing — check the base URL and that the dashboard is up to date.";
  }
  return `Aeon dashboard returned ${status}. Is it running? (default http://localhost:5555)`;
}

// Minimal shape of a GitHub Actions run object (both the repo-wide and the
// per-workflow endpoints return this).
interface GHRun {
  id: number;
  run_number: number;
  name?: string | null;
  display_title?: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  run_started_at?: string;
  updated_at: string;
  event?: string;
  head_branch?: string | null;
  head_sha?: string;
  actor?: { login?: string; avatar_url?: string } | null;
  triggering_actor?: { login?: string; avatar_url?: string } | null;
  head_commit?: { message?: string; author?: { name?: string } } | null;
}
interface GHWorkflowRunsResponse {
  total_count?: number;
  workflow_runs?: GHRun[];
  message?: string;
}

/**
 * github-runs — the Skill Runner (aeon.yml) workflow's runs on a fork, via the
 * per-workflow runs endpoint so skill runs aren't buried under the far more
 * frequent scheduler / messages runs.
 */
export async function fetchAeonSkillRuns(
  repo: string,
  limit: number,
  page: number,
): Promise<{ items: AeonItem[]; hasMore: boolean }> {
  const fullRepo = normalizeGitHubRepo(repo);
  const params = new URLSearchParams({
    per_page: String(Math.min(Math.max(limit, 1), 100)),
    page: String(Math.max(page, 1)),
  });
  const url = `${GITHUB_API}/repos/${fullRepo}/actions/workflows/${AEON_WORKFLOW_FILE}/runs?${params}`;
  const res = await fetchUpstream(url, { headers: ghHeaders(), cache: "no-store" });
  if (res.status === 404) {
    // Fork without the Skill Runner workflow (or Actions disabled) — empty feed.
    return { items: [], hasMore: false };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as GHWorkflowRunsResponse;
  if (json.message) throw new Error(json.message);
  const runs = json.workflow_runs ?? [];

  const items: AeonItem[] = runs.map((r) => {
    const startedAt = r.run_started_at ?? r.created_at;
    const durationMs =
      r.status === "completed"
        ? Math.max(0, Date.parse(r.updated_at) - Date.parse(startedAt))
        : undefined;
    const commitMessage = (r.head_commit?.message ?? "").split("\n")[0]?.trim();
    const title =
      r.display_title?.trim() ||
      commitMessage ||
      (r.name ?? "").trim() ||
      `Run #${r.run_number}`;
    const sha = r.head_sha ?? "";
    const actor =
      r.actor?.login ??
      r.triggering_actor?.login ??
      r.head_commit?.author?.name ??
      "aeon";
    return {
      id: `aeon-run-${r.id}`,
      author: {
        name: actor,
        handle: r.actor?.login,
        avatarUrl: r.actor?.avatar_url,
      },
      content: title,
      url: r.html_url,
      // Completed runs sort by finish time; in-flight ones by start time.
      createdAt: r.status === "completed" ? r.updated_at : startedAt,
      meta: {
        kind: "run",
        source: "github-runs",
        skill: (r.name ?? "").trim() || "Skill Runner",
        status: r.status,
        conclusion: r.conclusion,
        runNumber: r.run_number,
        branch: r.head_branch ?? undefined,
        shortSha: sha ? sha.slice(0, 7) : undefined,
        durationMs,
        event: r.event,
        fullRepo,
      },
    };
  });

  const total = json.total_count;
  const hasMore =
    total != null ? Math.max(page, 1) * limit < total : items.length >= limit;
  return { items, hasMore };
}

// ---- github-articles ------------------------------------------------------

interface GHContentEntry {
  name: string;
  path: string;
  sha: string;
  html_url: string | null;
  download_url: string | null;
  type: "file" | "dir" | string;
}

function ghHeaders(): HeadersInit {
  const h: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "minitor/0.1",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

// "workflow-audit-2026-04-11.md" → { title: "Workflow audit", date: "2026-04-11" }
function parseArticleName(name: string): { title: string; date?: string } {
  const base = name.replace(/\.md$/i, "");
  const dateMatch = base.match(/(\d{4}-\d{2}-\d{2})$/);
  const date = dateMatch?.[1];
  const slug = date ? base.slice(0, base.length - date.length).replace(/-+$/, "") : base;
  const words = slug.replace(/[-_]+/g, " ").trim();
  const title = words ? words.charAt(0).toUpperCase() + words.slice(1) : base;
  return { title, date };
}

/**
 * github-articles — long-form artifacts skills commit under output/articles/.
 * Titles/dates are derived from the filename to stay within one API call (the
 * real H1 lives inside each file; fetching all of them would burn rate limit).
 * Paginated client-side over the directory listing, newest first.
 */
export async function fetchAeonArticles(
  repo: string,
  limit: number,
  page: number,
): Promise<{ items: AeonItem[]; hasMore: boolean }> {
  const fullRepo = normalizeGitHubRepo(repo);
  const url = `${GITHUB_API}/repos/${fullRepo}/contents/output/articles`;
  const res = await fetchUpstream(url, { headers: ghHeaders(), cache: "no-store" });
  if (res.status === 404) {
    // No articles dir (or empty fork) — treat as an empty feed, not an error.
    return { items: [], hasMore: false };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  const entries = (await res.json()) as GHContentEntry[];
  const files = (Array.isArray(entries) ? entries : [])
    .filter((e) => e.type === "file" && /\.md$/i.test(e.name) && e.name !== ".gitkeep")
    .map((e) => {
      const { title, date } = parseArticleName(e.name);
      const createdAt = date ? `${date}T00:00:00Z` : new Date().toISOString();
      return { entry: e, title, createdAt };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const start = (Math.max(page, 1) - 1) * limit;
  const slice = files.slice(start, start + limit);
  const items: AeonItem[] = slice.map(({ entry, title, createdAt }) => ({
    id: `aeon-article-${entry.sha}`,
    author: { name: fullRepo.split("/")[0] || "aeon" },
    content: title,
    url: entry.html_url ?? entry.download_url ?? undefined,
    createdAt,
    meta: { kind: "article", source: "github-articles", skill: entry.name },
  }));
  return { items, hasMore: start + limit < files.length };
}
