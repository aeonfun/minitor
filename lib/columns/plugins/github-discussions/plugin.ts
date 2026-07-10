import { z } from "zod";
import { MessageSquare } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

// The owner/name shape is validated at fetch time by
// `lib/integrations/github-discussions.ts:parseRepo` (same regex). Mirroring
// the validation in the schema would duplicate the source of truth; we follow
// the github-actions / github-releases pattern of letting the integration
// throw a clear error on bad input and keeping the schema permissive so empty
// defaults parse cleanly.
export const schema = z.object({
  repo: z.string().default(""),
  // recent      — newest by createdAt (server default order)
  // unanswered  — drop rows where isAnswered === true (Q&A-style filter)
  // top         — re-sort the page by upvotes desc, then comments desc
  mode: z.enum(["recent", "unanswered", "top"]).default("recent"),
});

export type GHDiscussionsConfig = z.infer<typeof schema>;

// Renderer-facing meta. Mirrors `GHDiscussionMeta` in the integration but kept
// local so the plugin owns its renderer contract. The integration's type is
// structurally identical; the cast in server.ts is documented there.
export interface GHDiscussionsMeta {
  kind: "discussion";
  repo: string;
  number: number;
  upvotes: number;
  comments: number;
  isAnswered: boolean;
  categoryName?: string;
  categoryEmojiHTML?: string;
}

export const meta: PluginMeta<GHDiscussionsConfig, GHDiscussionsMeta> = {
  id: "github-discussions",
  label: "GitHub Discussions",
  description:
    "Latest discussions for a GitHub repo — the async Q&A and community layer. Modes: recent, unanswered, or top by upvotes. Works keyless at the 60 req/hr public rate; set GITHUB_TOKEN for 5000 req/hr.",
  icon: MessageSquare,
  // Purple — picked to be visually distinct from every other GitHub-cluster
  // colour: trending #e88a4d (orange), releases #22c55e (green), issues /
  // prs #26251e (near-black), stars #f5a623 (gold), forks #9fbbe0 (pale
  // blue), search #1f2328 (charcoal), backlinks #5e6dc7 (muted indigo),
  // actions #2088ff (vivid blue). The closest in hue is farcaster
  // (#7c65c1, muted lavender) which sits in a different cluster and is
  // perceptibly less saturated than this one.
  accent: "#7C3AED",
  // Same convention as the other github-* plugins so the "Add column"
  // picker groups Discussions next to PRs / Issues / Actions.
  category: "social",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const repo = c.repo.trim();
    if (!repo) return "Discussions";
    return `${repo} Discussions`;
  },
  capabilities: {
    paginated: true,
    rateLimitHint:
      "Requires GITHUB_TOKEN — the GraphQL API gives unauthenticated requests ~0 quota (403). 5000 req/hr with one.",
  },
};
