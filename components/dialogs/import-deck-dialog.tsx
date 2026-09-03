"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDeckStore } from "@/lib/store/use-deck-store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDeckDialog({ open, onOpenChange }: Props) {
  const importDeck = useDeckStore((s) => s.importDeck);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setValue("");
      setSubmitting(false);
    }
  }

  async function commit() {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const result = await importDeck(trimmed);
      toast.success(`Imported "${result.deckName}"`, {
        description: `${result.columns.length} column${result.columns.length === 1 ? "" : "s"}`,
      });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error("Import failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void commit();
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>Import deck</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="import-deck-input">Paste deck JSON</Label>
            <Textarea
              id="import-deck-input"
              value={value}
              placeholder='{"version":1,"deckName":"…","columns":[…]}'
              autoFocus
              spellCheck={false}
              className="min-h-48 font-mono text-xs"
              onChange={(e) => setValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The imported deck is added as a new deck with “(imported)” appended to its name — your
              existing decks aren’t touched.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim() || submitting}>
              {submitting ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
