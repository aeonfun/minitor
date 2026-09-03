"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TweetItem } from "@/lib/columns/shared/tweet-renderer";
import { defineColumnUI, type ConfigFormProps } from "@/lib/columns/types";
import type { TweetMeta } from "@/lib/columns/plugins/x-search/plugin";
import { meta, type XTrendingConfig } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<XTrendingConfig>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="x-trending-t">Topic (optional)</Label>
      <Input
        id="x-trending-t"
        placeholder="AI, crypto, politics, startups…"
        value={value.topic}
        onChange={(e) => onChange({ topic: e.target.value })}
      />
      <p className="text-xs text-muted-foreground">
        Leave blank for global trending. Returns highest-engagement posts from the last 24 hours.
      </p>
    </div>
  );
}

export const column = defineColumnUI<XTrendingConfig, TweetMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer: TweetItem,
});
