"use client";

// Shared renderer for the github-stars / github-forks columns. Both render an
// identical "user did X to repo" card off GHWatcherItemMeta; only the badge
// (icon + label + tint) and verb differ. The fork-target link renders when the
// item carries a forkUrl (stars items never set one).

import type { LucideIcon } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import type { FeedItem } from "@/lib/columns/types";
import type { GHWatcherItemMeta } from "@/lib/integrations/github";

export function GitHubWatcherItem({
  item,
  icon: Icon,
  badgeLabel,
  badgeColor,
  verb,
}: {
  item: FeedItem<GHWatcherItemMeta>;
  icon: LucideIcon;
  badgeLabel: string;
  badgeColor: string;
  verb: string;
}) {
  const m = item.meta;
  const handle = item.author.handle ?? item.author.name;
  const repo = m?.repo ?? "";
  const repoUrl = repo ? `https://github.com/${repo}` : undefined;

  return (
    <article className="border-b border-border px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        {item.author.avatarUrl && (
          <a href={item.url} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.author.avatarUrl}
              alt={handle}
              className="size-8 rounded-full ring-1 ring-black/5"
              loading="lazy"
            />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
              style={{ backgroundColor: badgeColor }}
            >
              <Icon className="size-3" />
              {badgeLabel}
            </span>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="truncate font-medium text-foreground/90 hover:text-[color:var(--brand-hover)]"
            >
              {handle}
            </a>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums">
              <RelativeTime date={item.createdAt} addSuffix />
            </span>
          </div>
          {repo && (
            <p className="mt-1 text-[12.5px] text-foreground break-words">
              {verb}{" "}
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium hover:text-[color:var(--brand-hover)]"
              >
                {repo}
              </a>
              {m?.forkUrl && (
                <>
                  {" → "}
                  <a
                    href={m.forkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground/80 hover:text-[color:var(--brand-hover)]"
                  >
                    {m.forkUrl.replace(/^https?:\/\/github\.com\//, "")}
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
