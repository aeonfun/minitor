"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { AggregatorItem } from "@/lib/columns/shared/aggregator-item";
import { meta, type HNConfig, type HNMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<HNConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) => onChange({ ...value, mode: v as HNConfig["mode"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Front page</SelectItem>
            <SelectItem value="new">Newest</SelectItem>
            <SelectItem value="ask">Ask HN</SelectItem>
            <SelectItem value="show">Show HN</SelectItem>
            <SelectItem value="query">Search…</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.mode === "query" && (
        <div className="grid gap-1.5">
          <Label htmlFor="hn-q">Query</Label>
          <Input
            id="hn-q"
            placeholder="rust, llm, anthropic..."
            value={value.query}
            onChange={(e) => onChange({ ...value, query: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Searches HN stories via Algolia.</p>
        </div>
      )}
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<HNMeta>) {
  const m = item.meta;
  return (
    <AggregatorItem
      item={item}
      badge={{
        letter: "Y",
        label: "HN",
        bgColor: "rgba(255, 102, 0, 0.16)",
        boxColor: "#ff6600",
      }}
      score={m?.points ?? 0}
      comments={m?.comments ?? 0}
      commentsUrl={m?.commentsUrl ?? item.url}
    />
  );
}

export const column = defineColumnUI<HNConfig, HNMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
