"use client";

import { GitFork } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { GitHubWatcherItem } from "@/lib/columns/shared/github-watcher-item";
import { meta, type GHForksConfig, type GHForksMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<GHForksConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ghf-repo">Repository</Label>
        <Input
          id="ghf-repo"
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

function ItemRenderer({ item }: ItemRendererProps<GHForksMeta>) {
  return (
    <GitHubWatcherItem
      item={item}
      icon={GitFork}
      badgeLabel="Forked"
      badgeColor="rgba(159, 187, 224, 0.32)"
      verb="forked"
    />
  );
}

export const column = defineColumnUI<GHForksConfig, GHForksMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
