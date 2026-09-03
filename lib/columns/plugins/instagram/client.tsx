"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkItem } from "@/lib/columns/shared/link-renderer";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { meta, type InstagramConfig, type InstagramMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<InstagramConfig>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="ig-q">Keyword or URL</Label>
      <Input
        id="ig-q"
        placeholder="claude code  ·  https://example.com"
        value={value.query}
        onChange={(e) => onChange({ query: e.target.value })}
      />
      <p className="text-xs text-muted-foreground">
        Surfaces public Instagram posts (via web search) that mention your keyword, hashtag, or URL.
      </p>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<InstagramMeta>) {
  return (
    <LinkItem
      item={item}
      badgeLabel="Instagram"
      badgeClass="bg-[#e1306c]/20 text-foreground ring-1 ring-black/5"
    />
  );
}

export const column = defineColumnUI<InstagramConfig, InstagramMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
