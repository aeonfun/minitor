"use client";

import { AlertTriangle, Download, Sparkles } from "lucide-react";
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
import { meta, type NpmConfig, type NpmMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<NpmConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="npm-query">Search query</Label>
        <Input
          id="npm-query"
          placeholder="e.g. react, llm, cli, agent, vite-plugin"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          npm&rsquo;s search endpoint requires a query; leave as <code>javascript</code>
          {" "}for a broad popularity stream, or scope to a keyword (single word
          for substring match across name/description/keywords).
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label>Sort</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as NpmConfig["mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popularity">Popularity</SelectItem>
            <SelectItem value="quality">Quality</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="combined">Combined (balanced)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Heavy-weights the chosen axis to 0.8; <strong>Combined</strong>{" "}
          mirrors npm&rsquo;s default ranking blend.
        </p>
      </div>
    </div>
  );
}

function ScorePill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  // Score values are in [0, 1]; render as integer percent. Round to nearest,
  // floor at 0, cap at 100 — npm sometimes returns 1.0000000002 from the
  // ranking model, which would round to 100 anyway but the cap is defensive.
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground">
      <span className="font-medium uppercase tracking-wide">{label}</span>
      <span className="tabular-nums text-foreground/90">{pct}</span>
    </span>
  );
}

function ItemRenderer({ item }: ItemRendererProps<NpmMeta>) {
  const m = item.meta;
  const weeklyDownloads = m?.weeklyDownloads ?? 0;
  const version = m?.version ?? "";
  const keywords = m?.keywords ?? [];
  const deprecated = m?.deprecated ?? false;
  const score = m?.score ?? 0;
  const detail = m?.scoreDetail;

  const [title, ...rest] = item.content.split("\n\n");
  const description = rest.join("\n\n").trim();

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(203, 56, 55, 0.16)" }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-[9px] font-bold leading-none text-white"
            style={{ backgroundColor: "#CB3837" }}
          >
            n
          </span>
          npm
        </span>
        {version && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums text-muted-foreground/90">
              v{version}
            </span>
          </>
        )}
        {deprecated && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-amber-500/40">
              <AlertTriangle className="size-3" />
              deprecated
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
        <span className="flex items-center gap-1">
          <Download className="size-3.5" />
          <span className="tabular-nums">
            {formatCompactCount(weeklyDownloads)}
          </span>
          <span className="text-muted-foreground/70">/wk</span>
        </span>
        {score > 0 && (
          <span className="flex items-center gap-1">
            <Sparkles className="size-3.5" />
            <span className="tabular-nums text-foreground/90">
              {Math.round(score * 100)}
            </span>
          </span>
        )}
        {detail && (
          <span className="flex items-center gap-2 text-muted-foreground/80">
            <ScorePill label="Q" value={detail.quality} />
            <ScorePill label="P" value={detail.popularity} />
            <ScorePill label="M" value={detail.maintenance} />
          </span>
        )}
      </div>
    </div>
  );
}

export const column = defineColumnUI<NpmConfig, NpmMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
