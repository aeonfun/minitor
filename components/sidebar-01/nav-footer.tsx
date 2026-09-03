"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutTemplate, Plus, Settings } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarFooter, SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { RenameDialog } from "@/components/dialogs/rename-dialog";
import { useDeckStore } from "@/lib/store/use-deck-store";
import { AddColumnDialog } from "@/components/column/add-column-dialog";
import { SettingsDialog } from "@/components/settings/settings-dialog";

export function NavFooter() {
  const addDeck = useDeckStore((s) => s.addDeck);
  const setActiveDeck = useDeckStore((s) => s.setActiveDeck);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);

  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [addColOpen, setAddColOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              href="/gallery"
              className="flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground/80 outline-hidden transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LayoutTemplate className="size-4" />
              <span>Browse deck gallery</span>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-8 flex-1 items-center justify-between gap-2 rounded-md px-2 text-left text-sm text-sidebar-foreground/80 outline-hidden transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground data-[popup-open]:bg-sidebar-accent data-[popup-open]:text-sidebar-foreground">
                <span>Add new</span>
                <Plus className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-auto">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Create</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setNewDeckOpen(true)}>
                    <span>New deck</span>
                    <Plus className="ml-auto size-4" />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setAddColOpen(true)} disabled={!activeDeckId}>
                    <span>Add column</span>
                    <Plus className="ml-auto size-4" />
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              title="Settings"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Settings className="size-4" />
            </button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <RenameDialog
        open={newDeckOpen}
        onOpenChange={setNewDeckOpen}
        title="New deck"
        initialValue=""
        placeholder="Deck name"
        onSubmit={(name) => {
          const id = addDeck(name);
          setActiveDeck(id);
        }}
      />
      {activeDeckId && (
        <AddColumnDialog open={addColOpen} onOpenChange={setAddColOpen} deckId={activeDeckId} />
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
