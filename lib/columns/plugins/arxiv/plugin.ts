import { z } from "zod";
import { BookOpen } from "lucide-react";
import type { PluginMeta } from "@/lib/columns/types";

const CATEGORIES = [
  "cs.AI",
  "cs.CL",
  "cs.LG",
  "cs.CV",
  "cs.RO",
  "cs.CR",
  "cs.DC",
  "cs.NE",
  "cs.SE",
  "cs.PL",
  "stat.ML",
  "math.OC",
] as const;

export const schema = z.object({
  category: z.enum(CATEGORIES).default("cs.AI"),
  mode: z.enum(["recent", "updated"]).default("recent"),
  search: z.string().default(""),
});

export type ArxivConfig = z.infer<typeof schema>;

export interface ArxivMeta {
  // Primary category as reported by arXiv (often more specific than the
  // user's filter — a cs.AI paper might primary-cat as cs.LG when it's more
  // ML than agentic, useful signal for the renderer).
  primaryCategory: string;
  categories: string[];
  authors: string[];
  abstract: string;
  pdfUrl?: string;
  arxivId: string;
  publishedAt: string;
  updatedAt: string;
  // Distinguishes a freshly published paper from a v2/v3 revision — useful
  // for picking out genuinely new work in `updated` mode.
  isRevision: boolean;
  // Free-form `<arxiv:comment>` from the Atom entry. Authors typically use it
  // for venue acceptance ("Accepted to ICML 2026", "SIGGRAPH 2026"), code
  // links ("Code: https://github.com/..."), or page count ("33 pages"). ~56%
  // of recent cs.LG entries populate it; the renderer hides the line when
  // empty.
  comment?: string;
}

const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  "cs.AI": "Artificial Intelligence",
  "cs.CL": "Computation & Language",
  "cs.LG": "Machine Learning",
  "cs.CV": "Computer Vision",
  "cs.RO": "Robotics",
  "cs.CR": "Cryptography & Security",
  "cs.DC": "Distributed Computing",
  "cs.NE": "Neural & Evolutionary",
  "cs.SE": "Software Engineering",
  "cs.PL": "Programming Languages",
  "stat.ML": "Statistical ML",
  "math.OC": "Optimization & Control",
};

const MODE_LABELS: Record<ArxivConfig["mode"], string> = {
  recent: "Newest submissions",
  updated: "Recently updated",
};

export const meta: PluginMeta<ArxivConfig, ArxivMeta> = {
  id: "arxiv",
  label: "arXiv",
  description:
    "Newest or recently-updated papers from a CS / stat / math.OC category — optionally filtered by a title/abstract keyword.",
  icon: BookOpen,
  // Cornell red — the brand colour arXiv has used since the move from LANL
  // to Cornell. Distinct from the existing palette so an arXiv column reads
  // at a glance in a packed deck (huggingface yellow #FFD21F is the closest
  // adjacent AI/ML accent and is far enough away on the wheel).
  accent: "#B31B1B",
  category: "ai",
  schema,
  defaultConfig: schema.parse({}),
  defaultTitle: (c) => {
    const search = c.search.trim();
    if (search) return `arXiv · ${c.category} · ${search}`;
    return `arXiv · ${c.category} · ${MODE_LABELS[c.mode]}`;
  },
  capabilities: { paginated: true },
};

export const ARXIV_CATEGORIES = CATEGORIES;
export const ARXIV_CATEGORY_LABELS = CATEGORY_LABELS;
