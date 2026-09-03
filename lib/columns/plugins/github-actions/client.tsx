"use client";

import {
  CheckCircle2,
  XCircle,
  CircleSlash,
  Loader2,
  AlertTriangle,
  Clock,
  GitBranch,
  Hash,
} from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { meta, type GHActionsConfig, type GHActionsMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<GHActionsConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="gha-repo">Repository</Label>
        <Input
          id="gha-repo"
          placeholder="vercel/next.js"
          value={value.repo}
          onChange={(e) => onChange({ ...value, repo: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          <code>owner/repo</code> or full GitHub URL.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="gha-workflow">Workflow (optional)</Label>
        <Input
          id="gha-workflow"
          placeholder="CI · or ci.yml"
          value={value.workflow}
          onChange={(e) => onChange({ ...value, workflow: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Match by workflow display name (e.g. <code>CI</code>) or the file inside{" "}
          <code>.github/workflows/</code> (e.g. <code>ci.yml</code>). Empty = every workflow.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="gha-branch">Branch (optional)</Label>
        <Input
          id="gha-branch"
          placeholder="main"
          value={value.branch}
          onChange={(e) => onChange({ ...value, branch: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Exact branch match only — the API doesn&apos;t support partials. Empty = every branch.
        </p>
      </div>
    </div>
  );
}

interface ConclusionStyle {
  Icon: typeof CheckCircle2;
  iconColor: string;
  ringBg: string;
  label: string;
}

// One pill per terminal conclusion. Pending / in-flight runs are rendered
// separately so the colour pop is reserved for finished outcomes — that's
// what the user actually scans for ("did it break?").
const CONCLUSION_STYLES: Record<NonNullable<GHActionsMeta["conclusion"]>, ConclusionStyle> = {
  success: {
    Icon: CheckCircle2,
    iconColor: "#10b981",
    ringBg: "rgba(16, 185, 129, 0.18)",
    label: "success",
  },
  failure: {
    Icon: XCircle,
    iconColor: "#ef4444",
    ringBg: "rgba(239, 68, 68, 0.20)",
    label: "failure",
  },
  cancelled: {
    Icon: CircleSlash,
    iconColor: "#9ca3af",
    ringBg: "rgba(156, 163, 175, 0.18)",
    label: "cancelled",
  },
  neutral: {
    Icon: CircleSlash,
    iconColor: "#9ca3af",
    ringBg: "rgba(156, 163, 175, 0.18)",
    label: "neutral",
  },
  skipped: {
    Icon: CircleSlash,
    iconColor: "#9ca3af",
    ringBg: "rgba(156, 163, 175, 0.14)",
    label: "skipped",
  },
  timed_out: {
    Icon: AlertTriangle,
    iconColor: "#f59e0b",
    ringBg: "rgba(245, 158, 11, 0.18)",
    label: "timed out",
  },
  action_required: {
    Icon: AlertTriangle,
    iconColor: "#f59e0b",
    ringBg: "rgba(245, 158, 11, 0.22)",
    label: "action required",
  },
  stale: {
    Icon: CircleSlash,
    iconColor: "#9ca3af",
    ringBg: "rgba(156, 163, 175, 0.14)",
    label: "stale",
  },
  startup_failure: {
    Icon: XCircle,
    iconColor: "#ef4444",
    ringBg: "rgba(239, 68, 68, 0.20)",
    label: "startup failure",
  },
};

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remM = minutes % 60;
  return remM === 0 ? `${hours}h` : `${hours}h ${remM}m`;
}

function StatusPill({ meta: m }: { meta: GHActionsMeta }) {
  // Pending / queued / in-flight take precedence over conclusion — a completed
  // run always has a conclusion, but the reverse isn't guaranteed.
  if (m.status === "in_progress") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
        style={{ backgroundColor: "rgba(32, 136, 255, 0.18)", color: "#2088FF" }}
      >
        <Loader2 className="size-3 animate-spin" />
        running
      </span>
    );
  }
  if (
    m.status === "queued" ||
    m.status === "waiting" ||
    m.status === "pending" ||
    m.status === "requested"
  ) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
        style={{ backgroundColor: "rgba(245, 158, 11, 0.18)", color: "#b45309" }}
      >
        <Clock className="size-3" />
        {m.status === "queued" ? "queued" : m.status}
      </span>
    );
  }
  const conclusion = m.conclusion ?? "neutral";
  const s = CONCLUSION_STYLES[conclusion] ?? CONCLUSION_STYLES.neutral;
  const Icon = s.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-foreground/90"
      style={{ backgroundColor: s.ringBg }}
    >
      <Icon className="size-3" style={{ color: s.iconColor }} />
      {s.label}
    </span>
  );
}

function ItemRenderer({ item }: ItemRendererProps<GHActionsMeta>) {
  const m = item.meta;
  if (!m) return null;
  const title = item.content || `Run #${m.runNumber}`;
  const branch = m.branch ?? "";
  const sha = m.shortSha ?? "";
  const duration = m.durationMs != null ? formatDuration(m.durationMs) : "";
  // event=push / pull_request / schedule / workflow_dispatch — short label
  // useful when scanning whether a run came from a cron or a code push.
  const event = m.event ?? "";

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <StatusPill meta={m} />
        <span className="truncate font-medium text-foreground/80">{m.workflowName}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="truncate text-foreground/70">{m.fullRepo}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">#{m.runNumber}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
      </div>
      <h3
        className="mt-1 font-serif text-[16px] leading-[1.3] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand-hover)]"
        style={{ letterSpacing: "-0.005em", fontFeatureSettings: '"cswh" 1' }}
      >
        {title}
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        {branch && (
          <span className="flex items-center gap-1">
            <GitBranch className="size-3.5" />
            <span className="truncate">{branch}</span>
          </span>
        )}
        {sha && (
          <span className="flex items-center gap-1">
            <Hash className="size-3.5" />
            <span className="font-mono text-[11px]">{sha}</span>
          </span>
        )}
        {duration && (
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" />
            <span className="tabular-nums">{duration}</span>
          </span>
        )}
        {event && (
          <span className="rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border/60">
            {event}
          </span>
        )}
      </div>
    </a>
  );
}

export const column = defineColumnUI<GHActionsConfig, GHActionsMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
