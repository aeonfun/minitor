"use client";

import { RelativeTime } from "@/components/relative-time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { meta, type BacklinksConfig, type BacklinkSource, type BacklinksItemMeta } from "./plugin";

const SOURCE_LABEL: Record<BacklinkSource, string> = {
  hn: "HN",
  reddit: "Reddit",
  "google-news": "Google",
  "bing-news": "Bing",
  github: "GitHub",
};

const SOURCE_BG: Record<BacklinkSource, string> = {
  hn: "rgba(255, 102, 0, 0.18)",
  reddit: "rgba(245, 78, 0, 0.18)",
  "google-news": "rgba(159, 201, 162, 0.32)",
  "bing-news": "rgba(159, 187, 224, 0.32)",
  github: "rgba(38, 37, 30, 0.16)",
};

function ConfigForm({ value, onChange }: ConfigFormProps<BacklinksConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ghbl-repo">Repository</Label>
        <Input
          id="ghbl-repo"
          placeholder="vercel/next.js or https://github.com/vercel/next.js"
          value={value.repo}
          onChange={(e) => onChange({ ...value, repo: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Watches HN, Reddit, Google News, and Bing News for posts linking to this repo. Dedupes by
          canonical URL.
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-3.5 accent-foreground"
          checked={value.includeIssues}
          onChange={(e) => onChange({ ...value, includeIssues: e.target.checked })}
        />
        <span>
          <span className="font-medium">Include GitHub issues / PRs</span>
          <span className="block text-xs text-muted-foreground">
            Issues and PRs in other repos that reference this repo.
          </span>
        </span>
      </label>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<BacklinksItemMeta>) {
  const source = item.meta?.source;
  const sourceLabel = (source && SOURCE_LABEL[source as BacklinkSource]) ?? source ?? "Web";
  const bg = (source && SOURCE_BG[source as BacklinkSource]) ?? "rgba(0,0,0,0.06)";

  const [title, ...rest] = item.content.split("\n\n");
  const snippet = rest.join("\n\n").trim();
  const hostName = (() => {
    try {
      return new URL(item.url ?? "").hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

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
          style={{ backgroundColor: bg }}
        >
          {sourceLabel}
        </span>
        {hostName && <span className="truncate max-w-[200px] text-foreground/80">{hostName}</span>}
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
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground break-words">
          {snippet}
        </p>
      )}
    </a>
  );
}

export const column = defineColumnUI<BacklinksConfig, BacklinksItemMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
