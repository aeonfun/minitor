"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkItem } from "@/lib/columns/shared/link-renderer";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { meta, type NewsSearchConfig, type NewsSearchMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<NewsSearchConfig>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="news-q">Topic</Label>
      <Input
        id="news-q"
        placeholder="AI regulation, startup funding, elections…"
        value={value.query}
        onChange={(e) => onChange({ query: e.target.value })}
      />
      <p className="text-xs text-muted-foreground">
        Latest news articles from major publications matching the topic.
      </p>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<NewsSearchMeta>) {
  return (
    <LinkItem
      item={item}
      badgeLabel="News"
      badgeClass="bg-[color:var(--chart-4)]/50 text-foreground ring-1 ring-black/5"
    />
  );
}

export const column = defineColumnUI<NewsSearchConfig, NewsSearchMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
