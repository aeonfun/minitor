"use client";

import { Download, Flame } from "lucide-react";
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
import { meta, type CratesConfig, type CratesMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<CratesConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="crates-query">Search query</Label>
        <Input
          id="crates-query"
          placeholder="e.g. tokio, axum, serde, wasm, async-trait (optional)"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Optional — leave empty for the global stream ranked by the selected
          axis. Substring match across crate name, description, and keywords.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label>Sort</Label>
        <Select
          value={value.sort}
          onValueChange={(v) =>
            onChange({ ...value, sort: v as CratesConfig["sort"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent-downloads">
              Trending (90d downloads)
            </SelectItem>
            <SelectItem value="downloads">All-time downloads</SelectItem>
            <SelectItem value="recent-updates">Recently updated</SelectItem>
            <SelectItem value="new">Newest</SelectItem>
            <SelectItem value="alpha">A–Z</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          <strong>Trending</strong> tracks the last 90 days of downloads — the
          best signal for &ldquo;what&rsquo;s hot right now.&rdquo;{" "}
          <strong>Recently updated</strong> surfaces crates with active
          maintenance.
        </p>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<CratesMeta>) {
  const m = item.meta;
  const recent = m?.recentDownloads ?? 0;
  const total = m?.totalDownloads ?? 0;
  const version = m?.version ?? "";
  const keywords = m?.keywords ?? [];

  const [title, ...rest] = item.content.split("\n\n");
  const description = rest.join("\n\n").trim();

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(222, 165, 132, 0.22)" }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-[9px] font-bold leading-none text-white"
            style={{ backgroundColor: "#DEA584" }}
          >
            ⚙
          </span>
          crates.io
        </span>
        {version && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums text-muted-foreground/90">
              v{version}
            </span>
          </>
        )}
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
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
      {keywords.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {keywords.slice(0, 5).map((k) => (
            <span
              key={k}
              className="rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border/60"
            >
              {k}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        {recent > 0 && (
          <span className="flex items-center gap-1">
            <Flame className="size-3.5" />
            <span className="tabular-nums">{formatCompactCount(recent)}</span>
            <span className="text-muted-foreground/70">/90d</span>
          </span>
        )}
        {total > 0 && (
          <span className="flex items-center gap-1">
            <Download className="size-3.5" />
            <span className="tabular-nums">{formatCompactCount(total)}</span>
            <span className="text-muted-foreground/70">total</span>
          </span>
        )}
      </div>
    </div>
  );
}

export const column = defineColumnUI<CratesConfig, CratesMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
