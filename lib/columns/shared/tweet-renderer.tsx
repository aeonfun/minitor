"use client";

import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import type { ItemRendererProps } from "@/lib/columns/types";
import { RelativeTime } from "@/components/relative-time";
import { formatCompactCount } from "@/lib/utils";

/**
 * Shared metadata shape for tweet-style feed items. The four X-* plugins all
 * register this as their TMeta, so this component is typed against it directly
 * instead of doing runtime type guards.
 */
export interface TweetMeta {
  likes: number;
  retweets: number;
  replies: number;
  views?: number;
}

export function TweetItem({ item }: ItemRendererProps<TweetMeta>) {
  const likes = item.meta?.likes ?? 0;
  const retweets = item.meta?.retweets ?? 0;
  const replies = item.meta?.replies ?? 0;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex items-baseline gap-1 text-[13px]">
        <span
          className="truncate font-medium text-foreground"
          style={{ letterSpacing: "-0.005em" }}
        >
          {item.author.name}
        </span>
        {item.author.handle && (
          <span className="truncate text-muted-foreground">@{item.author.handle}</span>
        )}
        <span className="text-muted-foreground/50">·</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          <RelativeTime date={item.createdAt} compact />
        </span>
      </div>
      <p
        className="mt-1 font-serif text-[16px] leading-[1.4] text-foreground break-words whitespace-pre-wrap"
        style={{ fontFeatureSettings: '"cswh" 1' }}
      >
        {item.content}
      </p>
      <div className="mt-2.5 flex items-center gap-5 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <MessageCircle className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(replies)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Repeat2 className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(retweets)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Heart className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(likes)}</span>
        </span>
      </div>
    </a>
  );
}
