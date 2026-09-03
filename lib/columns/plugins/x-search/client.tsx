"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TweetItem } from "@/lib/columns/shared/tweet-renderer";
import { defineColumnUI, type ConfigFormProps } from "@/lib/columns/types";
import { meta, type XSearchConfig, type TweetMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<XSearchConfig>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="x-search-q">Search query</Label>
      <Input
        id="x-search-q"
        placeholder='from:vercel, @aaronjmars, "claude code", #ai, $BTC…'
        value={value.query}
        onChange={(e) => onChange({ query: e.target.value })}
      />
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Any X search operator works:</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>
            <code>from:vercel</code> — a user&apos;s timeline
          </li>
          <li>
            <code>to:vercel</code> or <code>@vercel</code> — mentions of a user
          </li>
          <li>
            <code>&quot;claude code&quot;</code> — exact phrase
          </li>
          <li>
            <code>#ai</code> · <code>$BTC</code> — hashtags / cashtags
          </li>
          <li>
            <code>min_faves:100</code> · <code>lang:en</code> · <code>since:2025-01-01</code>
          </li>
        </ul>
      </div>
    </div>
  );
}

export const column = defineColumnUI<XSearchConfig, TweetMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer: TweetItem,
});
