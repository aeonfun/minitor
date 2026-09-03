"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { LinkItem } from "@/lib/columns/shared/link-renderer";
import { meta, type GoogleNewsConfig, type GoogleNewsMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<GoogleNewsConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="gnews-q">Query</Label>
        <Input
          id="gnews-q"
          placeholder='"AI agents" -openai'
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Google News search syntax — quotes, <code>-exclude</code>, <code>site:</code>, etc.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="gnews-hl">Language</Label>
          <Input
            id="gnews-hl"
            placeholder="all (e.g. en-US)"
            value={value.hl}
            onChange={(e) => onChange({ ...value, hl: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="gnews-gl">Country</Label>
          <Input
            id="gnews-gl"
            placeholder="all (e.g. US)"
            value={value.gl}
            onChange={(e) => onChange({ ...value, gl: e.target.value })}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Leave both blank for Google&apos;s default: all languages, mixed countries.
      </p>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<GoogleNewsMeta>) {
  return (
    <LinkItem
      item={item}
      badgeLabel="News"
      badgeClass="bg-[color:var(--chart-2)]/40 text-foreground ring-1 ring-black/5"
    />
  );
}

export const column = defineColumnUI<GoogleNewsConfig, GoogleNewsMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
