// Separate from the `github` plugin: that one is feed-style (trending /
// releases / issue search). This one is mention-monitoring — free-form
// keyword/URL search across repos, issues, code, and commits with one
// switchable scope. Different config form, different renderer concerns.

import { z } from "zod";
import { SearchCode } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

export const schema = z.object({
  scope: z.enum(["repositories", "issues", "code", "commits"]).default("issues"),
  query: z.string().default(""),
});

export type GHSearchConfig = z.infer<typeof schema>;

export interface GHSearchMeta {
  scope: "repositories" | "issues" | "code" | "commits";
  repo?: string;
  stars?: number;
  forks?: number;
  language?: string;
  number?: number;
  state?: string;
  comments?: number;
  isPr?: boolean;
  path?: string;
  sha?: string;
}

const SCOPE_LABEL: Record<GHSearchConfig["scope"], string> = {
  repositories: "Repos",
  issues: "Issues / PRs",
  code: "Code",
  commits: "Commits",
};

export const meta: PluginMeta<GHSearchConfig, GHSearchMeta> = {
  id: "github-search",
  label: "GitHub search",
  description:
    "Watch GitHub for mentions of a keyword or URL across repos, issues, code, or commits.",
  icon: SearchCode,
  accent: "#1f2328",
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const label = SCOPE_LABEL[c.scope];
    const q = c.query.trim();
    return q ? `GH ${label} · ${q}` : `GitHub · ${label}`;
  },
  capabilities: {
    paginated: true,
    // GITHUB_TOKEN is genuinely optional — fetcher upgrades automatically when
    // it's set — so it's not in requiresEnv (which renders as "Requires:" in UI).
    rateLimitHint: "60 req/hr without GITHUB_TOKEN, 5000 with. Code search requires the token.",
  },
};
