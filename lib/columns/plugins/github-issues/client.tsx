"use client";

import { CircleDot, GitMerge, GitPullRequest, MessageSquareText } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { formatCompactCount } from "@/lib/utils";
import { meta, type GHIssuesConfig, type GHIssuesMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<GHIssuesConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ghi-q">Query</Label>
        <Input
          id="ghi-q"
          placeholder="repo:vercel/next.js is:open label:bug"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Full GitHub issue-search syntax (<code>is:open</code>, <code>repo:</code>,{" "}
          <code>label:</code>, <code>author:</code>, <code>is:pr</code>, etc.).
        </p>
      </div>
    </div>
  );
}

function KindBadge({ m }: { m: GHIssuesMeta }) {
  const kind = m.kind;
  const state = m.state ?? "open";
  const Icon = kind === "pr" ? (state === "closed" ? GitMerge : GitPullRequest) : CircleDot;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
      style={{
        backgroundColor:
          state === "closed" ? "rgba(192, 168, 221, 0.32)" : "rgba(223, 168, 143, 0.28)",
      }}
    >
      <Icon className="size-3" />
      {kind === "pr" ? "PR" : "issue"}
      {m.repo && <span className="text-foreground/70">· {m.repo}</span>}
    </span>
  );
}

function ItemRenderer({ item }: ItemRendererProps<GHIssuesMeta>) {
  const m = item.meta ?? ({ kind: "issue" } as GHIssuesMeta);
  const [title, ...rest] = item.content.split("\n\n");
  const snippet = rest.join("\n\n").trim();
  const comments = m.comments ?? 0;
  const number = m.number;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <KindBadge m={m} />
        <span className="truncate text-foreground/80">
          {item.author.handle ?? item.author.name}
        </span>
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
      {snippet && (
        <p className="mt-1 line-clamp-3 text-[12.5px] leading-snug text-muted-foreground break-words whitespace-pre-line">
          {snippet}
        </p>
      )}
      <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
        {number !== undefined && <span className="tabular-nums text-foreground/70">#{number}</span>}
        <span className="flex items-center gap-1">
          <MessageSquareText className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(comments)}</span>
        </span>
      </div>
    </a>
  );
}

export const column = defineColumnUI<GHIssuesConfig, GHIssuesMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
