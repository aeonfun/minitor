"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { AvatarPostItem } from "@/lib/columns/shared/avatar-post-item";
import { meta, type FCConfig, type FCMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<FCConfig>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="fc-q">Query</Label>
      <Input
        id="fc-q"
        placeholder="@dwr, from:vitalik, claude code, base…"
        value={value.query}
        onChange={(e) => onChange({ query: e.target.value })}
      />
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>How to use:</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>
            <code>@dwr</code> or <code>from:dwr</code> — that user&apos;s latest casts
          </li>
          <li>
            <code>claude code</code> — keyword search across Farcaster
          </li>
        </ul>
        <p>
          Falls back to Neynar&apos;s public demo key when no <code>NEYNAR_API_KEY</code> is set.
        </p>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<FCMeta>) {
  const m = item.meta;
  return (
    <AvatarPostItem
      item={item}
      replies={m?.replies ?? 0}
      reposts={m?.recasts ?? 0}
      likes={m?.likes ?? 0}
      powerBadge={m?.powerBadge === true}
      channel={m?.channelId}
    />
  );
}

export const column = defineColumnUI<FCConfig, FCMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
