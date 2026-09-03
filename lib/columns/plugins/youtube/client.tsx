"use client";

import { Eye, PlaySquare, ThumbsUp } from "lucide-react";
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
import { meta, type YTConfig, type YTMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<YTConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) => onChange({ ...value, mode: v as YTConfig["mode"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="search">Search</SelectItem>
            <SelectItem value="channel">Channel</SelectItem>
            <SelectItem value="playlist">Playlist</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.mode === "search" && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="yt-q">Query</Label>
            <Input
              id="yt-q"
              placeholder='"claude code", react server components...'
              value={value.query}
              onChange={(e) => onChange({ ...value, query: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Requires <code>YOUTUBE_API_KEY</code>. Free quota is ~100 searches/day.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Sort by</Label>
            <Select
              value={value.order}
              onValueChange={(v) => onChange({ ...value, order: v as YTConfig["order"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Newest</SelectItem>
                <SelectItem value="relevance">Most relevant</SelectItem>
                <SelectItem value="viewCount">Most viewed</SelectItem>
                <SelectItem value="rating">Highest rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {value.mode === "channel" && (
        <div className="grid gap-1.5">
          <Label htmlFor="yt-channel">Channel</Label>
          <Input
            id="yt-channel"
            placeholder="@anthropic-ai or UCXXXXXXX"
            value={value.channel}
            onChange={(e) => onChange({ ...value, channel: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            <code>@handle</code> or <code>UC…</code> channel id. No API key needed.
          </p>
        </div>
      )}

      {value.mode === "playlist" && (
        <div className="grid gap-1.5">
          <Label htmlFor="yt-pl">Playlist id</Label>
          <Input
            id="yt-pl"
            placeholder="PLxxxxxxxxxxxx"
            value={value.playlist}
            onChange={(e) => onChange({ ...value, playlist: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            From the playlist URL: <code>?list=PLxxxxxxxxxxxx</code>. No API key needed.
          </p>
        </div>
      )}
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<YTMeta>) {
  const m = item.meta;
  const thumb = m?.thumbnail;
  const duration = m?.duration;
  const views = m?.views;
  const likes = m?.likes;
  const channelTitle = m?.channelTitle ?? item.author.name ?? "";

  const [title, ...rest] = item.content.split("\n\n");
  const description = rest.join("\n\n").trim();

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border transition-colors hover:bg-surface/60"
    >
      {thumb && (
        <div className="relative aspect-video w-full overflow-hidden bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover/item:scale-[1.02]"
            loading="lazy"
          />
          {duration && (
            <span className="absolute bottom-1.5 right-1.5 rounded-sm bg-black/85 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
              {duration}
            </span>
          )}
        </div>
      )}
      <div className="px-3.5 py-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
            style={{ backgroundColor: "rgba(255, 0, 0, 0.12)" }}
          >
            <PlaySquare className="size-3" style={{ color: "#ff0000" }} strokeWidth={2.5} />
            YouTube
          </span>
          <span className="truncate text-foreground/80">{channelTitle}</span>
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
        {description && (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground break-words">
            {description}
          </p>
        )}
        {(views !== undefined || likes !== undefined) && (
          <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
            {views !== undefined && (
              <span className="flex items-center gap-1">
                <Eye className="size-3.5" />
                <span className="tabular-nums">{formatCompactCount(views)}</span>
              </span>
            )}
            {likes !== undefined && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="size-3.5" />
                <span className="tabular-nums">{formatCompactCount(likes)}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </a>
  );
}

export const column = defineColumnUI<YTConfig, YTMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
