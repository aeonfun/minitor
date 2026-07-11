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
  type AppleReviewsConfig,
  type AppleReviewsItemMeta,
} from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<AppleReviewsConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="apple-reviews-id">App Store ID</Label>
        <Input
          id="apple-reviews-id"
          placeholder="284882215"
          value={value.appId}
          onChange={(e) => onChange({ ...value, appId: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Numeric ID from the URL — <code>apps.apple.com/.../id</code>
          <code className="text-foreground">284882215</code>.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="apple-reviews-country">Country</Label>
        <Input
          id="apple-reviews-country"
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

function ItemRenderer({ item }: ItemRendererProps<AppleReviewsItemMeta>) {
  return (
    <ReviewItem
      item={item}
      badgeLabel="App Store"
      badgeColor="rgba(0, 122, 255, 0.18)"
    />
  );
}

export const column = defineColumnUI<AppleReviewsConfig, AppleReviewsItemMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
