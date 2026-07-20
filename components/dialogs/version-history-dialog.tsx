"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/relative-time";
import { useDeckStore } from "@/lib/store/use-deck-store";
import type { DeckSnapshotMeta } from "@/app/actions";

interface Props {
  deckId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistoryDialog({ deckId, open, onOpenChange }: Props) {
  const deckName = useDeckStore((s) =>
    deckId ? (s.decks[deckId]?.name ?? "") : "",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" />
            Version history
            {deckName ? (
              <span className="truncate font-normal text-muted-foreground">
                · {deckName}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Snapshots are captured automatically before you add, remove, or
          reorder columns. Restoring creates a new deck with “(restored)”
          appended — your current deck isn’t touched.
        </p>

        {/*
          This component stays mounted for the lifetime of the sidebar, so any
          state it held directly would survive every open — which is why the
          old version had to lower a loading flag from an effect. Holding the
          state one level down instead makes `useState`'s initial value the
          reset, because DialogContent unmounts its children on close.

          The `key` covers the case the unmount does not: switching decks while
          the dialog is already open. Without it the list keeps the previous
          deck's rows on screen until the new read resolves. The `open` check
          is belt-and-braces — DialogContent already gates this subtree.
        */}
        {open && deckId ? (
          <SnapshotList
            key={deckId}
            deckId={deckId}
            onRestored={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SnapshotList({
  deckId,
  onRestored,
}: {
  deckId: string;
  onRestored: () => void;
}) {
  const loadDeckSnapshots = useDeckStore((s) => s.loadDeckSnapshots);
  const restoreDeckSnapshot = useDeckStore((s) => s.restoreDeckSnapshot);

  // `null` means "not loaded yet" — one state instead of a separate `loading`
  // flag that had to be raised and lowered around the fetch. It also removes a
  // flash of the empty-state copy on first paint, which the old `loading`
  // default of `false` allowed for one render.
  const [snapshots, setSnapshots] = useState<DeckSnapshotMeta[] | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDeckSnapshots(deckId)
      .then((rows) => {
        if (!cancelled) setSnapshots(rows);
      })
      .catch(() => {
        if (!cancelled) setSnapshots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [deckId, loadDeckSnapshots]);

  async function handleRestore(id: number) {
    if (restoringId !== null) return;
    setRestoringId(id);
    try {
      const result = await restoreDeckSnapshot(id);
      toast.success(`Restored "${result.deckName}"`, {
        description: `${result.columns.length} column${result.columns.length === 1 ? "" : "s"}`,
      });
      onRestored();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Restore failed";
      toast.error("Restore failed", { description: msg });
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="grid gap-1.5">
      {snapshots === null ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Loading…
        </p>
      ) : snapshots.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No version history yet. Make a change to this deck and a snapshot will
          appear here.
        </p>
      ) : (
        snapshots.map((snap) => (
          <div
            key={snap.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm">
                <RelativeTime date={snap.capturedAt} addSuffix />
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {snap.columnCount} column{snap.columnCount === 1 ? "" : "s"}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={restoringId !== null}
              onClick={() => handleRestore(snap.id)}
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              {restoringId === snap.id ? "Restoring…" : "Restore"}
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
