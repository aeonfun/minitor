"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { AvatarPostItem } from "@/lib/columns/shared/avatar-post-item";
import { meta, type MastodonConfig, type MastodonMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<MastodonConfig>) {
  const isAuthor = value.mode === "author";
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="mast-instance">Instance</Label>
        <Input
          id="mast-instance"
          placeholder="mastodon.social"
          value={value.instance}
          onChange={(e) => onChange({ ...value, instance: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Server to query (e.g. <code>mastodon.social</code>, <code>fosstodon.org</code>,{" "}
          <code>hachyderm.io</code>). For author mode you can also use the <code>user@server</code>{" "}
          form in the handle field and we&apos;ll route to that server automatically.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <div className="flex gap-1.5">
          <button
            type="button"
            className={`flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              value.mode === "hashtag"
                ? "border-foreground bg-foreground/5"
                : "border-border hover:bg-surface/60"
            }`}
            onClick={() => onChange({ ...value, mode: "hashtag" })}
          >
            Hashtag
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              value.mode === "author"
                ? "border-foreground bg-foreground/5"
                : "border-border hover:bg-surface/60"
            }`}
            onClick={() => onChange({ ...value, mode: "author" })}
          >
            Author
          </button>
        </div>
      </div>
      {isAuthor ? (
        <div className="grid gap-1.5">
          <Label htmlFor="mast-handle">Handle</Label>
          <Input
            id="mast-handle"
            placeholder="gargron, user@fosstodon.org…"
            value={value.handle}
            onChange={(e) => onChange({ ...value, handle: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Bare username uses the configured instance. Use <code>user@server</code> to follow
            someone on a different server.
          </p>
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="mast-query">Hashtag</Label>
          <Input
            id="mast-query"
            placeholder="opensource, photography, claudecode…"
            value={value.query}
            onChange={(e) => onChange({ ...value, query: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Tag name with or without the <code>#</code>. Hashtag timelines are keyless on every
            public Mastodon instance.
          </p>
        </div>
      )}
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<MastodonMeta>) {
  const m = item.meta;
  return (
    <AvatarPostItem
      item={item}
      replies={m?.replies ?? 0}
      reposts={m?.reblogs ?? 0}
      likes={m?.favourites ?? 0}
    />
  );
}

export const column = defineColumnUI<MastodonConfig, MastodonMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
