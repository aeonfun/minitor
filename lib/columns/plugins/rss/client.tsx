"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { LinkItem } from "@/lib/columns/shared/link-renderer";
import { meta, type RssConfig, type RssMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<RssConfig>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="rss-url">Feed URL</Label>
      <Input
        id="rss-url"
        placeholder="https://news.ycombinator.com/rss"
        value={value.url}
        onChange={(e) => onChange({ url: e.target.value })}
      />
      <p className="text-xs text-muted-foreground">
        Any RSS or Atom feed. Works with blogs, Substacks, YouTube channel feeds, Google Alerts
        feeds, RSSHub URLs, etc.
      </p>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<RssMeta>) {
  return (
    <LinkItem
      item={item}
      badgeLabel="RSS"
      badgeClass="bg-[color:var(--chart-3)]/40 text-foreground ring-1 ring-black/5"
    />
  );
}

export const column = defineColumnUI<RssConfig, RssMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
