"use client";

import { MessageCircle } from "lucide-react";
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
import { meta, type RedditConfig, type RedditMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<RedditConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="reddit-sub">Subreddit</Label>
        <Input
          id="reddit-sub"
          placeholder="programming, machinelearning, startups..."
          value={value.subreddit}
          onChange={(e) => onChange({ ...value, subreddit: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Subreddit name without the <code>r/</code> prefix.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label>Sort by</Label>
        <Select
          value={value.sortBy}
          onValueChange={(v) =>
            onChange({ ...value, sortBy: v as RedditConfig["sortBy"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="top">Top</SelectItem>
            <SelectItem value="rising">Rising</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<RedditMeta>) {
  const m = item.meta;
  const subreddit = m?.subreddit ?? "";

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        {subreddit && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
            style={{ backgroundColor: "rgba(245, 78, 0, 0.14)" }}
          >
            <MessageCircle className="size-3 text-[color:var(--brand)]" />
            r/{subreddit}
          </span>
        )}
        <span className="text-muted-foreground/80">
          u/<span className="text-foreground/90">{item.author.handle ?? item.author.name}</span>
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
      </div>
      <h3
        className="mt-1 font-serif text-[16px] leading-[1.3] text-foreground break-words"
        style={{ letterSpacing: "-0.005em", fontFeatureSettings: '"cswh" 1' }}
      >
        {item.content}
      </h3>
    </a>
  );
}

export const column = defineColumnUI<RedditConfig, RedditMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
