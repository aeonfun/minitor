"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkItem } from "@/lib/columns/shared/link-renderer";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { meta, type FacebookConfig, type FacebookMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<FacebookConfig>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="fb-q">Keyword or URL</Label>
      <Input
        id="fb-q"
        placeholder="anthropic.com, claude code, https://..."
        value={value.query}
        onChange={(e) => onChange({ query: e.target.value })}
      />
      <p className="text-xs text-muted-foreground">
        Searches public facebook.com posts and pages for mentions. URLs and keywords both work.
      </p>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<FacebookMeta>) {
  return (
    <LinkItem
      item={item}
      badgeLabel="Facebook"
      badgeClass="bg-[#1877F2]/15 text-foreground ring-1 ring-black/5"
    />
  );
}

export const column = defineColumnUI<FacebookConfig, FacebookMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
