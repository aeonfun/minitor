"use client";

// Shared renderer for avatar-led social post columns (farcaster, mastodon).
// Same card: avatar · display / @handle / timestamp · serif body · reply /
// repost / like footer. Callers pass already-resolved counts (each source
// names them differently) plus the optional power badge and channel chip.

import { Heart, MessageCircle, Repeat2, BadgeCheck } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FeedItem } from "@/lib/columns/types";
import { formatCompactCount } from "@/lib/utils";

export function AvatarPostItem({
  item,
  replies,
  reposts,
  likes,
  powerBadge = false,
  channel,
}: {
  item: FeedItem;
  replies: number;
  reposts: number;
  likes: number;
  powerBadge?: boolean;
  channel?: string;
}) {
  const handle = item.author.handle ?? item.author.name;
  const display = item.author.name;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex items-start gap-2.5">
        <Avatar className="size-9 shrink-0 ring-1 ring-black/5">
          <AvatarImage src={item.author.avatarUrl} alt={display} />
          <AvatarFallback>{display.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px] leading-tight">
            <span className="truncate font-medium text-foreground">{display}</span>
            {powerBadge && (
              <BadgeCheck className="size-3.5" style={{ color: "#7c65c1" }} strokeWidth={2.5} />
            )}
            <span className="truncate text-muted-foreground">@{handle}</span>
            {channel && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="truncate text-foreground/70">/{channel}</span>
              </>
            )}
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums text-muted-foreground">
              <RelativeTime date={item.createdAt} compact />
            </span>
          </div>
          <p
            className="mt-1 font-serif text-[16px] leading-[1.4] text-foreground break-words whitespace-pre-line"
            style={{ letterSpacing: "-0.005em", fontFeatureSettings: '"cswh" 1' }}
          >
            {item.content}
          </p>
          <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageCircle className="size-3.5" />
              <span className="tabular-nums">{formatCompactCount(replies)}</span>
            </span>
            <span className="flex items-center gap-1">
              <Repeat2 className="size-3.5" />
              <span className="tabular-nums">{formatCompactCount(reposts)}</span>
            </span>
            <span className="flex items-center gap-1">
              <Heart className="size-3.5" />
              <span className="tabular-nums">{formatCompactCount(likes)}</span>
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
