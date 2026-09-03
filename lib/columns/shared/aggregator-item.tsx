"use client";

// Shared renderer for link-aggregator columns (hacker-news, lobsters). Same
// card: letter-box brand badge · by-author · title link · snippet · upvote /
// comments footer. Callers pass already-resolved score / comment counts (each
// source names them differently) plus the badge and optional tag list.

import { ArrowBigUp, MessageSquareText } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import type { FeedItem } from "@/lib/columns/types";
import { formatCompactCount } from "@/lib/utils";

export function AggregatorItem({
  item,
  badge,
  score,
  comments,
  commentsUrl,
  tags,
}: {
  item: FeedItem;
  badge: { letter: string; label: string; bgColor: string; boxColor: string };
  score: number;
  comments: number;
  commentsUrl?: string;
  tags?: string[];
}) {
  const [title, ...rest] = item.content.split("\n\n");
  const snippet = rest.join("\n\n").trim();

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: badge.bgColor }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-[9px] font-bold leading-none text-white"
            style={{ backgroundColor: badge.boxColor }}
          >
            {badge.letter}
          </span>
          {badge.label}
        </span>
        <span className="text-muted-foreground/80">
          by <span className="text-foreground/90">{item.author.handle ?? item.author.name}</span>
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
      </div>
      <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 block">
        <h3
          className="font-serif text-[16px] leading-[1.3] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand)]"
          style={{ letterSpacing: "-0.005em", fontFeatureSettings: '"cswh" 1' }}
        >
          {title}
        </h3>
      </a>
      {snippet && (
        <p className="mt-1 line-clamp-3 text-[12.5px] leading-snug text-muted-foreground break-words">
          {snippet}
        </p>
      )}
      {tags && tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.slice(0, 4).map((t) => (
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
        <a
          href={commentsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <MessageSquareText className="size-3.5" />
          <span className="tabular-nums">{formatCompactCount(comments)}</span>
        </a>
      </div>
    </div>
  );
}
