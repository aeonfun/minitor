"use client";

import {
  CircleDot,
  FileCode2,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  MessageSquareText,
  Star,
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
import { meta, type GHSearchConfig, type GHSearchMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<GHSearchConfig>) {
  const isUrl = /^https?:\/\//i.test(value.query.trim());
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Scope</Label>
        <Select
          value={value.scope}
          onValueChange={(v) => onChange({ ...value, scope: v as GHSearchConfig["scope"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="repositories">Repositories</SelectItem>
            <SelectItem value="issues">Issues / PRs</SelectItem>
            <SelectItem value="code">Code</SelectItem>
            <SelectItem value="commits">Commits</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ghs-q">Keyword or URL</Label>
        <Input
          id="ghs-q"
          placeholder='"yourdomain.com", "your-product", or any GitHub query'
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {isUrl
            ? "URL will be auto-quoted for an exact match."
            : "Quote phrases for exact match. Full GitHub search syntax (org:, repo:, language:, path:, is:open, ...) is supported."}
        </p>
      </div>

      {value.scope === "code" && (
        <p className="rounded-md border border-border bg-surface/40 px-3 py-2 text-[11.5px] text-muted-foreground">
          Code search requires{" "}
          <code className="rounded bg-foreground/[0.06] px-1 py-px text-foreground/90">
            GITHUB_TOKEN
          </code>{" "}
          in your env. Other scopes work without one.
        </p>
      )}
    </div>
  );
}

function ScopeBadge({ m }: { m: GHSearchMeta }) {
  if (m.scope === "issues") {
    const state = m.state ?? "open";
    const Icon = m.isPr ? (state === "closed" ? GitMerge : GitPullRequest) : CircleDot;
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
        style={{
          backgroundColor:
            state === "closed" ? "rgba(192, 168, 221, 0.32)" : "rgba(223, 168, 143, 0.28)",
        }}
      >
        <Icon className="size-3" />
        {m.isPr ? "PR" : "issue"}
      </span>
    );
  }
  if (m.scope === "code") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
        style={{ backgroundColor: "rgba(159, 187, 224, 0.32)" }}
      >
        <FileCode2 className="size-3" />
        code
      </span>
    );
  }
  if (m.scope === "commits") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
        style={{ backgroundColor: "rgba(159, 201, 162, 0.28)" }}
      >
        <GitCommit className="size-3" />
        commit
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
      style={{ backgroundColor: "rgba(159, 187, 224, 0.32)" }}
    >
      <GitBranch className="size-3" />
      repo
    </span>
  );
}

function MetaRow({ m }: { m: GHSearchMeta }) {
  if (m.scope === "repositories") {
    const stars = m.stars ?? 0;
    const forks = m.forks ?? 0;
    return (
      <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Star className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(stars)}</span>
        </span>
        <span className="flex items-center gap-1">
          <GitBranch className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(forks)}</span>
        </span>
        {m.language && <span className="truncate text-foreground/70">{m.language}</span>}
      </div>
    );
  }
  if (m.scope === "issues") {
    const comments = m.comments ?? 0;
    return (
      <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
        {m.number !== undefined && (
          <span className="tabular-nums text-foreground/70">#{m.number}</span>
        )}
        <span className="flex items-center gap-1">
          <MessageSquareText className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(comments)}</span>
        </span>
        {m.repo && <span className="truncate text-foreground/70">{m.repo}</span>}
      </div>
    );
  }
  if (m.scope === "commits" && m.sha) {
    return (
      <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
        <span className="font-mono text-foreground/70">{m.sha.slice(0, 7)}</span>
        {m.repo && <span className="truncate text-foreground/70">{m.repo}</span>}
      </div>
    );
  }
  return null;
}

function ItemRenderer({ item }: ItemRendererProps<GHSearchMeta>) {
  const m = item.meta ?? ({ scope: "repositories" } as GHSearchMeta);
  const [title, ...rest] = item.content.split("\n\n");
  const snippet = rest.join("\n\n").trim();

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <ScopeBadge m={m} />
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
        <p
          className={`mt-1 line-clamp-3 text-[12.5px] leading-snug text-muted-foreground break-words ${
            m.scope === "code" ? "font-mono whitespace-pre" : "whitespace-pre-line"
          }`}
        >
          {snippet}
        </p>
      )}
      <MetaRow m={m} />
    </a>
  );
}

export const column = defineColumnUI<GHSearchConfig, GHSearchMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
