"use client";

import { GitCommitHorizontal } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defineColumnUI,
  type ConfigFormProps,
  type ItemRendererProps,
} from "@/lib/columns/types";
import { meta, type GHCommitsConfig, type GHCommitsMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<GHCommitsConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ghco-repo">Repository</Label>
        <Input
          id="ghco-repo"
          placeholder="vercel/next.js"
          value={value.repo}
          onChange={(e) => onChange({ ...value, repo: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          <code>owner/repo</code> or full GitHub URL.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ghco-branch">Branch</Label>
        <Input
          id="ghco-branch"
          placeholder="(default branch)"
          value={value.branch}
          onChange={(e) => onChange({ ...value, branch: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Branch, tag, or commit SHA. Leave empty for the default branch.
        </p>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<GHCommitsMeta>) {
  const m = item.meta;
  const repo = m?.repo ?? "";
  const shortSha = m?.shortSha ?? "";

  // Commits come in as `${subject}\n\n${body?}` from the integration layer.
  const [title, ...rest] = item.content.split("\n\n");
  const body = rest.join("\n\n").trim();

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(137, 87, 229, 0.22)" }}
        >
          <GitCommitHorizontal className="size-3" />
          commit
        </span>
        {repo && <span className="truncate text-foreground/80">{repo}</span>}
        {shortSha && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="truncate font-mono text-[10.5px] text-foreground/70">
              {shortSha}
            </span>
          </>
        )}
        <span className="text-muted-foreground/50">·</span>
        <span className="truncate text-foreground/70">{item.author.name}</span>
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
      {body && (
        <p className="mt-1 line-clamp-3 text-[12.5px] leading-snug text-muted-foreground break-words whitespace-pre-line">
          {body}
        </p>
      )}
    </a>
  );
}

export const column = defineColumnUI<GHCommitsConfig, GHCommitsMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
