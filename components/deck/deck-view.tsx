"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useDeckStore } from "@/lib/store/use-deck-store";
import { DeckBoard } from "@/components/deck/deck-board";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar-01/app-sidebar";
import { Onboarding } from "@/components/onboarding/welcome";
import { loadSnapshot } from "@/app/actions";
import {
  DECK_SHARE_HASH_KEY,
  decodeDeckShareHash,
  readDeckShareFragment,
} from "@/lib/deck-share";

export function DeckView() {
  const hydrated = useDeckStore((s) => s.hydrated);
  const deckOrder = useDeckStore((s) => s.deckOrder);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const activeDeck = useDeckStore((s) =>
    s.activeDeckId ? s.decks[s.activeDeckId] : null,
  );
  const setActiveDeck = useDeckStore((s) => s.setActiveDeck);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        useDeckStore.getState().hydrate(snapshot);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setLoadError(msg);
        toast.error("Could not load data", { description: msg });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-import a deck from a #deck=... URL fragment after hydration. Runs once
  // per page load: we clear the hash on success so refreshes don't re-import,
  // and we clear it on failure so a malformed payload can't trap the user.
  // Activation of the imported deck happens inside `importDeck` itself.
  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined") return;
    const fragment = readDeckShareFragment(window.location.hash);
    if (!fragment) return;

    const cleanHash = () => {
      const stripped = window.location.hash
        .replace(/^#/, "")
        .split("&")
        .filter((p) => !p.startsWith(`${DECK_SHARE_HASH_KEY}=`))
        .join("&");
      const next = stripped ? `${window.location.pathname}${window.location.search}#${stripped}` : `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", next);
    };

    const json = decodeDeckShareHash(fragment);
    if (!json) {
      toast.error("Shared deck link is invalid", {
        description: "The URL fragment could not be decoded.",
      });
      cleanHash();
      return;
    }

    useDeckStore
      .getState()
      .importDeck(json)
      .then((result) => {
        toast.success("Shared deck imported", { description: result.deckName });
        cleanHash();
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Import failed";
        toast.error("Shared deck import failed", { description: msg });
        cleanHash();
      });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (deckOrder.length === 0) return;
    if (!activeDeckId || !deckOrder.includes(activeDeckId)) {
      setActiveDeck(deckOrder[0]);
    }
  }, [hydrated, deckOrder, activeDeckId, setActiveDeck]);

  if (!hydrated) {
    return (
      <div className="flex h-dvh">
        <Skeleton className="hidden h-full w-64 md:block" />
        <div className="flex flex-1 gap-2 overflow-hidden p-2 sm:gap-3 sm:p-3">
          <Skeleton className="h-full w-[min(360px,calc(100vw-1rem))] shrink-0 rounded-lg sm:w-[360px]" />
          <Skeleton className="hidden h-full w-[360px] shrink-0 rounded-lg md:block" />
          <Skeleton className="hidden h-full w-[360px] shrink-0 rounded-lg md:block" />
        </div>
        {loadError && (
          <div className="absolute inset-x-0 bottom-0 px-4 py-3 text-xs text-destructive">
            Failed to load: {loadError}
          </div>
        )}
      </div>
    );
  }

  if (deckOrder.length === 0) {
    return <Onboarding />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-2 backdrop-blur-md sm:px-3">
          <SidebarTrigger className="size-8 shrink-0" />
          <div className="h-5 w-px shrink-0 bg-border" />
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3.5">
            <span
              className="pb-1 font-serif text-[18px] leading-[1.2] italic text-foreground sm:text-[20px]"
              style={{ letterSpacing: "-0.01em" }}
            >
              {activeDeck?.name ?? "Minitor"}
            </span>
            {activeDeck && (
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {activeDeck.columnIds.length} column
                {activeDeck.columnIds.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </header>

        {activeDeckId ? (
          <DeckBoard deckId={activeDeckId} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            No decks yet. Use the sidebar to create one.
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
