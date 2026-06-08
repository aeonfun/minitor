"use client";

import {
  ChevronDown,
  GripVertical,
  History,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { getColumnType } from "@/lib/columns/registry";
import { useDeckStore } from "@/lib/store/use-deck-store";
import type { Column, Deck } from "@/lib/columns/types";
import { RenameDialog } from "@/components/dialogs/rename-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { VersionHistoryDialog } from "@/components/dialogs/version-history-dialog";
import { DeckColorDialog } from "@/components/dialogs/deck-color-dialog";
import { AddColumnDialog } from "@/components/column/add-column-dialog";

export function focusColumn(columnId: string) {
  if (typeof window === "undefined") return;
  const el = document.getElementById(`column-${columnId}`);
  el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}

export function NavDecks() {
  const decks = useDeckStore((s) => s.decks);
  const deckOrder = useDeckStore((s) => s.deckOrder);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const columns = useDeckStore((s) => s.columns);
  const setActiveDeck = useDeckStore((s) => s.setActiveDeck);
  const renameDeck = useDeckStore((s) => s.renameDeck);
  const updateDeckColor = useDeckStore((s) => s.updateDeckColor);
  const deleteDeck = useDeckStore((s) => s.deleteDeck);
  const reorderDecks = useDeckStore((s) => s.reorderDecks);
  const renameColumn = useDeckStore((s) => s.renameColumn);
  const removeColumn = useDeckStore((s) => s.removeColumn);

  const [renameDeckId, setRenameDeckId] = useState<string | null>(null);
  const [renameColumnId, setRenameColumnId] = useState<string | null>(null);
  const [addColumnDeckId, setAddColumnDeckId] = useState<string | null>(null);
  const [deleteDeckId, setDeleteDeckId] = useState<string | null>(null);
  const [deleteColumnId, setDeleteColumnId] = useState<string | null>(null);
  const [historyDeckId, setHistoryDeckId] = useState<string | null>(null);
  const [colorDeckId, setColorDeckId] = useState<string | null>(null);

  // Per-deck explicit open overrides. Decks not in this map fall back to
  // "open if active". Once the user toggles a deck, the override sticks.
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const isDeckOpen = (deckId: string) =>
    deckId in openOverrides ? openOverrides[deckId] : deckId === activeDeckId;
  const setDeckOpen = (deckId: string, open: boolean) =>
    setOpenOverrides((prev) => ({ ...prev, [deckId]: open }));

  const sensors = useSensors(
    // 4px activation distance is the same threshold the deck-board uses for
    // column DnD — a deliberate click on the handle still registers as a click
    // (e.g. accidentally activating the collapse trigger), only a real drag
    // intent (>4px movement) starts a sort.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const oldIndex = deckOrder.indexOf(activeId);
    const newIndex = deckOrder.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderDecks(arrayMove(deckOrder, oldIndex, newIndex));
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={deckOrder}
          strategy={verticalListSortingStrategy}
        >
          {deckOrder.map((deckId) => {
            const deck = decks[deckId];
            if (!deck) return null;
            return (
              <SortableDeck
                key={deckId}
                deck={deck}
                columns={columns}
                isActive={deckId === activeDeckId}
                isOpen={isDeckOpen(deckId)}
                onOpenChange={(open) => setDeckOpen(deckId, open)}
                onActivate={() => setActiveDeck(deckId)}
                onRenameDeck={() => setRenameDeckId(deckId)}
                onRenameColumn={(cid) => setRenameColumnId(cid)}
                onColorDeck={() => setColorDeckId(deckId)}
                onHistoryDeck={() => setHistoryDeckId(deckId)}
                onDeleteDeck={() => setDeleteDeckId(deckId)}
                onDeleteColumn={(cid) => setDeleteColumnId(cid)}
                onAddColumn={() => {
                  if (deckId !== activeDeckId) setActiveDeck(deckId);
                  setAddColumnDeckId(deckId);
                }}
              />
            );
          })}
        </SortableContext>
      </DndContext>

      <RenameDialog
        open={renameDeckId !== null}
        onOpenChange={(o) => !o && setRenameDeckId(null)}
        title="Rename deck"
        initialValue={renameDeckId ? (decks[renameDeckId]?.name ?? "") : ""}
        onSubmit={(next) => {
          if (renameDeckId) renameDeck(renameDeckId, next);
        }}
      />
      <RenameDialog
        open={renameColumnId !== null}
        onOpenChange={(o) => !o && setRenameColumnId(null)}
        title="Rename column"
        initialValue={
          renameColumnId ? (columns[renameColumnId]?.title ?? "") : ""
        }
        onSubmit={(next) => {
          if (renameColumnId) renameColumn(renameColumnId, next);
        }}
      />
      {addColumnDeckId && (
        <AddColumnDialog
          open
          onOpenChange={(o) => !o && setAddColumnDeckId(null)}
          deckId={addColumnDeckId}
        />
      )}

      <ConfirmDialog
        open={deleteDeckId !== null}
        onOpenChange={(o) => !o && setDeleteDeckId(null)}
        title={`Delete ${deleteDeckId ? decks[deleteDeckId]?.name : "deck"}?`}
        description="All columns in this deck and their stored items will be deleted. This can't be undone."
        confirmLabel="Delete deck"
        onConfirm={() => {
          if (deleteDeckId) deleteDeck(deleteDeckId);
          setDeleteDeckId(null);
        }}
      />
      <ConfirmDialog
        open={deleteColumnId !== null}
        onOpenChange={(o) => !o && setDeleteColumnId(null)}
        title={`Delete ${deleteColumnId ? columns[deleteColumnId]?.title : "column"}?`}
        description="Stored items for this column will be deleted. The column type is not affected."
        confirmLabel="Delete column"
        onConfirm={() => {
          if (deleteColumnId) removeColumn(deleteColumnId);
          setDeleteColumnId(null);
        }}
      />
      <VersionHistoryDialog
        deckId={historyDeckId}
        open={historyDeckId !== null}
        onOpenChange={(o) => !o && setHistoryDeckId(null)}
      />
      <DeckColorDialog
        open={colorDeckId !== null}
        onOpenChange={(o) => !o && setColorDeckId(null)}
        deckName={colorDeckId ? (decks[colorDeckId]?.name ?? "deck") : "deck"}
        initialColor={colorDeckId ? decks[colorDeckId]?.color : undefined}
        onSubmit={(next) => {
          if (colorDeckId) updateDeckColor(colorDeckId, next);
        }}
      />
    </>
  );
}

interface SortableDeckProps {
  deck: Deck;
  columns: Record<string, Column>;
  isActive: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onActivate: () => void;
  onRenameDeck: () => void;
  onRenameColumn: (columnId: string) => void;
  onColorDeck: () => void;
  onHistoryDeck: () => void;
  onDeleteDeck: () => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: () => void;
}

function SortableDeck({
  deck,
  columns,
  isActive,
  isOpen,
  onOpenChange,
  onActivate,
  onRenameDeck,
  onRenameColumn,
  onColorDeck,
  onHistoryDeck,
  onDeleteDeck,
  onDeleteColumn,
  onAddColumn,
}: SortableDeckProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deck.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // While dragging, lift slightly so the destination slot is visually obvious
    // and the floating row reads as the operator's grab target. Matches the
    // column-card DnD lift in deck-board.
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    // Wrap in a plain div as the DnD ref host so we never depend on
    // SidebarGroup's ref-forwarding contract (which would silently no-op
    // on React versions that don't forward refs through function components).
    // The div is layout-transparent — relative-positioned so the absolute
    // drag handle + "More" button inside SidebarGroup keep their offsets.
    <div ref={setNodeRef} style={style} className="relative">
      <Collapsible
        open={isOpen}
        onOpenChange={onOpenChange}
        className="group/collapsible"
      >
        <SidebarGroup className="py-1">
          {/*
            Drag handle. Visible only on group hover, same pattern as the
            deck "More" button next to it — keeps the sidebar visually quiet
            at rest while putting a clear grab target one mouse-move away.
            The 4px activation distance on the sensor means a stray click on
            the handle does NOT trigger a sort; only a real drag intent does.
          */}
          <button
            type="button"
            aria-label={`Drag ${deck.name} to reorder`}
            {...attributes}
            {...listeners}
            className="absolute left-1.5 top-2.5 inline-flex size-5 cursor-grab items-center justify-center rounded text-sidebar-foreground/40 opacity-0 transition-opacity hover:bg-sidebar-accent/70 hover:text-sidebar-foreground group-hover/collapsible:opacity-100 active:cursor-grabbing data-[popup-open]:opacity-100"
          >
            <GripVertical className="size-3.5" />
          </button>

        <SidebarGroupLabel
          className={cn(
            // Left padding `pl-7` (28px) reserves space for the drag handle
            // mirror-image of the existing `pr-9` reservation for the deck
            // "More" button on the right. The handle stays hidden until group
            // hover, but the reservation is constant so deck names never reflow
            // on mouse-enter.
            "gap-1 pr-9 pl-7 text-[11px] font-medium uppercase tracking-wide hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
            isActive && "text-sidebar-foreground",
          )}
          render={<CollapsibleTrigger />}
        >
          {/*
            Deck identity dot. When the operator has tagged the deck
            with a color, the dot renders in that color regardless of
            the active-deck state (the tag is the operator's intent and
            shouldn't get swapped out for the brand color just because
            this is the currently active deck). Inactive untagged decks
            fade the dot to keep the active deck distinguishable; the
            active-untagged deck uses the brand color.
          */}
          <span
            className={cn(
              "inline-block size-1.5 rounded-full",
              !deck.color
                && (isActive ? "bg-[color:var(--brand)]" : "bg-sidebar-foreground/30"),
            )}
            style={
              deck.color
                ? {
                    backgroundColor: deck.color,
                    opacity: isActive ? 1 : 0.65,
                  }
                : undefined
            }
          />
          <span className="truncate normal-case tracking-normal">
            {deck.name}
          </span>
          <span className="ml-1 text-[10px] font-normal text-sidebar-foreground/50 tabular-nums">
            {deck.columnIds.length}
          </span>
          <ChevronDown className="ml-auto size-3.5 transition-[transform,opacity] group-data-[state=open]/collapsible:rotate-180 group-hover/collapsible:opacity-0" />
        </SidebarGroupLabel>

        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {deck.columnIds.map((cid) => {
                const col = columns[cid];
                if (!col) return null;
                const type = getColumnType(col.typeId);
                const Icon = type?.icon;
                const accent = type?.accent ?? "#999";

                return (
                  <SidebarMenuItem key={cid} className="group/item">
                    <SidebarMenuButton
                      onClick={() => {
                        if (!isActive) onActivate();
                        requestAnimationFrame(() => focusColumn(cid));
                      }}
                      className="gap-2"
                    >
                      <span
                        className="flex size-5 shrink-0 items-center justify-center rounded-[4px]"
                        style={{
                          backgroundColor: `${accent}33`,
                          color: accent,
                        }}
                      >
                        {Icon ? (
                          <Icon className="size-3" strokeWidth={2.5} />
                        ) : null}
                      </span>
                      <span className="truncate">{col.title}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <SidebarMenuAction
                        aria-label="Column options"
                        render={<DropdownMenuTrigger />}
                      >
                        <MoreHorizontal className="size-3.5" />
                      </SidebarMenuAction>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem
                          onClick={() => onRenameColumn(cid)}
                        >
                          <Pencil className="mr-2 size-4" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDeleteColumn(cid)}
                        >
                          <Trash2 className="mr-2 size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              })}

              <SidebarMenuItem>
                <SidebarMenuButton
                  className="gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  onClick={onAddColumn}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-dashed border-sidebar-foreground/30">
                    <Plus className="size-3" />
                  </span>
                  <span>Add column</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${deck.name} options`}
            className="absolute right-1.5 top-2.5 inline-flex size-5 items-center justify-center rounded text-sidebar-foreground/50 opacity-0 transition-opacity hover:bg-sidebar-accent/70 hover:text-sidebar-foreground group-hover/collapsible:opacity-100 data-[popup-open]:opacity-100"
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            className="w-40"
          >
            <DropdownMenuItem onClick={onRenameDeck}>
              <Pencil className="mr-2 size-4" />
              <span className="whitespace-nowrap">Rename deck</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onColorDeck}>
              <Palette className="mr-2 size-4" />
              <span className="whitespace-nowrap">
                {deck.color ? "Change color" : "Set color"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onHistoryDeck}>
              <History className="mr-2 size-4" />
              <span className="whitespace-nowrap">Version history</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={onDeleteDeck}
            >
              <Trash2 className="mr-2 size-4" />
              <span className="whitespace-nowrap">Delete deck</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarGroup>
    </Collapsible>
    </div>
  );
}
