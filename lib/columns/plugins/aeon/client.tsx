"use client";

import {
  Bot,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  CircleSlash,
  GitBranch,
  Hash,
  FileText,
  Heart,
  Repeat2,
} from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  defineColumnUI,
  type ConfigFormProps,
  type ItemRendererProps,
} from "@/lib/columns/types";
import {
  meta,
  type AeonConfig,
  type AeonMeta,
  type AeonSpec,
  type AeonSpecElement,
} from "./plugin";

// ---- Config form ----------------------------------------------------------

const SOURCE_LABELS: Record<AeonConfig["source"], string> = {
  "github-runs": "Workflow runs (GitHub)",
  "github-articles": "Articles (GitHub)",
  "dashboard-outputs": "Feed cards (dashboard)",
  "dashboard-runs": "Runs (dashboard)",
};

function ConfigForm({ value, onChange }: ConfigFormProps<AeonConfig>) {
  const isGithub =
    value.source === "github-runs" || value.source === "github-articles";
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Source</Label>
        <Select
          value={value.source}
          onValueChange={(v) =>
            onChange({ ...value, source: v as AeonConfig["source"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="github-runs">
              {SOURCE_LABELS["github-runs"]}
            </SelectItem>
            <SelectItem value="github-articles">
              {SOURCE_LABELS["github-articles"]}
            </SelectItem>
            <SelectItem value="dashboard-outputs">
              {SOURCE_LABELS["dashboard-outputs"]}
            </SelectItem>
            <SelectItem value="dashboard-runs">
              {SOURCE_LABELS["dashboard-runs"]}
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          GitHub sources read a fork remotely. Dashboard sources need the local
          Aeon dashboard running — the <code>Feed cards</code> source is the
          rich, per-run view.
        </p>
      </div>

      {isGithub ? (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="aeon-repo">Repository</Label>
            <Input
              id="aeon-repo"
              placeholder="your-username/aeon"
              value={value.repo}
              onChange={(e) => onChange({ ...value, repo: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              <code>owner/repo</code> of your Aeon fork.
            </p>
          </div>
          {value.source === "github-runs" && (
            <div className="grid gap-1.5">
              <Label htmlFor="aeon-workflow">Workflow (optional)</Label>
              <Input
                id="aeon-workflow"
                placeholder="aeon.yml"
                value={value.workflow}
                onChange={(e) =>
                  onChange({ ...value, workflow: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Filter to one workflow — <code>aeon.yml</code> is the skill
                runner. Empty = every workflow.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="aeon-base">Dashboard URL</Label>
            <Input
              id="aeon-base"
              placeholder="http://localhost:5555"
              value={value.baseUrl}
              onChange={(e) => onChange({ ...value, baseUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Where <code>./aeon</code> serves the dashboard. Must be reachable
              from this machine.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="aeon-skill">Skill (optional)</Label>
            <Input
              id="aeon-skill"
              placeholder="digest, onchain-monitor..."
              value={value.skill}
              onChange={(e) => onChange({ ...value, skill: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Substring filter on the skill name. Empty = every skill.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Run + article rendering ----------------------------------------------

function StatusPill({ meta: m }: { meta: AeonMeta }) {
  const status = m.status ?? "";
  const conclusion = m.conclusion ?? "";
  if (status === "in_progress") {
    return (
      <Pill bg="rgba(32,136,255,0.18)" color="#2088FF">
        <Loader2 className="size-3 animate-spin" />
        running
      </Pill>
    );
  }
  if (
    status === "queued" ||
    status === "waiting" ||
    status === "pending" ||
    status === "requested"
  ) {
    return (
      <Pill bg="rgba(245,158,11,0.18)" color="#b45309">
        <Clock className="size-3" />
        {status}
      </Pill>
    );
  }
  if (conclusion === "success") {
    return (
      <Pill bg="rgba(16,185,129,0.18)">
        <CheckCircle2 className="size-3" style={{ color: "#10b981" }} />
        success
      </Pill>
    );
  }
  if (conclusion === "failure" || conclusion === "startup_failure") {
    return (
      <Pill bg="rgba(239,68,68,0.20)">
        <XCircle className="size-3" style={{ color: "#ef4444" }} />
        failure
      </Pill>
    );
  }
  const label = conclusion || status || "unknown";
  return (
    <Pill bg="rgba(156,163,175,0.18)">
      <CircleSlash className="size-3" style={{ color: "#9ca3af" }} />
      {label}
    </Pill>
  );
}

function Pill({
  children,
  bg,
  color,
}: {
  children: React.ReactNode;
  bg: string;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-foreground/90"
      style={{ backgroundColor: bg, color }}
    >
      {children}
    </span>
  );
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

function RunRenderer({ item }: ItemRendererProps<AeonMeta>) {
  const m = item.meta!;
  const duration = m.durationMs != null ? formatDuration(m.durationMs) : "";
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <StatusPill meta={m} />
        <span className="truncate font-medium text-foreground/80">
          {m.skill ?? "aeon"}
        </span>
        {m.runNumber != null && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums">#{m.runNumber}</span>
          </>
        )}
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
      </div>
      <h3 className="mt-1 text-[13px] leading-snug text-foreground break-words">
        {item.content}
      </h3>
      {(m.branch || m.shortSha || duration || m.event) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
          {m.branch && (
            <span className="flex items-center gap-1">
              <GitBranch className="size-3.5" />
              <span className="truncate">{m.branch}</span>
            </span>
          )}
          {m.shortSha && (
            <span className="flex items-center gap-1">
              <Hash className="size-3.5" />
              <span className="font-mono text-[11px]">{m.shortSha}</span>
            </span>
          )}
          {duration && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              <span className="tabular-nums">{duration}</span>
            </span>
          )}
          {m.event && (
            <span className="rounded-sm px-1 py-0.5 text-[10px] ring-1 ring-border/60">
              {m.event}
            </span>
          )}
        </div>
      )}
    </a>
  );
}

function ArticleRenderer({ item }: ItemRendererProps<AeonMeta>) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex items-center gap-x-1.5 text-[11px] text-muted-foreground">
        <FileText className="size-3.5" />
        <span className="truncate">{item.author.name}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
      </div>
      <h3 className="mt-1 font-serif text-[16px] leading-[1.3] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand-hover)]">
        {item.content}
      </h3>
    </a>
  );
}

// ---- json-render spec rendering (the rich dashboard-outputs view) ---------

const s = (v: unknown): string => (typeof v === "string" ? v : "");
const n = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const GAP: Record<string, string> = { sm: "gap-1.5", md: "gap-3", lg: "gap-5" };

const BADGE_VARIANT: Record<string, string> = {
  default: "bg-foreground/10 text-foreground/80",
  secondary: "bg-muted text-muted-foreground",
  destructive: "bg-red-500/15 text-red-500",
  outline: "ring-1 ring-border text-muted-foreground",
};

const ALERT_VARIANT: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  error: "bg-red-500/10 text-red-600 dark:text-red-400",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

// Walk the spec from an element id. `elements` is a flat id→node map; children
// are id references. A visited set + depth cap defends against cyclic or
// pathologically deep specs (the generator is an LLM, so don't trust the tree).
function SpecNode({
  id,
  spec,
  seen,
  depth,
}: {
  id: string;
  spec: AeonSpec;
  seen: Set<string>;
  depth: number;
}) {
  if (depth > 40 || seen.has(id)) return null;
  const el: AeonSpecElement | undefined = spec.elements[id];
  if (!el) return null;
  const next = new Set(seen).add(id);
  const p = el.props ?? {};
  const kids = (el.children ?? []).map((cid) => (
    <SpecNode key={cid} id={cid} spec={spec} seen={next} depth={depth + 1} />
  ));

  switch (el.type) {
    case "Card":
      return (
        <div className="grid gap-2 rounded-md border border-border/60 p-2.5">
          {s(p.title) && (
            <div className="text-[12.5px] font-semibold text-foreground">
              {s(p.title)}
            </div>
          )}
          {s(p.description) && (
            <div className="text-[11.5px] text-muted-foreground">
              {s(p.description)}
            </div>
          )}
          {kids}
        </div>
      );
    case "Stack":
      return (
        <div
          className={`flex ${p.direction === "horizontal" ? "flex-row flex-wrap items-center" : "flex-col"} ${GAP[s(p.gap)] ?? "gap-2"}`}
        >
          {kids}
        </div>
      );
    case "Grid":
      return (
        <div
          className={`grid ${GAP[s(p.gap)] ?? "gap-2"}`}
          style={{
            gridTemplateColumns: `repeat(${Math.min(Math.max(n(p.columns) ?? 2, 1), 4)}, minmax(0, 1fr))`,
          }}
        >
          {kids}
        </div>
      );
    case "Separator":
      return <div className="my-1 h-px w-full bg-border" />;
    case "Heading": {
      const level = s(p.level) || "h3";
      const size =
        level === "h1"
          ? "text-[15px]"
          : level === "h2"
            ? "text-[14px]"
            : "text-[13px]";
      return (
        <div className={`${size} font-semibold text-foreground`}>
          {s(p.text)}
        </div>
      );
    }
    case "Text":
      return (
        <p
          className={`text-[12px] ${p.variant === "muted" || p.variant === "caption" ? "text-muted-foreground" : "text-foreground/90"} ${p.variant === "lead" ? "font-medium" : ""}`}
        >
          {s(p.text)}
        </p>
      );
    case "Badge":
      return (
        <span
          className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${BADGE_VARIANT[s(p.variant)] ?? BADGE_VARIANT.default}`}
        >
          {s(p.text)}
        </span>
      );
    case "Link":
      return s(p.href) ? (
        <a
          href={s(p.href)}
          target="_blank"
          rel="noreferrer"
          className="w-fit text-[12px] text-[color:var(--brand)] underline underline-offset-2 hover:opacity-80"
        >
          {s(p.label) || s(p.href)}
        </a>
      ) : (
        <span className="text-[12px]">{s(p.label)}</span>
      );
    case "Stat":
      return (
        <div className="grid gap-0.5">
          {s(p.label) && (
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
              {s(p.label)}
            </div>
          )}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[18px] font-semibold tabular-nums text-foreground">
              {s(p.value)}
            </span>
            {s(p.delta) && (
              <span
                className={`text-[11px] font-medium ${p.trend === "up" ? "text-emerald-500" : p.trend === "down" ? "text-red-500" : "text-muted-foreground"}`}
              >
                {s(p.delta)}
              </span>
            )}
          </div>
        </div>
      );
    case "Progress": {
      const max = n(p.max) ?? 100;
      const val = Math.max(0, Math.min(n(p.value) ?? 0, max));
      const pct = max > 0 ? Math.round((val / max) * 100) : 0;
      return (
        <div className="grid gap-1">
          {s(p.label) && (
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{s(p.label)}</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
          )}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[color:var(--brand)]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      );
    }
    case "Table": {
      const cols = Array.isArray(p.columns) ? p.columns.map(s) : [];
      const rows = Array.isArray(p.rows) ? p.rows : [];
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            {cols.length > 0 && (
              <thead>
                <tr className="text-left text-muted-foreground">
                  {cols.map((c, i) => (
                    <th key={i} className="py-1 pr-3 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t border-border/50">
                  {(Array.isArray(row) ? row : []).map((cell, ci) => (
                    <td key={ci} className="py-1 pr-3 text-foreground/90">
                      {s(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "StoryLink":
      return (
        <a
          href={s(p.href)}
          target="_blank"
          rel="noreferrer"
          className="group/story block rounded-md px-1.5 py-1 transition-colors hover:bg-surface/60"
        >
          <div className="text-[12.5px] font-medium text-foreground group-hover/story:text-[color:var(--brand-hover)]">
            {s(p.title)}
          </div>
          {(s(p.source) || s(p.score)) && (
            <div className="text-[11px] text-muted-foreground">
              {[s(p.source), s(p.score)].filter(Boolean).join(" · ")}
            </div>
          )}
        </a>
      );
    case "TweetCard":
      return (
        <div className="grid gap-1 rounded-md border border-border/60 p-2">
          <div className="text-[11.5px] text-muted-foreground">
            <span className="font-medium text-foreground/80">{s(p.author)}</span>
            {s(p.handle) && <span> @{s(p.handle)}</span>}
          </div>
          <p className="text-[12px] text-foreground/90">{s(p.text)}</p>
          {(n(p.likes) != null || n(p.retweets) != null) && (
            <div className="flex gap-3 text-[10.5px] text-muted-foreground">
              {n(p.likes) != null && (
                <span className="flex items-center gap-1">
                  <Heart className="size-3" />
                  {n(p.likes)}
                </span>
              )}
              {n(p.retweets) != null && (
                <span className="flex items-center gap-1">
                  <Repeat2 className="size-3" />
                  {n(p.retweets)}
                </span>
              )}
            </div>
          )}
        </div>
      );
    case "Alert":
      return (
        <div
          className={`grid gap-0.5 rounded-md px-2.5 py-2 text-[11.5px] ${ALERT_VARIANT[s(p.type)] ?? ALERT_VARIANT.info}`}
        >
          {s(p.title) && <div className="font-semibold">{s(p.title)}</div>}
          {s(p.message) && <div>{s(p.message)}</div>}
        </div>
      );
    case "Button":
      return (
        <span className="inline-flex w-fit items-center rounded-md bg-foreground/10 px-2.5 py-1 text-[11.5px] font-medium text-foreground/80">
          {s(p.label)}
        </span>
      );
    default:
      // Unknown component type — render its children so the tree isn't lost.
      return kids.length ? <div className="grid gap-2">{kids}</div> : null;
  }
}

function OutputRenderer({ item }: ItemRendererProps<AeonMeta>) {
  const m = item.meta!;
  const spec = m.spec;
  return (
    <article className="border-b border-border px-3.5 py-3">
      <div className="mb-2 flex items-center gap-x-1.5 text-[11px] text-muted-foreground">
        <Bot className="size-3.5" />
        <span className="truncate font-medium text-foreground/80">
          {m.skill ?? "aeon"}
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
      </div>
      {spec ? (
        <SpecNode id={spec.root} spec={spec} seen={new Set()} depth={0} />
      ) : (
        <p className="text-[12px] text-foreground/90">{item.content}</p>
      )}
    </article>
  );
}

// ---- Dispatch -------------------------------------------------------------

function ItemRenderer(props: ItemRendererProps<AeonMeta>) {
  const kind = props.item.meta?.kind;
  if (kind === "output") return <OutputRenderer {...props} />;
  if (kind === "article") return <ArticleRenderer {...props} />;
  return <RunRenderer {...props} />;
}

export const column = defineColumnUI<AeonConfig, AeonMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
