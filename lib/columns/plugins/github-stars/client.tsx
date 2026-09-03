"use client";

import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { GitHubWatcherItem } from "@/lib/columns/shared/github-watcher-item";
import { meta, type GHStarsConfig, type GHStarsMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<GHStarsConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ghs-repo">Repository</Label>
        <Input
          id="ghs-repo"
          placeholder="vercel/next.js"
          value={value.repo}
          onChange={(e) => onChange({ ...value, repo: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          <code>owner/repo</code> or full GitHub URL.
        </p>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<GHStarsMeta>) {
  return (
    <GitHubWatcherItem
      item={item}
      icon={Star}
      badgeLabel="Starred"
      badgeColor="rgba(245, 166, 35, 0.22)"
      verb="starred"
    />
  );
}

export const column = defineColumnUI<GHStarsConfig, GHStarsMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
