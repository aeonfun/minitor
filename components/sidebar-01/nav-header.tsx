"use client";

import { Download, LayoutTemplate, Plus, Search, Share2, Upload } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { SidebarHeader } from "@/components/ui/sidebar";
import { getColumnType } from "@/lib/columns/registry";
import { useDeckStore } from "@/lib/store/use-deck-store";
import { focusColumn } from "@/components/sidebar-01/nav-decks";
import { buildDeckShareUrl } from "@/lib/deck-share";

interface Props {
  onAddDeck: () => void;
  onAddColumn: () => void;
  onImportDeck: () => void;
  onBrowseTemplates: () => void;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function NavHeader({
  onAddDeck,
  onAddColumn,
  onImportDeck,
  onBrowseTemplates,
}: Props) {
  const [open, setOpen] = useState(false);
  const decks = useDeckStore((s) => s.decks);
  const deckOrder = useDeckStore((s) => s.deckOrder);
  const columns = useDeckStore((s) => s.columns);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const setActiveDeck = useDeckStore((s) => s.setActiveDeck);
  const exportDeck = useDeckStore((s) => s.exportDeck);

  const activeDeck = activeDeckId ? decks[activeDeckId] : null;

  async function handleExportActiveDeck() {
    if (!activeDeck) return;
    try {
      const json = await exportDeck(activeDeck.id);
      const copied = await copyToClipboard(json);
      if (copied) {
        toast.success("Deck JSON copied", { description: activeDeck.name });
      } else {
        toast.error("Could not copy to clipboard", {
          description:
            "Your browser blocked clipboard access — paste the JSON manually from the console.",
        });
        console.log(json);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      toast.error("Export failed", { description: msg });
    }
  }

  async function handleShareActiveDeck() {
    if (!activeDeck) return;
    if (typeof window === "undefined") return;
    try {
      const json = await exportDeck(activeDeck.id);
      const url = buildDeckShareUrl(json, {
        origin: window.location.origin,
        pathname: window.location.pathname,
      });
      const copied = await copyToClipboard(url);
      if (copied) {
        toast.success("Share link copied", { description: activeDeck.name });
      } else {
        toast.error("Could not copy to clipboard", {
          description:
            "Your browser blocked clipboard access — copy the URL from the console.",
        });
        console.log(url);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Share failed";
      toast.error("Share failed", { description: msg });
    }
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <SidebarHeader className="gap-2">
        <div className="flex flex-col gap-0.5 px-2 pt-2">
          <div className="flex items-center gap-2">
            <span
              className="font-serif text-[20px] leading-none italic text-sidebar-foreground"
              style={{ letterSpacing: "-0.02em" }}
            >
              Minitor
            </span>
            <Image
              src="/logo.png"
              alt=""
              width={20}
              height={20}
              priority
              className="size-5 shrink-0"
            />
          </div>
          <div className="flex items-center gap-1 text-[11px] text-sidebar-foreground/60">
            <span>by</span>
            <a
              href="https://www.aeon.fun/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-sm transition-colors hover:text-sidebar-foreground"
            >
              <Image
                src="/aeon.jpg"
                alt="aeon"
                width={12}
                height={12}
                className="size-3 rounded-full ring-1 ring-black/10"
              />
              <span>aeon</span>
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mx-1 mt-1 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <span className="flex items-center gap-2">
            <Search className="size-3.5" />
            <span className="text-[13px]">Search</span>
          </span>
          <kbd className="inline-flex items-center rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/60">
            ⌘K
          </kbd>
        </button>
      </SidebarHeader>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a deck, column, or action…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                setOpen(false);
                onAddDeck();
              }}
            >
              <Plus className="mr-2 size-4" /> New deck
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                onAddColumn();
              }}
            >
              <Plus className="mr-2 size-4" /> Add column to current deck
            </CommandItem>
            {activeDeck ? (
              <CommandItem
                value={`export-deck-${activeDeck.name}`}
                onSelect={() => {
                  setOpen(false);
                  void handleExportActiveDeck();
                }}
              >
                <Download className="mr-2 size-4" /> Export current deck (copy
                JSON)
              </CommandItem>
            ) : null}
            {activeDeck ? (
              <CommandItem
                value={`share-deck-${activeDeck.name}`}
                onSelect={() => {
                  setOpen(false);
                  void handleShareActiveDeck();
                }}
              >
                <Share2 className="mr-2 size-4" /> Share current deck (copy
                URL)
              </CommandItem>
            ) : null}
            <CommandItem
              value="import-deck"
              onSelect={() => {
                setOpen(false);
                onImportDeck();
              }}
            >
              <Upload className="mr-2 size-4" /> Import deck from JSON
            </CommandItem>
            <CommandItem
              value="browse-templates"
              onSelect={() => {
                setOpen(false);
                onBrowseTemplates();
              }}
            >
              <LayoutTemplate className="mr-2 size-4" /> Browse starter
              templates
            </CommandItem>
          </CommandGroup>

          {deckOrder.length > 0 && (
            <>
              <CommandSeparator className="my-1" />
              <CommandGroup heading="Decks">
                {deckOrder.map((id) => {
                  const deck = decks[id];
                  if (!deck) return null;
                  return (
                    <CommandItem
                      key={id}
                      value={`deck-${deck.name}-${id}`}
                      onSelect={() => {
                        setOpen(false);
                        setActiveDeck(id);
                      }}
                    >
                      <span className="mr-2 inline-block size-1.5 rounded-full bg-[color:var(--brand)]" />
                      <span>{deck.name}</span>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        {deck.columnIds.length}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}

          {Object.keys(columns).length > 0 && (
            <>
              <CommandSeparator className="my-1" />
              <CommandGroup heading="Columns">
                {deckOrder.flatMap((deckId) => {
                  const deck = decks[deckId];
                  if (!deck) return [];
                  return deck.columnIds.map((cid) => {
                    const col = columns[cid];
                    if (!col) return null;
                    const type = getColumnType(col.typeId);
                    const Icon = type?.icon;
                    const accent = type?.accent ?? "#999";
                    return (
                      <CommandItem
                        key={cid}
                        value={`col-${col.title}-${deck.name}-${cid}`}
                        onSelect={() => {
                          setOpen(false);
                          setActiveDeck(deckId);
                          requestAnimationFrame(() => focusColumn(cid));
                        }}
                      >
                        <span
                          className="mr-2 inline-flex size-4 shrink-0 items-center justify-center rounded-sm"
                          style={{ backgroundColor: `${accent}33`, color: accent }}
                        >
                          {Icon ? <Icon className="size-2.5" strokeWidth={2.5} /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{col.title}</span>
                        <span className="ml-auto shrink-0 whitespace-nowrap pl-3 text-xs text-muted-foreground">
                          in {deck.name}
                        </span>
                      </CommandItem>
                    );
                  });
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
