"use client";

// Shared renderer for the app-store / google-play review columns. Both plugins
// render an identical card off the same AppReviewMeta shape; only the store
// badge (label + tint) differs, so it is passed in.

import { Star } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import type { FeedItem } from "@/lib/columns/types";
import type { AppReviewMeta } from "@/lib/integrations/app-reviews";

export function Stars({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${clamped} of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < clamped ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

export function ReviewItem({
  item,
  badgeLabel,
  badgeColor,
}: {
  item: FeedItem<AppReviewMeta>;
  badgeLabel: string;
  badgeColor: string;
}) {
  const m = item.meta;
  const rating = m?.rating ?? 0;
  const version = m?.version;
  const title = m?.title;
  const reviewer = item.author.name || "Anonymous";

  const body =
    title && item.content.startsWith(`${title}\n\n`)
      ? item.content.slice(title.length + 2)
      : item.content;

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
          style={{ backgroundColor: badgeColor }}
        >
          {badgeLabel}
        </span>
        <Stars rating={rating} />
        <span className="text-foreground/90">{reviewer}</span>
        {version && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums">v{version}</span>
          </>
        )}
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
      </div>
      {title && (
        <h3
          className="mt-1 font-serif text-[16px] leading-[1.3] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand-hover)]"
          style={{ letterSpacing: "-0.005em", fontFeatureSettings: '"cswh" 1' }}
        >
          {title}
        </h3>
      )}
      {body && (
        <p className="mt-1 line-clamp-3 text-[12.5px] leading-snug text-muted-foreground break-words whitespace-pre-line">
          {body}
        </p>
      )}
    </a>
  );
}
