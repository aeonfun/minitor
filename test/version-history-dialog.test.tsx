// @vitest-environment jsdom

// Coverage for VersionHistoryDialog's per-open mount.
//
// The dialog element itself stays mounted for the lifetime of the sidebar, so
// nothing resets its state between opens on its own. The list is therefore
// split into a child that mounts per-open and is keyed by deck, which makes
// `useState`'s initial value the reset. These tests pin that down: a reopen
// must re-read the snapshots rather than show whatever the previous open left
// behind, and switching decks while open must not show the old deck's rows.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { VersionHistoryDialog } from "@/components/dialogs/version-history-dialog";
import { useDeckStore } from "@/lib/store/use-deck-store";
import type { DeckSnapshotMeta } from "@/app/actions";

const DECK_A = "deck-a";
const DECK_B = "deck-b";

function snapshot(id: number, columnCount = 1): DeckSnapshotMeta {
  return { id, capturedAt: new Date().toISOString(), columnCount };
}

let loadDeckSnapshots: ReturnType<typeof vi.fn>;

function seedStore(rowsByDeck: Record<string, DeckSnapshotMeta[]>) {
  loadDeckSnapshots = vi.fn(async (deckId: string) => rowsByDeck[deckId] ?? []);
  useDeckStore.setState({
    decks: {
      [DECK_A]: { id: DECK_A, name: "Alpha" },
      [DECK_B]: { id: DECK_B, name: "Beta" },
    } as never,
    loadDeckSnapshots,
  } as never);
}

beforeEach(() => {
  seedStore({ [DECK_A]: [snapshot(1)], [DECK_B]: [snapshot(2), snapshot(3)] });
});

describe("VersionHistoryDialog", () => {
  it("does not read snapshots while closed", () => {
    render(
      <VersionHistoryDialog deckId={DECK_A} open={false} onOpenChange={() => {}} />,
    );
    expect(loadDeckSnapshots).not.toHaveBeenCalled();
  });

  it("loads and lists snapshots on open", async () => {
    render(
      <VersionHistoryDialog deckId={DECK_A} open onOpenChange={() => {}} />,
    );

    expect(await screen.findByText("1 column")).toBeInTheDocument();
    expect(loadDeckSnapshots).toHaveBeenCalledWith(DECK_A);
  });

  it("re-reads snapshots on reopen instead of reusing the last result", async () => {
    const { rerender } = render(
      <VersionHistoryDialog deckId={DECK_A} open onOpenChange={() => {}} />,
    );
    await screen.findByText("1 column");
    expect(loadDeckSnapshots).toHaveBeenCalledTimes(1);

    rerender(
      <VersionHistoryDialog deckId={DECK_A} open={false} onOpenChange={() => {}} />,
    );
    rerender(
      <VersionHistoryDialog deckId={DECK_A} open onOpenChange={() => {}} />,
    );

    await waitFor(() => expect(loadDeckSnapshots).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("1 column")).toBeInTheDocument();
  });

  it("shows the loading state before rows arrive, not the empty state", async () => {
    // An unresolved read keeps the component in its initial state, which is
    // what the old separate `loading` boolean got wrong for one render.
    useDeckStore.setState({
      loadDeckSnapshots: vi.fn(() => new Promise<DeckSnapshotMeta[]>(() => {})),
    } as never);

    render(
      <VersionHistoryDialog deckId={DECK_A} open onOpenChange={() => {}} />,
    );

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText(/No version history yet/)).not.toBeInTheDocument();
  });

  it("reports an empty history once a read comes back with no rows", async () => {
    seedStore({ [DECK_A]: [] });
    render(
      <VersionHistoryDialog deckId={DECK_A} open onOpenChange={() => {}} />,
    );

    expect(await screen.findByText(/No version history yet/)).toBeInTheDocument();
  });

  it("never shows the previous deck's rows after switching decks", async () => {
    // The `key` is what makes this instant. Without it the effect still
    // refetches on the deckId change, but the component keeps its state, so
    // deck A's rows stay on screen until deck B's read resolves — the exact
    // stale-data window this asserts against. Deck B's read is held open so
    // that window would be observable if it existed.
    let releaseDeckB: (rows: DeckSnapshotMeta[]) => void = () => {};
    useDeckStore.setState({
      loadDeckSnapshots: vi.fn((deckId: string) =>
        deckId === DECK_A
          ? Promise.resolve([snapshot(1)])
          : new Promise<DeckSnapshotMeta[]>((resolve) => {
              releaseDeckB = resolve;
            }),
      ),
    } as never);

    const { rerender } = render(
      <VersionHistoryDialog deckId={DECK_A} open onOpenChange={() => {}} />,
    );
    expect(await screen.findByText("1 column")).toBeInTheDocument();

    rerender(
      <VersionHistoryDialog deckId={DECK_B} open onOpenChange={() => {}} />,
    );

    // Deck B is still in flight: the list must be back at its loading state,
    // showing nothing carried over from deck A.
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("1 column")).not.toBeInTheDocument();

    releaseDeckB([snapshot(2, 4)]);
    expect(await screen.findByText("4 columns")).toBeInTheDocument();
  });
});
