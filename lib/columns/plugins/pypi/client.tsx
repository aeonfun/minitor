"use client";

import { Download, Calendar } from "lucide-react";
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
import { formatCompactCount } from "@/lib/utils";
import { meta, type PypiConfig, type PypiMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<PypiConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as PypiConfig["mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updates">Recent updates</SelectItem>
            <SelectItem value="new-packages">New packages</SelectItem>
            <SelectItem value="top-30d">Top · 30 days</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          <strong>Updates</strong> and <strong>New packages</strong> read PyPI&rsquo;s
          public RSS feeds (last ~40 entries, time-ordered).{" "}
          <strong>Top · 30d</strong> ranks the top 8000 packages by 30-day
          downloads via the community-maintained mirror — no API key required.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pypi-keyword">Keyword filter (optional)</Label>
        <Input
          id="pypi-keyword"
          placeholder="e.g. llm, agent, torch, fastapi"
          value={value.keyword}
          onChange={(e) => onChange({ ...value, keyword: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Case-insensitive substring match. Updates/new-packages search title
          and description; Top · 30d searches the project name only.
        </p>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<PypiMeta>) {
  const m = item.meta;
  const version = m?.version ?? "";
  const weeklyDownloads = m?.weeklyDownloads ?? 0;
  const monthlyDownloads = m?.monthlyDownloads ?? 0;
  const author = m?.author ?? "";

  const [title, ...rest] = item.content.split("\n\n");
  const description = rest.join("\n\n").trim();

  // Top · 30d rows share a synthetic createdAt (the mirror's last_update)
  // so relative-time on them is misleading. Detect via the absence of a
  // version and the absence of a description — that's the rank-feed shape.
  const isRankFeed = !version && !description;

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(55, 118, 171, 0.16)" }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-[9px] font-bold leading-none text-white"
            style={{ backgroundColor: "#3776AB" }}
          >
            py
          </span>
          PyPI
        </span>
        {version && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums text-muted-foreground/90">
              v{version}
            </span>
          </>
        )}
        {author && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground/90">{author}</span>
          </>
        )}
        {!isRankFeed && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums">
              <RelativeTime date={item.createdAt} addSuffix />
            </span>
          </>
        )}
      </div>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block"
      >
        <h3
          className="font-mono text-[14px] leading-[1.25] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand)]"
          style={{ letterSpacing: "-0.005em" }}
        >
          {title}
        </h3>
      </a>
      {description && (
        <p className="mt-1 line-clamp-3 text-[12.5px] leading-snug text-muted-foreground break-words">
          {description}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        {weeklyDownloads > 0 && (
          <span className="flex items-center gap-1">
            <Download className="size-3.5" />
            <span className="tabular-nums">
              {formatCompactCount(weeklyDownloads)}
            </span>
            <span className="text-muted-foreground/70">/wk</span>
          </span>
        )}
        {monthlyDownloads > 0 && (
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5" />
            <span className="tabular-nums">
              {formatCompactCount(monthlyDownloads)}
            </span>
            <span className="text-muted-foreground/70">/30d</span>
          </span>
        )}
      </div>
    </div>
  );
}

export const column = defineColumnUI<PypiConfig, PypiMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
