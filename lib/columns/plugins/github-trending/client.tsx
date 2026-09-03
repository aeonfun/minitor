"use client";

import { GitBranch, Star } from "lucide-react";
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
import { meta, type GHTrendingConfig, type GHTrendingMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<GHTrendingConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ght-lang">Language (optional)</Label>
        <Input
          id="ght-lang"
          placeholder="typescript, rust, python..."
          value={value.language}
          onChange={(e) => onChange({ ...value, language: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Window</Label>
        <Select
          value={value.period}
          onValueChange={(v) => onChange({ ...value, period: v as GHTrendingConfig["period"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<GHTrendingMeta>) {
  const m = item.meta;
  const [title, ...rest] = item.content.split("\n\n");
  const snippet = rest.join("\n\n").trim();
  const stars = m?.stars ?? 0;
  const forks = m?.forks ?? 0;
  const language = m?.language ?? "";

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
          style={{ backgroundColor: "rgba(232, 138, 77, 0.22)" }}
        >
          <GitBranch className="size-3" />
          repo
        </span>
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
        <span className="flex items-center gap-1">
          <Star className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(stars)}</span>
        </span>
        <span className="flex items-center gap-1">
          <GitBranch className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(forks)}</span>
        </span>
        {language && <span className="truncate text-foreground/70">{language}</span>}
      </div>
    </a>
  );
}

export const column = defineColumnUI<GHTrendingConfig, GHTrendingMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
