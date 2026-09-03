"use client";

import { ExternalLink } from "lucide-react";
import type { FeedItem } from "@/lib/columns/types";
import { RelativeTime } from "@/components/relative-time";

export function LinkItem({
  item,
  badgeLabel,
  badgeClass,
}: {
  item: FeedItem;
  badgeLabel?: string;
  badgeClass?: string;
}) {
  const source = typeof item.author.name === "string" ? item.author.name : "";
  const [title, ...rest] = item.content.split("\n\n");
  const snippet = rest.join("\n\n").trim();

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        {badgeLabel && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${
              badgeClass ?? "bg-foreground/10 text-foreground"
            }`}
          >
            {badgeLabel}
          </span>
        )}
        {source && <span className="truncate max-w-[180px] text-foreground/80">{source}</span>}
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
      {snippet && (
        <p className="mt-1 line-clamp-3 text-[12.5px] leading-snug text-muted-foreground break-words">
          {snippet}
        </p>
      )}
      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground/80 transition-colors group-hover/item:text-[color:var(--brand-hover)]">
        <ExternalLink className="size-3" />
        <span className="truncate">{item.url}</span>
      </div>
    </a>
  );
}
