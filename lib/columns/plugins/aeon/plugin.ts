import { z } from "zod";
import { Bot } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

// Aeon (github.com/aeonfun/aeon) is an autonomous agent that runs "skills"
// on a cron and commits the results back into its repo. This column surfaces
// that output. Four interchangeable sources, so it works whether the operator
// runs the local Aeon dashboard or only has the GitHub fork:
//   dashboard-outputs  rich json-render card per skill run (dashboard up)
//   dashboard-runs     recent Aeon-launched workflow runs   (dashboard up)
//   github-runs        Skill Runner (aeon.yml) runs on a fork (GitHub API)
//   github-articles    output/articles/*.md long-form pieces (GitHub API)
export const AEON_SOURCES = [
  "dashboard-outputs",
  "dashboard-runs",
  "github-runs",
  "github-articles",
] as const;

export type AeonSource = (typeof AEON_SOURCES)[number];

export const schema = z.object({
  source: z.enum(AEON_SOURCES).default("github-runs"),
  /** owner/repo of an Aeon fork — github-runs / github-articles. */
  repo: z.string().default(""),
  /** Aeon dashboard base URL — dashboard-outputs / dashboard-runs. */
  baseUrl: z.string().default("http://localhost:5555"),
  /** dashboard-*: substring filter on the skill / workflow name. */
  skill: z.string().default(""),
});

export type AeonConfig = z.infer<typeof schema>;

// ---- Renderer contract ----------------------------------------------------

/** One node of an Aeon json-render spec (aeon scripts/notify-jsonrender.sh). */
export interface AeonSpecElement {
  type: string;
  props?: Record<string, unknown>;
  children?: string[];
}

/** A json-render spec: a root id + a flat id→element map. */
export interface AeonSpec {
  root: string;
  state?: Record<string, unknown>;
  elements: Record<string, AeonSpecElement>;
}

export interface AeonMeta {
  kind: "output" | "run" | "article";
  source: AeonSource;
  /** Skill (outputs/articles) or workflow display name (runs). */
  skill?: string;
  // run fields (dashboard-runs + github-runs)
  status?: string;
  conclusion?: string | null;
  runNumber?: number;
  branch?: string;
  shortSha?: string;
  durationMs?: number;
  event?: string;
  fullRepo?: string;
  // output field (dashboard-outputs)
  spec?: AeonSpec;
}

export const meta: PluginMeta<AeonConfig, AeonMeta> = {
  id: "aeon",
  label: "Aeon",
  description:
    "Output from an Aeon agent — rich per-run cards, Skill Runner runs, and long-form articles from a fork or the local dashboard.",
  icon: Bot,
  // Aeon brand near-black; the "ai" category groups it with the other agent /
  // model columns in the Add-column picker.
  accent: "#111111",
  category: "ai",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    switch (c.source) {
      case "dashboard-outputs":
      case "dashboard-runs": {
        const s = c.skill.trim();
        return s ? `Aeon · ${s}` : "Aeon";
      }
      case "github-articles": {
        const r = c.repo.trim();
        return r ? `Aeon · articles · ${r}` : "Aeon · articles";
      }
      case "github-runs":
      default: {
        const r = c.repo.trim();
        return r ? `Aeon · ${r}` : "Aeon · runs";
      }
    }
  },
  capabilities: {
    // github-* sources page 10 at a time; dashboard-* return one batch.
    paginated: true,
    refreshIntervalHintMs: 5 * 60_000,
    rateLimitHint:
      "GitHub sources: 60 req/hr keyless, 5000 with GITHUB_TOKEN. Dashboard sources need the local Aeon dashboard running (default http://localhost:5555).",
  },
};
