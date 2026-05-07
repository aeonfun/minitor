"use client";

import {
  ArrowBigUp,
  BadgeCheck,
  Eye,
  MessageSquareText,
} from "lucide-react";
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
  type StackOverflowConfig,
  type StackOverflowMeta,
} from "./plugin";

function ConfigForm({
  value,
  onChange,
}: ConfigFormProps<StackOverflowConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as StackOverflowConfig["mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="votes">Top voted</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="so-tag">Tags (optional)</Label>
        <Input
          id="so-tag"
          placeholder="rust, react, postgres…"
          value={value.tag}
          onChange={(e) => onChange({ ...value, tag: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Up to five tags, comma- or space-separated. Multiple tags AND-match
          (returns questions that have <em>all</em> of them). See{" "}
          <a
            href="https://stackoverflow.com/tags"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            stackoverflow.com/tags
          </a>{" "}
          for the full list.
        </p>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<StackOverflowMeta>) {
  const m = item.meta;
  const score = m?.score ?? 0;
  const answers = m?.answers ?? 0;
  const views = m?.views ?? 0;
  const tags = m?.tags ?? [];
  const hasAccepted = !!m?.hasAccepted;

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(244, 128, 36, 0.16)" }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-[9px] font-bold leading-none text-white"
            style={{ backgroundColor: "#F48024" }}
          >
            S
          </span>
          Stack Overflow
        </span>
        <span className="text-muted-foreground/80">
          by{" "}
          <span className="text-foreground/90">
            {item.author.handle ?? item.author.name}
          </span>
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
        {hasAccepted && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span
              className="inline-flex items-center gap-0.5 text-[11px]"
              style={{ color: "#5eba7d" }}
              title="Accepted answer"
            >
              <BadgeCheck className="size-3" />
              accepted
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
        <span className="flex items-center gap-1">
          <ArrowBigUp className="size-4" />
          <span className="tabular-nums">{formatCompactCount(score)}</span>
        </span>
        <span className="flex items-center gap-1">
          <MessageSquareText className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(answers)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Eye className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(views)}</span>
        </span>
      </div>
    </div>
  );
}

export const column = defineColumnUI<StackOverflowConfig, StackOverflowMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
