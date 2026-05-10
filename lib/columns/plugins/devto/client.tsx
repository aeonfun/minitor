"use client";

import { Heart, MessageSquareText, Timer } from "lucide-react";
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
import { meta, type DevtoConfig, type DevtoMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<DevtoConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as DevtoConfig["mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Top — past week</SelectItem>
            <SelectItem value="rising">Rising — past 24h</SelectItem>
            <SelectItem value="latest">Latest</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="devto-tag">Tags (optional)</Label>
        <Input
          id="devto-tag"
          placeholder="ai, llm, rust, webdev…"
          value={value.tag}
          onChange={(e) => onChange({ ...value, tag: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Up to five tags, comma- or space-separated. Multiple tags AND-match
          (returns articles tagged with <em>all</em> of them). See{" "}
          <a
            href="https://dev.to/tags"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            dev.to/tags
          </a>{" "}
          for the full list.
        </p>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<DevtoMeta>) {
  const m = item.meta;
  const reactions = m?.reactions ?? 0;
  const comments = m?.comments ?? 0;
  const readingTime = m?.readingTimeMinutes ?? 0;
  const tags = m?.tags ?? [];
  const organization = m?.organization;

  const [title, ...rest] = item.content.split("\n\n");
  const description = rest.join("\n\n").trim();

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(59, 73, 223, 0.16)" }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-[9px] font-bold leading-none text-white"
            style={{ backgroundColor: "#3b49df" }}
          >
            D
          </span>
          DEV
        </span>
        <span className="text-muted-foreground/80">
          by{" "}
          <span className="text-foreground/90">
            {item.author.handle ?? item.author.name}
          </span>
        </span>
        {organization && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground/80">
              for{" "}
              <span className="text-foreground/90">{organization.name}</span>
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
          className="font-serif text-[16px] leading-[1.3] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand)]"
          style={{ letterSpacing: "-0.005em", fontFeatureSettings: '"cswh" 1' }}
        >
          {title}
        </h3>
      </a>
      {description && (
        <p className="mt-1 line-clamp-3 text-[12.5px] leading-snug text-muted-foreground break-words">
          {description}
        </p>
      )}
      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border/60"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Heart className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(reactions)}</span>
        </span>
        <span className="flex items-center gap-1">
          <MessageSquareText className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(comments)}</span>
        </span>
        {readingTime > 0 && (
          <span className="flex items-center gap-1">
            <Timer className="size-3.5" />
            <span className="tabular-nums">{readingTime}m read</span>
          </span>
        )}
      </div>
    </div>
  );
}

export const column = defineColumnUI<DevtoConfig, DevtoMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
