"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkItem } from "@/lib/columns/shared/link-renderer";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { meta, type LinkedinConfig, type LinkedinMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<LinkedinConfig>) {
  const isUrl = /^https?:\/\//i.test(value.query.trim());
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="li-q">Keyword or URL</Label>
      <Input
        id="li-q"
        placeholder='"anthropic", https://yourdomain.com'
        value={value.query}
        onChange={(e) => onChange({ query: e.target.value })}
      />
      <p className="text-xs text-muted-foreground">
        {isUrl
          ? "URL is matched as an exact phrase against LinkedIn posts."
          : "Searches public LinkedIn posts for keyword mentions."}
      </p>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<LinkedinMeta>) {
  return (
    <LinkItem
      item={item}
      badgeLabel="LinkedIn"
      badgeClass="bg-[#0a66c2]/15 text-foreground ring-1 ring-black/5"
    />
  );
}

export const column = defineColumnUI<LinkedinConfig, LinkedinMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
