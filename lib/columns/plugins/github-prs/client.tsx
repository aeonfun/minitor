"use client";

import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  MessageSquareText,
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
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { formatCompactCount } from "@/lib/utils";
import { meta, type GHPRConfig, type GHPRMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<GHPRConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ghpr-repo">Repository</Label>
        <Input
          id="ghpr-repo"
          placeholder="vercel/next.js"
          value={value.repo}
          onChange={(e) => onChange({ ...value, repo: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Use the <code>owner/repo</code> form.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label>State</Label>
        <Select
          value={value.state}
          onValueChange={(v) => onChange({ ...value, state: v as GHPRConfig["state"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Sort</Label>
        <Select
          value={value.sort}
          onValueChange={(v) => onChange({ ...value, sort: v as GHPRConfig["sort"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="created">Recently created</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function StateBadge({ meta: m }: { meta: GHPRMeta }) {
  if (m.isDraft) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
        style={{ backgroundColor: "rgba(160, 160, 160, 0.32)" }}
      >
        <GitPullRequestDraft className="size-3" />
        draft
      </span>
    );
  }
  if (m.state === "merged") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
        style={{ backgroundColor: "rgba(159, 201, 162, 0.32)" }}
      >
        <GitMerge className="size-3" />
        merged
      </span>
    );
  }
  if (m.state === "closed") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
        style={{ backgroundColor: "rgba(214, 138, 138, 0.32)" }}
      >
        <GitPullRequestClosed className="size-3" />
        closed
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
      style={{ backgroundColor: "rgba(159, 201, 162, 0.28)" }}
    >
      <GitPullRequest className="size-3" />
      open
    </span>
  );
}

function ItemRenderer({ item }: ItemRendererProps<GHPRMeta>) {
  const m = item.meta;
  const [title, ...rest] = item.content.split("\n\n");
  const snippet = rest.join("\n\n").trim();
  const handle = item.author.handle ?? item.author.name;
  const avatarUrl = item.author.avatarUrl;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        {m && <StateBadge meta={m} />}
        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-4 rounded-full" loading="lazy" />
        )}
        <span className="truncate text-foreground/80">{handle}</span>
        {m && <span className="tabular-nums text-foreground/70">#{m.number}</span>}
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
      {m && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquareText className="size-3.5" />
            <span className="tabular-nums">{formatCompactCount(m.commentsCount)}</span>
          </span>
          {(m.additions !== undefined || m.deletions !== undefined) && (
            <span className="flex items-center gap-2 tabular-nums">
              {m.additions !== undefined && (
                <span className="text-emerald-700 dark:text-emerald-400">
                  +{formatCompactCount(m.additions)}
                </span>
              )}
              {m.deletions !== undefined && (
                <span className="text-rose-700 dark:text-rose-400">
                  −{formatCompactCount(m.deletions)}
                </span>
              )}
            </span>
          )}
          <span className="truncate text-foreground/60">
            {m.headBranch} → {m.baseBranch}
          </span>
        </div>
      )}
    </a>
  );
}

export const column = defineColumnUI<GHPRConfig, GHPRMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
