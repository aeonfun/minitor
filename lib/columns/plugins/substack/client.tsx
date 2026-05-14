"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  defineColumnUI,
  type ConfigFormProps,
  type ItemRendererProps,
} from "@/lib/columns/types";
import { LinkItem } from "@/lib/columns/shared/link-renderer";
import { meta, type SubstackConfig, type SubstackMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<SubstackConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="sub-handles">Publications (optional)</Label>
        <Textarea
          id="sub-handles"
          placeholder={"mattyglesias\nslowboring\npluralistic.net"}
          value={value.handles}
          onChange={(e) => onChange({ ...value, handles: e.target.value })}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          One per line, or comma-separated. Use the handle (
          <code>mattyglesias</code>), the full Substack URL (
          <code>slowboring.substack.com</code>), or a custom-domain Substack (
          <code>pluralistic.net</code>, <code>astralcodexten.com</code>) —
          anything that exposes <code>/feed</code>. Per-publication RSS is
          keyless. Leave empty to search all of Substack via xAI web search.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sub-q">Keyword or URL</Label>
        <Input
          id="sub-q"
          placeholder='"AI agents", anthropic.com, https://...'
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          With publications: optional — leave blank for every recent post.
          Without publications: required — drives a global Substack search.
        </p>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<SubstackMeta>) {
  return (
    <LinkItem
      item={item}
      badgeLabel="Substack"
      badgeClass="bg-[color:var(--chart-1)]/40 text-foreground ring-1 ring-black/5"
    />
  );
}

export const column = defineColumnUI<SubstackConfig, SubstackMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
