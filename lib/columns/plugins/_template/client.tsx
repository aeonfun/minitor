"use client";

// _template/client.tsx — the UI half of a plugin. Defines the form users see
// when configuring the column and the renderer for each item in the feed.
// Imports from `./plugin` for the shared metadata + types.

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { meta, type TemplateConfig, type TemplateMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<TemplateConfig>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="tmpl-q">Query</Label>
      <Input
        id="tmpl-q"
        placeholder="..."
        value={value.query}
        onChange={(e) => onChange({ ...value, query: e.target.value })}
      />
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<TemplateMeta>) {
  return (
    <article className="border-b border-border px-3.5 py-3">
      <div className="text-[11px] text-muted-foreground">{item.meta?.source ?? "source"}</div>
      <p className="mt-1 text-[12.5px] text-foreground">{item.content}</p>
    </article>
  );
}

export const column = defineColumnUI<TemplateConfig, TemplateMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
