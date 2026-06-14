"use client";

import { useState } from "react";
import { Bell, Clock, EyeOff, Filter, LayoutGrid, Palette, Pin, Webhook } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getColumnType } from "@/lib/columns/registry";
import { useDeckStore } from "@/lib/store/use-deck-store";
import { parseAlertKeywords } from "@/lib/columns/keyword-match";
import { validateWebhookUrl, WEBHOOK_URL_MAX } from "@/lib/columns/webhook";
import {
  COLOR_SWATCHES,
  normalizeColumnColor,
  normalizeTabGroup,
  TAB_GROUP_MAX,
} from "@/lib/deck-rules";
import type { Column } from "@/lib/columns/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: Column;
}

const ALERT_KEYWORDS_MAX = 512;

// Sentinel for the Select value when the operator chooses "Manual only" —
// Radix's Select disallows empty-string values, so we use a non-numeric token
// and convert to `null` (= manual-only) on save.
const REFRESH_MANUAL = "manual";

const REFRESH_OPTIONS: { value: string; label: string }[] = [
  { value: REFRESH_MANUAL, label: "Manual only" },
  { value: "60", label: "Every minute" },
  { value: "300", label: "Every 5 minutes" },
  { value: "900", label: "Every 15 minutes" },
  { value: "3600", label: "Every 60 minutes" },
];

function refreshIntervalToOption(value: number | undefined): string {
  if (value === undefined) return REFRESH_MANUAL;
  const match = REFRESH_OPTIONS.find((o) => o.value === String(value));
  return match ? match.value : REFRESH_MANUAL;
}

export function ConfigureColumnDialog({ open, onOpenChange, column }: Props) {
  const type = getColumnType(column.typeId);
  const updateColumnConfig = useDeckStore((s) => s.updateColumnConfig);
  const updateAlertKeywords = useDeckStore((s) => s.updateAlertKeywords);
  const updateWebhookUrl = useDeckStore((s) => s.updateWebhookUrl);
  const updateRefreshInterval = useDeckStore((s) => s.updateRefreshInterval);
  const updateFilters = useDeckStore((s) => s.updateFilters);
  const updateTabGroup = useDeckStore((s) => s.updateTabGroup);
  const updatePinned = useDeckStore((s) => s.updatePinned);
  const updateColor = useDeckStore((s) => s.updateColor);

  const [draft, setDraft] = useState<Record<string, unknown>>(column.config);
  const [alertDraft, setAlertDraft] = useState<string>(
    column.alertKeywords ?? "",
  );
  const [webhookDraft, setWebhookDraft] = useState<string>(
    column.notifyWebhookUrl ?? "",
  );
  const [refreshDraft, setRefreshDraft] = useState<string>(
    refreshIntervalToOption(column.refreshIntervalSeconds),
  );
  const [filterDraft, setFilterDraft] = useState<string>(
    column.filterKeywords ?? "",
  );
  const [excludeDraft, setExcludeDraft] = useState<string>(
    column.excludeKeywords ?? "",
  );
  const [tabGroupDraft, setTabGroupDraft] = useState<string>(
    column.tabGroup ?? "",
  );
  const [pinnedDraft, setPinnedDraft] = useState<boolean>(
    column.pinned === true,
  );
  const [colorDraft, setColorDraft] = useState<string>(column.color ?? "");
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(column.config);
      setAlertDraft(column.alertKeywords ?? "");
      setWebhookDraft(column.notifyWebhookUrl ?? "");
      setRefreshDraft(refreshIntervalToOption(column.refreshIntervalSeconds));
      setFilterDraft(column.filterKeywords ?? "");
      setExcludeDraft(column.excludeKeywords ?? "");
      setTabGroupDraft(column.tabGroup ?? "");
      setPinnedDraft(column.pinned === true);
      setColorDraft(column.color ?? "");
    }
  }

  if (!type) return null;

  const parsedPreview = parseAlertKeywords(alertDraft);
  const previewCount = parsedPreview.length;
  const keywordsPresent = previewCount > 0;

  const filterTermCount = parseAlertKeywords(filterDraft).length;
  const excludeTermCount = parseAlertKeywords(excludeDraft).length;

  // Validate only when the field is shown (keywords present) and non-empty.
  const trimmedWebhook = webhookDraft.trim();
  const webhookValidation =
    keywordsPresent && trimmedWebhook.length > 0
      ? validateWebhookUrl(trimmedWebhook)
      : null;
  const webhookError =
    webhookValidation && !webhookValidation.ok ? webhookValidation.reason : null;

  function save() {
    if (webhookError) return;
    updateColumnConfig(column.id, draft);
    const nextKw = alertDraft.slice(0, ALERT_KEYWORDS_MAX);
    if (nextKw !== (column.alertKeywords ?? "")) {
      updateAlertKeywords(column.id, nextKw);
    }
    // Only persist the webhook when keywords are set (a webhook with no
    // keywords can never fire). When keywords are absent the field is hidden
    // and we leave any stored webhook untouched (dormant), so re-adding
    // keywords later reactivates it.
    if (keywordsPresent) {
      const nextWebhook = webhookDraft.trim();
      if (nextWebhook !== (column.notifyWebhookUrl ?? "")) {
        updateWebhookUrl(column.id, nextWebhook);
      }
    }
    const nextRefresh =
      refreshDraft === REFRESH_MANUAL ? null : Number(refreshDraft);
    const currentRefresh = column.refreshIntervalSeconds ?? null;
    if (nextRefresh !== currentRefresh) {
      updateRefreshInterval(column.id, nextRefresh);
    }
    const nextFilter = filterDraft.slice(0, ALERT_KEYWORDS_MAX);
    const nextExclude = excludeDraft.slice(0, ALERT_KEYWORDS_MAX);
    if (
      nextFilter !== (column.filterKeywords ?? "") ||
      nextExclude !== (column.excludeKeywords ?? "")
    ) {
      updateFilters(column.id, nextFilter, nextExclude);
    }
    const nextTabGroup = normalizeTabGroup(tabGroupDraft);
    if (nextTabGroup !== (column.tabGroup ?? "")) {
      updateTabGroup(column.id, nextTabGroup);
    }
    if (pinnedDraft !== (column.pinned === true)) {
      updatePinned(column.id, pinnedDraft);
    }
    // Normalize before the equality check so "#F97316", " #f97316 " and
    // "#f97316" all map to the same canonical value and don't trigger a
    // spurious update.
    const nextColor = normalizeColumnColor(colorDraft) ?? "";
    if (nextColor !== (column.color ?? "")) {
      updateColor(column.id, nextColor);
    }
    onOpenChange(false);
  }

  const colorInputInvalid =
    colorDraft.trim().length > 0 && normalizeColumnColor(colorDraft) === null;
  const previewColor = normalizeColumnColor(colorDraft) ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure {type.label}</DialogTitle>
          <DialogDescription>{type.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <type.ConfigForm
            value={draft as never}
            onChange={(v) => setDraft(v as Record<string, unknown>)}
          />

          <Separator />

          <div className="grid gap-1.5">
            <Label htmlFor="alert-keywords" className="flex items-center gap-1.5">
              <Bell className="size-3.5" />
              Alert keywords
              <span className="text-[11px] font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="alert-keywords"
              placeholder="aeon, anthropic, claude"
              value={alertDraft}
              maxLength={ALERT_KEYWORDS_MAX}
              onChange={(e) => setAlertDraft(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Comma- or space-separated. Matching items get a highlight ring and
              the column header shows a badge with the match count.
              {previewCount > 0 && (
                <>
                  {" "}
                  Parsed {previewCount} term{previewCount === 1 ? "" : "s"}.
                </>
              )}
            </p>
          </div>

          {keywordsPresent && (
            <div className="grid gap-1.5">
              <Label
                htmlFor="alert-webhook"
                className="flex items-center gap-1.5"
              >
                <Webhook className="size-3.5" />
                Alert webhook URL
                <span className="text-[11px] font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="alert-webhook"
                type="url"
                inputMode="url"
                placeholder="https://hooks.example.com/…"
                value={webhookDraft}
                maxLength={WEBHOOK_URL_MAX}
                aria-invalid={webhookError ? true : undefined}
                onChange={(e) => setWebhookDraft(e.target.value)}
              />
              {webhookError ? (
                <p className="text-xs text-destructive">{webhookError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  POST to this URL when alert keywords match new items. HTTPS
                  only. Sent server-side; not included in deck exports or share
                  links.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label
              htmlFor="refresh-interval"
              className="flex items-center gap-1.5"
            >
              <Clock className="size-3.5" />
              Refresh interval
              <span className="text-[11px] font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Select
              value={refreshDraft}
              onValueChange={(v) => setRefreshDraft(v ?? REFRESH_MANUAL)}
            >
              <SelectTrigger id="refresh-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Auto-refresh pauses while the browser tab is hidden so background
              tabs don&rsquo;t burn upstream rate limits.
            </p>
          </div>

          <Separator />

          <div className="grid gap-1.5">
            <Label htmlFor="filter-keywords" className="flex items-center gap-1.5">
              <Filter className="size-3.5" />
              Show only
              <span className="text-[11px] font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="filter-keywords"
              placeholder="release, launch, vulnerability"
              value={filterDraft}
              maxLength={ALERT_KEYWORDS_MAX}
              onChange={(e) => setFilterDraft(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Comma- or space-separated. When set, the column hides items that
              match none of these terms (in title, body, or link).
              {filterTermCount > 0 && (
                <>
                  {" "}
                  Parsed {filterTermCount} term{filterTermCount === 1 ? "" : "s"}.
                </>
              )}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="exclude-keywords" className="flex items-center gap-1.5">
              <EyeOff className="size-3.5" />
              Hide items matching
              <span className="text-[11px] font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="exclude-keywords"
              placeholder="airdrop, giveaway"
              value={excludeDraft}
              maxLength={ALERT_KEYWORDS_MAX}
              onChange={(e) => setExcludeDraft(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Items matching any of these terms are hidden. Exclude wins over
              &ldquo;show only&rdquo; when an item matches both.
              {excludeTermCount > 0 && (
                <>
                  {" "}
                  Parsed {excludeTermCount} term{excludeTermCount === 1 ? "" : "s"}.
                </>
              )}
            </p>
          </div>

          <Separator />

          <div className="grid gap-1.5">
            <Label
              htmlFor="pin-to-front"
              className="flex items-center gap-1.5"
            >
              <Pin className="size-3.5" />
              Pin to front
              <span className="text-[11px] font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <label
              htmlFor="pin-to-front"
              className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-surface/40 px-3 py-2 hover:bg-surface"
            >
              <input
                id="pin-to-front"
                type="checkbox"
                checked={pinnedDraft}
                onChange={(e) => setPinnedDraft(e.target.checked)}
                className="mt-0.5 size-4 cursor-pointer accent-[color:var(--brand)]"
              />
              <span className="text-xs text-muted-foreground">
                Pinned columns render before every other column in the deck and
                stay visible regardless of the active tab. DnD reorder still
                works within the pinned and unpinned groups.
              </span>
            </label>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="column-color" className="flex items-center gap-1.5">
              <Palette className="size-3.5" />
              Color label
              <span className="text-[11px] font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLOR_SWATCHES.map((swatch) => {
                const isSelected = previewColor === swatch.value;
                return (
                  <button
                    key={swatch.value}
                    type="button"
                    aria-label={swatch.label}
                    aria-pressed={isSelected}
                    title={swatch.label}
                    onClick={() => setColorDraft(swatch.value)}
                    className={cn(
                      "size-7 shrink-0 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      isSelected
                        && "ring-2 ring-[color:var(--brand)] ring-offset-2 ring-offset-card",
                    )}
                    style={{ backgroundColor: swatch.value }}
                  />
                );
              })}
              <button
                type="button"
                onClick={() => setColorDraft("")}
                aria-pressed={previewColor === ""}
                title="No color"
                className={cn(
                  "ml-1 inline-flex h-7 items-center justify-center rounded-full border border-border bg-surface/40 px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  previewColor === ""
                    && "ring-1 ring-[color:var(--brand)] text-foreground",
                )}
              >
                Clear
              </button>
            </div>
            <Input
              id="column-color"
              placeholder="#f97316"
              value={colorDraft}
              maxLength={7}
              onChange={(e) => setColorDraft(e.target.value)}
              aria-invalid={colorInputInvalid}
              className={cn(
                colorInputInvalid && "border-destructive focus-visible:ring-destructive",
              )}
            />
            <p className="text-xs text-muted-foreground">
              {colorInputInvalid ? (
                <span className="text-destructive">
                  Enter a 6-digit hex color (e.g. <code>#f97316</code>) or pick
                  a preset above.
                </span>
              ) : (
                <>
                  Group columns visually at a glance — e.g. orange for DeFi,
                  blue for repos. Shows as a dot in the column header and as
                  the accent line on the collapsed strip.
                </>
              )}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tab-group" className="flex items-center gap-1.5">
              <LayoutGrid className="size-3.5" />
              Tab group
              <span className="text-[11px] font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="tab-group"
              placeholder="DeFi, Social, Dev…"
              value={tabGroupDraft}
              maxLength={TAB_GROUP_MAX}
              onChange={(e) => setTabGroupDraft(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              When any column in the deck has a tab group, a tab bar appears
              above the grid. Untagged columns live under an &ldquo;All&rdquo;
              tab. Leave blank to keep the column visible on every tab.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={Boolean(webhookError)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
