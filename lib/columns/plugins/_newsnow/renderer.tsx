"use client";

// Shared item renderer used by all per-platform NewsNow plugins
// (weibo-hot, zhihu-hot, douyin-hot, bilibili-hot, toutiao, baidu-hot).
// The leading-underscore folder name keeps this out of the plugin manifest.

import type { LucideIcon } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import type { FeedItem } from "@/lib/columns/types";

export interface NewsNowItemMeta {
  kind: "newsnow";
  platform: string;
  platformLabel: string;
  rank: number;
  info?: string;
}

interface RendererOptions {
  icon: LucideIcon;
  accent: string;
  badgeLabel: string;
}

function rgbaWithAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function makeNewsNowItemRenderer({ icon: Icon, accent, badgeLabel }: RendererOptions) {
  return function ItemRenderer({ item }: { item: FeedItem<NewsNowItemMeta> }) {
    const m = item.meta;
    const rank = m?.rank;
    const info = m?.info ?? "";
    const [title, ...rest] = item.content.split("\n\n");
    const description = rest.join("\n\n").trim();

    return (
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
      >
        <div className="flex items-start gap-2.5">
          {rank !== undefined && (
            <span
              className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums ring-1 ring-black/5"
              style={{
                backgroundColor: rank <= 3 ? rgbaWithAlpha(accent, 0.18) : "rgba(0, 0, 0, 0.05)",
                color: rank <= 3 ? accent : "var(--muted-foreground)",
              }}
            >
              {rank}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
                style={{ backgroundColor: rgbaWithAlpha(accent, 0.12) }}
              >
                <Icon className="size-3" style={{ color: accent }} strokeWidth={2.5} />
                {badgeLabel}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="tabular-nums">
                <RelativeTime date={item.createdAt} addSuffix />
              </span>
            </div>
            <h3
              className="mt-1 font-serif text-[16px] leading-[1.3] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand-hover)]"
              style={{
                letterSpacing: "-0.005em",
                fontFeatureSettings: '"cswh" 1',
              }}
            >
              {title}
            </h3>
            {description && (
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground break-words">
                {description}
              </p>
            )}
            {info && !description && (
              <p className="mt-1 text-[11.5px] tabular-nums text-muted-foreground">{info}</p>
            )}
          </div>
        </div>
      </a>
    );
  };
}

interface ConfigHintProps {
  description: string;
}

export function NewsNowConfigHint({ description }: ConfigHintProps) {
  return (
    <p className="rounded-md border border-border bg-surface/40 px-3 py-2 text-[11.5px] text-muted-foreground">
      {description}
    </p>
  );
}
