"use client";

import { Rocket } from "lucide-react";
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
import {
  meta,
  type ProductHuntConfig,
  type ProductHuntMeta,
} from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<ProductHuntConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as ProductHuntConfig["mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today — full daily slate</SelectItem>
            <SelectItem value="topic">Topic — filter by keyword</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ph-topic">Topic keywords (optional)</Label>
        <Input
          id="ph-topic"
          placeholder="ai, design, productivity, developer-tools…"
          value={value.topic}
          onChange={(e) => onChange({ ...value, topic: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Up to five keywords, comma- or space-separated. Keywords OR-match
          against the product name, tagline, description, and link. Leave empty
          to see every launch in today&apos;s slate.
        </p>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<ProductHuntMeta>) {
  const m = item.meta;
  const productName = m?.productName ?? item.content.split("\n\n")[0] ?? "";
  const tagline = m?.tagline ?? "";
  const description = item.content.includes("\n\n")
    ? item.content.split("\n\n").slice(1).join("\n\n").trim()
    : "";

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(218, 85, 47, 0.16)" }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-white"
            style={{ backgroundColor: "#DA552F" }}
          >
            <Rocket className="size-2.5" strokeWidth={3} />
          </span>
          PH
        </span>
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
          className="font-serif text-[16px] leading-[1.3] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand)]"
          style={{
            letterSpacing: "-0.005em",
            fontFeatureSettings: '"cswh" 1',
          }}
        >
          {productName}
        </h3>
        {tagline && (
          <p className="mt-0.5 text-[13px] leading-snug text-foreground/80 break-words">
            {tagline}
          </p>
        )}
      </a>
      {description && description !== tagline && (
        <p className="mt-1 line-clamp-3 text-[12.5px] leading-snug text-muted-foreground break-words">
          {description}
        </p>
      )}
    </div>
  );
}

export const column = defineColumnUI<ProductHuntConfig, ProductHuntMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
