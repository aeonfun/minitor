"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { useDeckStore, TAB_GROUP_ALL } from "@/lib/store/use-deck-store";
import { ColumnCard } from "@/components/column/column-card";
import { AddColumnDialog } from "@/components/column/add-column-dialog";
import { cn } from "@/lib/utils";

export function DeckBoard({ deckId }: { deckId: string }) {
  const deck = useDeckStore((s) => s.decks[deckId]);
  const columns = useDeckStore((s) => s.columns);
  const reorderColumnsInDeck = useDeckStore((s) => s.reorderColumnsInDeck);
  const selectedTab = useDeckStore(
    (s) => s.selectedTabByDeck[deckId] ?? TAB_GROUP_ALL,
  );
  const setSelectedTab = useDeckStore((s) => s.setSelectedTab);
  const focusedColumnId = useDeckStore((s) => s.focusedColumnId);
  const setFocusedColumn = useDeckStore((s) => s.setFocusedColumn);
  const toggleColumnCollapsed = useDeckStore((s) => s.toggleColumnCollapsed);
  const requestSearchOpen = useDeckStore((s) => s.requestSearchOpen);
  const setColumnSearch = useDeckStore((s) => s.setColumnSearch);

  const [addOpen, setAddOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Build the unique, stable list of tab groups present in this deck. Sorted
  // by the column position they first appear in, so the operator's reorder is
  // the visual order of the tabs. Recomputed only when the deck's column list
  // or any column's tabGroup changes.
  const tabGroups = useMemo(() => {
    if (!deck) return [];
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const id of deck.columnIds) {
      const col = columns[id];
      const tg = col?.tabGroup;
      if (!tg || seen.has(tg)) continue;
      seen.add(tg);
      ordered.push(tg);
    }
    return ordered;
  }, [deck, columns]);

  // When the previously-selected tab disappears (last column in that group was
  // moved or had its tab cleared), fall back to "All" so the deck doesn't end
  // up showing zero columns with no obvious recovery.
  useEffect(() => {
    if (selectedTab === TAB_GROUP_ALL) return;
    if (!tabGroups.includes(selectedTab)) {
      setSelectedTab(deckId, TAB_GROUP_ALL);
    }
  }, [selectedTab, tabGroups, deckId, setSelectedTab]);

  const visibleColumnIds = useMemo(() => {
    if (!deck) return [];
    const tabFiltered =
      selectedTab === TAB_GROUP_ALL
        ? deck.columnIds
        : deck.columnIds.filter((id) => {
            const col = columns[id];
            // Pinned columns stay visible on every tab — that's the point of
            // pinning, and the Configure copy + header tooltip promise it.
            // Untagged columns ride along with every named tab too — otherwise
            // an operator who partially groups a deck loses their unlabeled
            // columns every time they click a tab, which reads as broken.
            return col?.pinned || !col || !col.tabGroup || col.tabGroup === selectedTab;
          });
    // Pinned columns render before every unpinned column regardless of the
    // stored position. Array.prototype.sort is stable, so the relative order
    // within the pinned group (and within the unpinned group) is preserved —
    // DnD reorder still works inside each group. This pass mutates a copy, so
    // the underlying deck.columnIds order (used by reorderColumnsInDeck and
    // the SortableContext below) is unchanged.
    const pinned: string[] = [];
    const unpinned: string[] = [];
    for (const id of tabFiltered) {
      if (columns[id]?.pinned) pinned.push(id);
      else unpinned.push(id);
    }
    return pinned.length === 0 ? tabFiltered : [...pinned, ...unpinned];
  }, [deck, columns, selectedTab]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Trackpad horizontal swipes (or shift+wheel) over a column get axis-locked
      // to the column's vertical scroll. Translate horizontal-dominant wheel
      // events into deck-board scroll regardless of cursor target.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        el.scrollLeft += e.deltaX;
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Keyboard navigation — `j`/`k` move focus between visible columns, `/`
  // opens the focused column's inline search, `c` toggles collapse on the
  // focused column, and `Escape` clears focus + the focused column's search.
  // Matches the shortcuts operators already have in muscle memory from Linear,
  // GitHub issues, and most terminal dashboards. We attach to `window` so the
  // listener is alive regardless of where focus lands inside the deck — but
  // we bail out as soon as the active element is text-editable, so typing
  // into a column's search box or the configure dialog never gets intercepted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Modifier keys belong to the browser/OS (Ctrl-J = downloads, ⌘K = …),
      // so let those through and only act on plain key presses.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (visibleColumnIds.length === 0) return;
      const currentIndex = focusedColumnId
        ? visibleColumnIds.indexOf(focusedColumnId)
        : -1;
      switch (e.key) {
        case "j":
        case "ArrowRight": {
          // No focus yet → first; otherwise → next, wrapping to first.
          const next =
            currentIndex < 0 || currentIndex === visibleColumnIds.length - 1
              ? visibleColumnIds[0]
              : visibleColumnIds[currentIndex + 1];
          setFocusedColumn(next);
          // Scroll the newly-focused column into view in the horizontal
          // scroller so j-spamming past the right edge doesn't strand the
          // focus ring off-screen. Same idea for `k` past the left edge.
          requestAnimationFrame(() => {
            document.getElementById(`column-${next}`)?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "nearest",
            });
          });
          e.preventDefault();
          break;
        }
        case "k":
        case "ArrowLeft": {
          const prev =
            currentIndex < 0 || currentIndex === 0
              ? visibleColumnIds[visibleColumnIds.length - 1]
              : visibleColumnIds[currentIndex - 1];
          setFocusedColumn(prev);
          requestAnimationFrame(() => {
            document.getElementById(`column-${prev}`)?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "nearest",
            });
          });
          e.preventDefault();
          break;
        }
        case "/": {
          // No-op when nothing is focused. Pressing `/` first then `j` would
          // be a worse default than pressing `j` first then `/` — surfacing
          // a search bar on a column the operator hasn't picked is the wrong
          // direction. They press `j` to pick a column, then `/` to search it.
          if (!focusedColumnId) return;
          requestSearchOpen(focusedColumnId);
          e.preventDefault();
          break;
        }
        case "c": {
          if (!focusedColumnId) return;
          toggleColumnCollapsed(focusedColumnId);
          e.preventDefault();
          break;
        }
        case "Escape": {
          // Two-step clear: first Escape press clears the focused column's
          // search (if active), second clears the focus ring itself. Lets the
          // operator stay focused on a column while exiting search-mode, then
          // step out of the column entirely on the next press.
          if (focusedColumnId && setColumnSearch) {
            // ColumnCard owns the searchOpen UI state and its own onKeyDown
            // already handles Escape inside the input. This Escape fires when
            // focus is OUTSIDE the input but the column is focused — clearing
            // the persisted query is the symmetric action.
            setColumnSearch(focusedColumnId, "");
          }
          setFocusedColumn(null);
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    visibleColumnIds,
    focusedColumnId,
    setFocusedColumn,
    toggleColumnCollapsed,
    requestSearchOpen,
    setColumnSearch,
  ]);

  if (!deck) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Deck not found.
      </div>
    );
  }

  function handleDragEnd(ev: DragEndEvent) {
    if (!deck) return;
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    // Drag is restricted to within the same pin group: pinned-among-pinned or
    // unpinned-among-unpinned. Dragging across the boundary would either need
    // to flip the pinned flag (surprising — the operator wanted to move, not
    // pin) or silently land the column in an unexpected slot once the visual
    // order is re-sorted in `visibleColumnIds`. The Pin-to-front checkbox in
    // Configure is the explicit affordance for crossing the boundary.
    const activePinned = columns[String(active.id)]?.pinned === true;
    const overPinned = columns[String(over.id)]?.pinned === true;
    if (activePinned !== overPinned) return;
    const oldIndex = deck.columnIds.indexOf(String(active.id));
    const newIndex = deck.columnIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    reorderColumnsInDeck(deck.id, arrayMove(deck.columnIds, oldIndex, newIndex));
  }

  const hasTabs = tabGroups.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {hasTabs && (
        <div className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background/60 px-2 sm:px-3">
          <TabButton
            label="All"
            count={deck.columnIds.length}
            active={selectedTab === TAB_GROUP_ALL}
            onClick={() => setSelectedTab(deck.id, TAB_GROUP_ALL)}
          />
          {tabGroups.map((tg) => {
            const count = deck.columnIds.reduce(
              (n, id) => n + (columns[id]?.tabGroup === tg ? 1 : 0),
              0,
            );
            return (
              <TabButton
                key={tg}
                label={tg}
                count={count}
                active={selectedTab === tg}
                onClick={() => setSelectedTab(deck.id, tg)}
              />
            );
          })}
        </div>
      )}

      <div
        ref={scrollerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory sm:snap-none"
      >
        <div className="flex h-full gap-2 p-2 sm:gap-3 sm:p-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleColumnIds}
              strategy={horizontalListSortingStrategy}
            >
              {visibleColumnIds.map((id) => {
                const col = columns[id];
                if (!col) return null;
                return <ColumnCard key={id} column={col} />;
              })}
            </SortableContext>
          </DndContext>

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="group relative flex h-full w-[min(280px,calc(100vw-1rem))] shrink-0 snap-start flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-dashed border-border bg-transparent text-sm text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-[oklab(0.263084_-0.00230259_0.0124794_/_0.22)] hover:bg-surface/40 hover:text-foreground hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.18)] active:translate-y-0 sm:w-[280px] sm:snap-none"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(circle at 50% 40%, rgba(245,78,0,0.08), transparent 60%)",
              }}
            />
            <div className="relative flex size-11 items-center justify-center rounded-full bg-surface-elevated ring-1 ring-border transition-all duration-200 group-hover:scale-110 group-hover:rotate-90 group-hover:bg-[color:var(--brand)] group-hover:text-white group-hover:ring-[color:var(--brand)]/50 group-hover:shadow-[0_0_0_6px_rgba(245,78,0,0.08)]">
              <Plus className="size-5 transition-transform duration-200" />
            </div>
            <span className="font-medium transition-transform duration-200 group-hover:translate-y-0.5">
              Add column
            </span>
          </button>
        </div>

        <AddColumnDialog open={addOpen} onOpenChange={setAddOpen} deckId={deck.id} />
      </div>
    </div>
  );
}

interface TabButtonProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, count, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
        active
          ? "bg-[color:var(--brand)]/10 text-[color:var(--brand)]"
          : "text-muted-foreground hover:bg-surface hover:text-foreground",
      )}
    >
      <span className="truncate max-w-[12rem]">{label}</span>
      <span className="rounded bg-surface-elevated px-1 text-[10px] tabular-nums text-muted-foreground">
        {count}
      </span>
    </button>
  );
}
