"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defineColumnUI,
  type ConfigFormProps,
  type ItemRendererProps,
} from "@/lib/columns/types";
import { ReviewItem } from "@/lib/columns/shared/review-renderer";
import {
  meta,
  type PlayReviewsConfig,
  type PlayReviewsItemMeta,
} from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<PlayReviewsConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="play-reviews-id">Package ID</Label>
        <Input
          id="play-reviews-id"
          placeholder="com.spotify.music"
          value={value.appId}
          onChange={(e) => onChange({ ...value, appId: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Package ID from the URL —{" "}
          <code>play.google.com/store/apps/details?id=</code>
          <code className="text-foreground">com.spotify.music</code>.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="play-reviews-country">Country</Label>
        <Input
          id="play-reviews-country"
          placeholder="us"
          maxLength={2}
          value={value.country}
          onChange={(e) =>
            onChange({ ...value, country: e.target.value.toLowerCase() })
          }
        />
        <p className="text-xs text-muted-foreground">
          Two-letter country code. Defaults to <code>us</code>.
        </p>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<PlayReviewsItemMeta>) {
  return (
    <ReviewItem
      item={item}
      badgeLabel="Google Play"
      badgeColor="rgba(52, 168, 83, 0.18)"
    />
  );
}

export const column = defineColumnUI<PlayReviewsConfig, PlayReviewsItemMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
