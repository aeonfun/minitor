"use client";

import { useState } from "react";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { NavDecks } from "@/components/sidebar-01/nav-decks";
import { NavFooter } from "@/components/sidebar-01/nav-footer";
import { NavHeader } from "@/components/sidebar-01/nav-header";
import { NavStats } from "@/components/sidebar-01/nav-stats";
import { RenameDialog } from "@/components/dialogs/rename-dialog";
import { ImportDeckDialog } from "@/components/dialogs/import-deck-dialog";
import { TemplatesDialog } from "@/components/dialogs/templates-dialog";
import { AddColumnDialog } from "@/components/column/add-column-dialog";
import { useDeckStore } from "@/lib/store/use-deck-store";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const addDeck = useDeckStore((s) => s.addDeck);
  const setActiveDeck = useDeckStore((s) => s.setActiveDeck);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);

  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [addColOpen, setAddColOpen] = useState(false);
  const [importDeckOpen, setImportDeckOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  return (
    <>
      <Sidebar {...props}>
        <NavHeader
          onAddDeck={() => setNewDeckOpen(true)}
          onAddColumn={() => setAddColOpen(true)}
          onImportDeck={() => setImportDeckOpen(true)}
          onBrowseTemplates={() => setTemplatesOpen(true)}
        />
        <SidebarContent>
          <NavDecks />
        </SidebarContent>
        <NavStats />
        <NavFooter />
      </Sidebar>

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
        <AddColumnDialog
          open={addColOpen}
          onOpenChange={setAddColOpen}
          deckId={activeDeckId}
        />
      )}
      <ImportDeckDialog open={importDeckOpen} onOpenChange={setImportDeckOpen} />
      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
    </>
  );
}
