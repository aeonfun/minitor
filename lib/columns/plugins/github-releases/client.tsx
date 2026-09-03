"use client";

import { Tag } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { meta, type GHReleasesConfig, type GHReleasesMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<GHReleasesConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ghr-repo">Repository</Label>
        <Input
          id="ghr-repo"
          placeholder="vercel/next.js"
          value={value.repo}
          onChange={(e) => onChange({ ...value, repo: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          <code>owner/repo</code> or full GitHub URL.
        </p>
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-foreground/90">
        <input
          type="checkbox"
          className="size-3.5 accent-current"
          checked={value.includePrereleases}
          onChange={(e) => onChange({ ...value, includePrereleases: e.target.checked })}
        />
        Include pre-releases
      </label>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<GHReleasesMeta>) {
  const m = item.meta;
  const repo = m?.repo ?? item.author.name ?? "";
  const tag = m?.tag ?? "";
  const isPre = !!m?.prerelease;

  // Releases come in as `${title}\n\n${body?}` from the integration layer.
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
          style={{ backgroundColor: "rgba(34, 197, 94, 0.22)" }}
        >
          <Tag className="size-3" />
          {isPre ? "pre-release" : "release"}
        </span>
        {repo && <span className="truncate text-foreground/80">{repo}</span>}
        {tag && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="truncate font-mono text-[10.5px] text-foreground/70">{tag}</span>
          </>
        )}
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

export const column = defineColumnUI<GHReleasesConfig, GHReleasesMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
