import { z } from "zod";
import { Workflow } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  repo: z.string().default(""),
  // Optional workflow filter. Match by display name (e.g. "CI") OR by the
  // filename of `.github/workflows/<file>.yml` — whichever the user pastes.
  // Empty = show every workflow on the repo.
  workflow: z.string().default(""),
  // Optional branch filter, passed to the Actions API as `?branch=`. Exact
  // match only; the API rejects partials.
  branch: z.string().default(""),
});

export type GHActionsConfig = z.infer<typeof schema>;

export type GHActionStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "waiting"
  | "pending"
  | "requested";

export type GHActionConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "neutral"
  | "skipped"
  | "timed_out"
  | "action_required"
  | "stale"
  | "startup_failure";

export interface GHActionsMeta {
  kind: "run";
  repo: string;
  runId: number;
  runNumber: number;
  workflowName: string;
  workflowPath?: string;
  status: GHActionStatus;
  /** undefined while status != "completed" */
  conclusion?: GHActionConclusion;
  branch?: string;
  event?: string;
  sha?: string;
  shortSha?: string;
  /** "<owner>/<repo>" form; useful for the renderer when displaying the row */
  fullRepo: string;
  startedAt?: string;
  /** Duration in ms; undefined when the run hasn't ended yet */
  durationMs?: number;
  /** Commit message first-line, when available */
  commitMessage?: string;
}

export const meta: PluginMeta<GHActionsConfig, GHActionsMeta> = {
  id: "github-actions",
  label: "GitHub Actions",
  description:
    "Live workflow runs for a GitHub repository — status, conclusion, branch, commit, and duration. Optional workflow + branch filters.",
  icon: Workflow,
  // GitHub Actions brand blue — the swatch used on the Actions tab badge.
  accent: "#2088FF",
  // Sits alongside the other github-* plugins. The wider GitHub cluster uses
  // "social" by convention; we follow it here so the "Add column" picker
  // groups Actions next to PRs / Releases / Issues rather than orphaning it.
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const repo = c.repo.trim();
    const wf = c.workflow.trim();
    const branch = c.branch.trim();
    if (!repo) return "GitHub · Actions";
    const head = wf ? `Actions · ${repo} · ${wf}` : `Actions · ${repo}`;
    return branch ? `${head} (${branch})` : head;
  },
  capabilities: {
    paginated: true,
    rateLimitHint: "60 req/hr without GITHUB_TOKEN, 5000 with.",
  },
};
