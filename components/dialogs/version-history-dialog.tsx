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
  const loadDeckSnapshots = useDeckStore((s) => s.loadDeckSnapshots);
  const restoreDeckSnapshot = useDeckStore((s) => s.restoreDeckSnapshot);

  const [snapshots, setSnapshots] = useState<DeckSnapshotMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !deckId) return;
    let cancelled = false;
    // Entering the loading state as the fetch is kicked off is the point of
    // this effect — the data lives outside React and only the dialog opening
    // can trigger the read. Removing the cascade would mean moving snapshot
    // loading behind Suspense, which is out of scope here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    loadDeckSnapshots(deckId)
      .then((rows) => {
        if (!cancelled) setSnapshots(rows);
      })
      .catch(() => {
        if (!cancelled) setSnapshots([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, deckId, loadDeckSnapshots]);

  async function handleRestore(id: number) {
    if (restoringId !== null) return;
    setRestoringId(id);
    try {
      const result = await restoreDeckSnapshot(id);
      toast.success(`Restored "${result.deckName}"`, {
        description: `${result.columns.length} column${result.columns.length === 1 ? "" : "s"}`,
      });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Restore failed";
      toast.error("Restore failed", { description: msg });
    } finally {
      setRestoringId(null);
    }
  }

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

        <div className="grid gap-1.5">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : snapshots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No version history yet. Make a change to this deck and a snapshot
              will appear here.
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
      </DialogContent>
    </Dialog>
  );
}
