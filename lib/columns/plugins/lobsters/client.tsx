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
import { meta, type LobstersConfig, type LobstersMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<LobstersConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) => onChange({ ...value, mode: v as LobstersConfig["mode"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hottest">Hottest</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="active">Active discussions</SelectItem>
            <SelectItem value="tag">By tag…</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.mode === "tag" && (
        <div className="grid gap-1.5">
          <Label htmlFor="lob-tag">Tag</Label>
          <Input
            id="lob-tag"
            placeholder="rust, ai, programming…"
            value={value.tag}
            onChange={(e) => onChange({ ...value, tag: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            One tag, or several comma-separated. See{" "}
            <a
              href="https://lobste.rs/tags"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              lobste.rs/tags
            </a>{" "}
            for the full list.
          </p>
        </div>
      )}
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<LobstersMeta>) {
  const m = item.meta;
  return (
    <AggregatorItem
      item={item}
      badge={{
        letter: "L",
        label: "Lobsters",
        bgColor: "rgba(172, 19, 13, 0.16)",
        boxColor: "#ac130d",
      }}
      score={m?.score ?? 0}
      comments={m?.comments ?? 0}
      commentsUrl={m?.commentsUrl ?? item.url}
      tags={m?.tags}
    />
  );
}

export const column = defineColumnUI<LobstersConfig, LobstersMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
