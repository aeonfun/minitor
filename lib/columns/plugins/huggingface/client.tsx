"use client";

import { Download, Flame, Heart, Lock } from "lucide-react";
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
import {
  meta,
  type HuggingfaceConfig,
  type HuggingfaceMeta,
} from "./plugin";

function ConfigForm({
  value,
  onChange,
}: ConfigFormProps<HuggingfaceConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Resource</Label>
        <Select
          value={value.resource}
          onValueChange={(v) =>
            onChange({
              ...value,
              resource: v as HuggingfaceConfig["resource"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="models">Models</SelectItem>
            <SelectItem value="datasets">Datasets</SelectItem>
            <SelectItem value="spaces">Spaces</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Sort</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as HuggingfaceConfig["mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trending">Trending</SelectItem>
            <SelectItem value="most-likes">Most liked</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="hf-search">Search (optional)</Label>
        <Input
          id="hf-search"
          placeholder="bert, llama, agents…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Substring match against the repo id. Leave empty to browse the full
          ranked list. See{" "}
          <a
            href="https://huggingface.co/docs/hub/api"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            huggingface.co/docs/hub/api
          </a>{" "}
          for the underlying endpoint.
        </p>
      </div>
    </div>
  );
}

function descriptorFor(m: HuggingfaceMeta | undefined): string {
  // The "what kind of thing is this" line under the title — pipeline tag for
  // models, library for datasets, SDK for spaces. Falls back to the resource
  // name so the slot is never empty.
  if (!m) return "";
  if (m.resource === "models") {
    return m.pipelineTag ?? m.libraryName ?? "model";
  }
  if (m.resource === "spaces") {
    return m.sdk ? `${m.sdk} space` : "space";
  }
  return "dataset";
}

function ItemRenderer({ item }: ItemRendererProps<HuggingfaceMeta>) {
  const m = item.meta;
  const likes = m?.likes ?? 0;
  const downloads = m?.downloads;
  const tags = (m?.tags ?? []).filter(
    (t) => !t.startsWith("region:") && !t.startsWith("license:"),
  );
  const descriptor = descriptorFor(m);
  const gated = !!m?.gated;

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(255, 210, 31, 0.22)" }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-[10px] leading-none"
            style={{ backgroundColor: "#FFD21F" }}
            aria-hidden
          >
            🤗
          </span>
          Hugging Face
        </span>
        {descriptor && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground/90">{descriptor}</span>
          </>
        )}
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
        {gated && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span
              className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"
              title="Gated repo — requires accepting terms before download"
            >
              <Lock className="size-3" />
              gated
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
          className="font-serif text-[16px] leading-[1.3] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand)]"
          style={{ letterSpacing: "-0.005em", fontFeatureSettings: '"cswh" 1' }}
        >
          {item.content}
        </h3>
      </a>
      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.slice(0, 5).map((t) => (
            <span
              key={t}
              className="rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border/60"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1" title="Likes">
          <Heart className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(likes)}</span>
        </span>
        {typeof downloads === "number" && (
          <span className="flex items-center gap-1" title="Downloads (last 30 days)">
            <Download className="size-3.5" />
            <span className="tabular-nums">
              {formatCompactCount(downloads)}
            </span>
          </span>
        )}
        {typeof m?.trendingScore === "number" && m.trendingScore > 0 && (
          <span
            className="flex items-center gap-1"
            title="Hugging Face trending score"
          >
            <Flame className="size-3.5" />
            <span className="tabular-nums">
              {formatCompactCount(Math.round(m.trendingScore))}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

export const column = defineColumnUI<HuggingfaceConfig, HuggingfaceMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
