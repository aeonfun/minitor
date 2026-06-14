"use client";

import { useState } from "react";
import { Palette } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { COLOR_SWATCHES, normalizeColumnColor } from "@/lib/deck-rules";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckName: string;
  initialColor: string | undefined;
  onSubmit: (color: string) => void;
}

export function DeckColorDialog({
  open,
  onOpenChange,
  deckName,
  initialColor,
  onSubmit,
}: Props) {
  const [draft, setDraft] = useState<string>(initialColor ?? "");
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initialColor ?? "");
  }

  const previewColor =
    draft.trim().length === 0 ? "" : (normalizeColumnColor(draft) ?? draft);
  const colorInputInvalid =
    draft.trim().length > 0 && normalizeColumnColor(draft) === null;
  const initialNormalized = normalizeColumnColor(initialColor ?? "") ?? "";
  const draftNormalized = normalizeColumnColor(draft) ?? "";
  // Save lights up either when the operator picks a different valid color, or
  // when they explicitly clear (initial had a color, draft is now empty).
  const cleared = draft.trim().length === 0 && initialNormalized.length > 0;
  const changedToValid =
    draftNormalized.length > 0 && draftNormalized !== initialNormalized;
  const canSave = cleared || changedToValid;

  function commit() {
    if (!canSave) return;
    // Empty string is the canonical "clear" payload — the server's
    // `normalizeColumnColor` treats both empty and invalid as "clear".
    onSubmit(cleared ? "" : draftNormalized);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="size-4" />
              Color {deckName}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="deck-color" className="text-xs font-medium">
              Deck color label
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
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
                    onClick={() => setDraft(swatch.value)}
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
                onClick={() => setDraft("")}
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
              id="deck-color"
              placeholder="#f97316"
              value={draft}
              maxLength={7}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={colorInputInvalid}
              className={cn(
                colorInputInvalid
                  && "border-destructive focus-visible:ring-destructive",
              )}
            />
            <p className="text-xs text-muted-foreground">
              {colorInputInvalid ? (
                <span className="text-destructive">
                  Enter a 6-digit hex color (e.g. <code>#f97316</code>) or
                  pick a preset above.
                </span>
              ) : (
                <>
                  Tag this deck with a color you can spot at a glance in the
                  sidebar and top bar. Same palette as column color labels.
                </>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
