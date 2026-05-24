"use client";

import { useState } from "react";
import { Bell, Clock } from "lucide-react";

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
import { getColumnType } from "@/lib/columns/registry";
import { useDeckStore } from "@/lib/store/use-deck-store";
import { parseAlertKeywords } from "@/lib/columns/keyword-match";
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
  const updateRefreshInterval = useDeckStore((s) => s.updateRefreshInterval);

  const [draft, setDraft] = useState<Record<string, unknown>>(column.config);
  const [alertDraft, setAlertDraft] = useState<string>(
    column.alertKeywords ?? "",
  );
  const [refreshDraft, setRefreshDraft] = useState<string>(
    refreshIntervalToOption(column.refreshIntervalSeconds),
  );
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(column.config);
      setAlertDraft(column.alertKeywords ?? "");
      setRefreshDraft(refreshIntervalToOption(column.refreshIntervalSeconds));
    }
  }

  if (!type) return null;

  function save() {
    updateColumnConfig(column.id, draft);
    const next = alertDraft.slice(0, ALERT_KEYWORDS_MAX);
    if (next !== (column.alertKeywords ?? "")) {
      updateAlertKeywords(column.id, next);
    }
    const nextRefresh =
      refreshDraft === REFRESH_MANUAL ? null : Number(refreshDraft);
    const currentRefresh = column.refreshIntervalSeconds ?? null;
    if (nextRefresh !== currentRefresh) {
      updateRefreshInterval(column.id, nextRefresh);
    }
    onOpenChange(false);
  }

  const parsedPreview = parseAlertKeywords(alertDraft);
  const previewCount = parsedPreview.length;

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
