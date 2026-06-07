"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import type { AnyColumnUI, Column, Deck, FeedItem } from "@/lib/columns/types";
import { MAX_ITEMS_PER_COLUMN } from "@/lib/columns/constants";
import { callColumnApi } from "@/lib/columns/api-client";
import {
  createColumn as serverCreateColumn,
  createDeck as serverCreateDeck,
  deleteColumn as serverDeleteColumn,
  deleteDeck as serverDeleteDeck,
  duplicateColumn as serverDuplicateColumn,
  exportDeck as serverExportDeck,
  importDeck as serverImportDeck,
  persistFetchedItems as serverPersistItems,
  renameColumn as serverRenameColumn,
  renameDeck as serverRenameDeck,
  updateDeckColor as serverUpdateDeckColor,
  reorderColumnsInDeck as serverReorderColumns,
  reorderDecks as serverReorderDecks,
  updateColumnAlertKeywords as serverUpdateAlertKeywords,
  updateColumnConfig as serverUpdateConfig,
  updateColumnWebhookUrl as serverUpdateWebhookUrl,
  updateColumnRefreshInterval as serverUpdateRefreshInterval,
  updateColumnFilters as serverUpdateFilters,
  updateColumnTabGroup as serverUpdateTabGroup,
  updateColumnPinned as serverUpdatePinned,
  updateColumnColor as serverUpdateColor,
  normalizeColumnColor,
  loadDeckSnapshots as serverLoadDeckSnapshots,
  restoreDeckSnapshot as serverRestoreDeckSnapshot,
  isAllowedRefreshInterval,
  TAB_GROUP_MAX,
  type DeckSnapshotMeta,
  type ImportedDeckResult,
  type Snapshot,
} from "@/app/actions";

// Sentinel for the implicit "All" tab — used when a deck has tab groups
// configured but the operator wants to see every column at once. Exported so
// the deck-board can compare without re-deriving the string in both files.
export const TAB_GROUP_ALL = "__all__";

interface DeckState {
  hydrated: boolean;
  decks: Record<string, Deck>;
  deckOrder: string[];
  activeDeckId: string | null;
  columns: Record<string, Column>;
  autoFetchingIds: Set<string>;
  /**
   * Selected tab per deck. NOT persisted (view state only) — clears on reload,
   * so the deck always opens to "All" on a fresh visit. Keyed on deck id so
   * switching decks restores the last tab the operator picked in this session.
   */
  selectedTabByDeck: Record<string, string>;
  /**
   * Per-column collapsed view state. NOT persisted — same as autoFetchingIds
   * and selectedTabByDeck, this is purely an in-session UI shape and clears on
   * reload so every deck opens with all columns at full width. Membership in
   * the set means the column renders as a 48px vertical strip; absence means
   * the standard 360px column.
   */
  collapsedColumnIds: Set<string>;
  /**
   * Per-column quick-search query. NOT persisted — view state only, clears on
   * reload. Distinct from `filterKeywords` / `excludeKeywords` (those are saved
   * column config that survive reload and travel with the deck on export); this
   * is the ephemeral "type to find" input rendered inline below the column
   * header. Absent or empty string = search inactive. Substring match runs on
   * top of include/exclude — search narrows what's already visible, never
   * widens past what the persisted filters allow.
   */
  searchByColumn: Record<string, string>;

  hydrate: (snapshot: Snapshot) => void;
  setSelectedTab: (deckId: string, tab: string) => void;
  toggleColumnCollapsed: (columnId: string) => void;
  setColumnSearch: (columnId: string, query: string) => void;

  addDeck: (name: string) => string;
  renameDeck: (deckId: string, name: string) => void;
  updateDeckColor: (deckId: string, color: string) => void;
  deleteDeck: (deckId: string) => void;
  reorderDecks: (order: string[]) => void;
  setActiveDeck: (deckId: string) => void;

  addColumn: (
    deckId: string,
    typeId: string,
    title: string,
    config: Record<string, unknown>,
  ) => { id: string; ready: Promise<void> };
  duplicateColumn: (columnId: string) => { id: string; ready: Promise<void> } | null;
  updateColumnConfig: (columnId: string, config: Record<string, unknown>) => void;
  updateAlertKeywords: (columnId: string, alertKeywords: string) => void;
  updateWebhookUrl: (columnId: string, webhookUrl: string) => void;
  updateRefreshInterval: (
    columnId: string,
    refreshIntervalSeconds: number | null,
  ) => void;
  updateFilters: (
    columnId: string,
    filterKeywords: string,
    excludeKeywords: string,
  ) => void;
  updateTabGroup: (columnId: string, tabGroup: string) => void;
  updatePinned: (columnId: string, pinned: boolean) => void;
  updateColor: (columnId: string, color: string) => void;
  renameColumn: (columnId: string, title: string) => void;
  removeColumn: (columnId: string) => void;
  reorderColumnsInDeck: (deckId: string, order: string[]) => void;

  applyFetchedItems: (columnId: string, items: FeedItem[]) => Promise<number>;
  autoFetchColumn: (
    columnId: string,
    type: AnyColumnUI,
    ready?: Promise<void>,
  ) => Promise<void>;

  exportDeck: (deckId: string) => Promise<string>;
  importDeck: (json: string) => Promise<ImportedDeckResult>;
  downloadColumnItems: (columnId: string) => number;
  loadDeckSnapshots: (deckId: string) => Promise<DeckSnapshotMeta[]>;
  restoreDeckSnapshot: (snapshotId: number) => Promise<ImportedDeckResult>;
}

// Build the store patch that lands a freshly imported/restored deck (a new deck
// plus its columns) and activates it. Shared by importDeck and
// restoreDeckSnapshot since both create a new deck from a DeckExport payload.
function importedDeckPatch(
  s: DeckState,
  result: ImportedDeckResult,
): Partial<DeckState> {
  const cols = { ...s.columns };
  for (const c of result.columns) {
    cols[c.id] = {
      id: c.id,
      typeId: c.typeId,
      title: c.title,
      config: c.config,
      alertKeywords: c.alertKeywords,
      notifyWebhookUrl: c.notifyWebhookUrl,
      refreshIntervalSeconds: c.refreshIntervalSeconds,
      filterKeywords: c.filterKeywords,
      excludeKeywords: c.excludeKeywords,
      tabGroup: c.tabGroup,
      pinned: c.pinned,
      color: c.color,
      items: [],
    };
  }
  return {
    decks: {
      ...s.decks,
      [result.deckId]: {
        id: result.deckId,
        name: result.deckName,
        columnIds: result.columns.map((c) => c.id),
        color: result.deckColor,
      },
    },
    deckOrder: [...s.deckOrder, result.deckId],
    activeDeckId: result.deckId,
    columns: cols,
  };
}

function fireAndLog<T>(label: string, p: Promise<T>) {
  p.catch((err) => {
    console.error(`[minitor] server action "${label}" failed:`, err);
  });
}

export const useDeckStore = create<DeckState>()((set, get) => ({
  hydrated: false,
  decks: {},
  deckOrder: [],
  activeDeckId: null,
  columns: {},
  autoFetchingIds: new Set<string>(),
  selectedTabByDeck: {},
  collapsedColumnIds: new Set<string>(),
  searchByColumn: {},

  hydrate: (snapshot) =>
    set((s) => ({
      decks: snapshot.decks,
      deckOrder: snapshot.deckOrder,
      columns: snapshot.columns,
      activeDeckId:
        s.activeDeckId && snapshot.deckOrder.includes(s.activeDeckId)
          ? s.activeDeckId
          : (snapshot.deckOrder[0] ?? null),
      hydrated: true,
    })),

  setSelectedTab: (deckId, tab) =>
    set((s) => ({
      selectedTabByDeck: { ...s.selectedTabByDeck, [deckId]: tab },
    })),

  toggleColumnCollapsed: (columnId) =>
    set((s) => {
      const next = new Set(s.collapsedColumnIds);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return { collapsedColumnIds: next };
    }),

  setColumnSearch: (columnId, query) =>
    set((s) => {
      // Trim and cap so a runaway paste can't slow the substring scan or blow
      // up the rendered input. 256 chars is far more than any realistic
      // operator query — anything longer is almost certainly accidental.
      const trimmed = query.slice(0, 256);
      const next = { ...s.searchByColumn };
      if (trimmed.length === 0) {
        delete next[columnId];
      } else {
        next[columnId] = trimmed;
      }
      return { searchByColumn: next };
    }),

  addDeck: (name) => {
    const id = nanoid();
    set((s) => ({
      decks: { ...s.decks, [id]: { id, name, columnIds: [] } },
      deckOrder: [...s.deckOrder, id],
      activeDeckId: s.activeDeckId ?? id,
    }));
    fireAndLog("createDeck", serverCreateDeck(id, name));
    return id;
  },

  renameDeck: (deckId, name) => {
    set((s) => {
      const deck = s.decks[deckId];
      if (!deck) return s;
      return { decks: { ...s.decks, [deckId]: { ...deck, name } } };
    });
    fireAndLog("renameDeck", serverRenameDeck(deckId, name));
  },

  updateDeckColor: (deckId, color) => {
    // Mirror the server normalizer client-side so the optimistic write
    // and the persisted write agree: empty/invalid → undefined (cleared);
    // valid hex → canonical lowercased `#rrggbb`. Reuses the same
    // `normalizeColumnColor` import the column color action uses so the
    // two surfaces can never drift on case-folding or shorthand acceptance.
    const normalized = normalizeColumnColor(color) ?? undefined;
    set((s) => {
      const deck = s.decks[deckId];
      if (!deck) return s;
      return {
        decks: { ...s.decks, [deckId]: { ...deck, color: normalized } },
      };
    });
    fireAndLog("updateDeckColor", serverUpdateDeckColor(deckId, color));
  },

  deleteDeck: (deckId) => {
    set((s) => {
      const deck = s.decks[deckId];
      if (!deck) return s;
      const decks = { ...s.decks };
      delete decks[deckId];
      const cols = { ...s.columns };
      for (const cid of deck.columnIds) delete cols[cid];
      const deckOrder = s.deckOrder.filter((id) => id !== deckId);
      let activeDeckId = s.activeDeckId;
      if (activeDeckId === deckId) activeDeckId = deckOrder[0] ?? null;
      const collapsed = new Set(s.collapsedColumnIds);
      for (const cid of deck.columnIds) collapsed.delete(cid);
      const searchByColumn = { ...s.searchByColumn };
      for (const cid of deck.columnIds) delete searchByColumn[cid];
      return {
        decks,
        columns: cols,
        deckOrder,
        activeDeckId,
        collapsedColumnIds: collapsed,
        searchByColumn,
      };
    });
    fireAndLog("deleteDeck", serverDeleteDeck(deckId));
  },

  reorderDecks: (order) => {
    set({ deckOrder: order });
    fireAndLog("reorderDecks", serverReorderDecks(order));
  },

  setActiveDeck: (deckId) => set({ activeDeckId: deckId }),

  addColumn: (deckId, typeId, title, config) => {
    const id = nanoid();
    set((s) => {
      const deck = s.decks[deckId];
      if (!deck) return s;
      return {
        columns: {
          ...s.columns,
          [id]: { id, typeId, title, config, items: [] },
        },
        decks: {
          ...s.decks,
          [deckId]: { ...deck, columnIds: [...deck.columnIds, id] },
        },
      };
    });
    const ready = serverCreateColumn(id, deckId, typeId, title, config);
    fireAndLog("createColumn", ready);
    return { id, ready: ready.then(() => undefined) };
  },

  duplicateColumn: (columnId) => {
    const state = get();
    const source = state.columns[columnId];
    if (!source) return null;
    // Locate the deck the source lives in so the optimistic insert lands in
    // the right deck's columnIds. `columns[]` is a flat map across decks, so
    // we read it off the decks index rather than carrying it on the column.
    let deckId: string | null = null;
    for (const [did, deck] of Object.entries(state.decks)) {
      if (deck.columnIds.includes(columnId)) {
        deckId = did;
        break;
      }
    }
    if (!deckId) return null;

    const id = nanoid();
    // The title strategy is "<source> (copy)" — same convention as duplicated
    // files in finders and "Untitled copy" in most cloud doc apps. Capped to
    // 256 chars to match the server-side `title.slice(0, 256)`.
    const title = `${source.title} (copy)`.slice(0, 256);

    set((s) => {
      const deck = s.decks[deckId!];
      if (!deck) return s;
      const insertAt = deck.columnIds.indexOf(columnId);
      const nextColumnIds =
        insertAt < 0
          ? [...deck.columnIds, id]
          : [
              ...deck.columnIds.slice(0, insertAt + 1),
              id,
              ...deck.columnIds.slice(insertAt + 1),
            ];
      return {
        columns: {
          ...s.columns,
          [id]: {
            id,
            typeId: source.typeId,
            title,
            // Shallow-copy so the clone never shares the source's config object
            // reference (a future in-place config edit must not mutate both).
            config: { ...source.config },
            alertKeywords: source.alertKeywords,
            notifyWebhookUrl: source.notifyWebhookUrl,
            refreshIntervalSeconds: source.refreshIntervalSeconds,
            filterKeywords: source.filterKeywords,
            excludeKeywords: source.excludeKeywords,
            tabGroup: source.tabGroup,
            // Pinning is the operator's explicit "primary column" decision —
            // duplicates land unpinned regardless of source state, mirroring
            // PR #59's "DnD across pin/unpin no-op" rule.
            pinned: undefined,
            // Color IS inherited — unlike pinned, color is a visual labeling
            // decision about what kind of column this is, not a routing
            // decision about where the column sits in the deck. A duplicated
            // DeFi-orange column is still a DeFi column.
            color: source.color,
            items: [],
          },
        },
        decks: {
          ...s.decks,
          [deckId!]: { ...deck, columnIds: nextColumnIds },
        },
      };
    });

    const ready = serverDuplicateColumn(columnId, id, title);
    fireAndLog("duplicateColumn", ready);
    return { id, ready: ready.then(() => undefined) };
  },

  updateColumnConfig: (columnId, config) => {
    set((s) => {
      const col = s.columns[columnId];
      if (!col) return s;
      return { columns: { ...s.columns, [columnId]: { ...col, config } } };
    });
    fireAndLog("updateColumnConfig", serverUpdateConfig(columnId, config));
  },

  updateAlertKeywords: (columnId, alertKeywords) => {
    const next = alertKeywords.slice(0, 512);
    set((s) => {
      const col = s.columns[columnId];
      if (!col) return s;
      return {
        columns: {
          ...s.columns,
          [columnId]: {
            ...col,
            alertKeywords: next.length === 0 ? undefined : next,
          },
        },
      };
    });
    fireAndLog(
      "updateColumnAlertKeywords",
      serverUpdateAlertKeywords(columnId, next),
    );
  },

  updateWebhookUrl: (columnId, webhookUrl) => {
    const next = webhookUrl.trim();
    set((s) => {
      const col = s.columns[columnId];
      if (!col) return s;
      return {
        columns: {
          ...s.columns,
          [columnId]: {
            ...col,
            notifyWebhookUrl: next.length === 0 ? undefined : next,
          },
        },
      };
    });
    fireAndLog("updateColumnWebhookUrl", serverUpdateWebhookUrl(columnId, next));
  },

  updateRefreshInterval: (columnId, refreshIntervalSeconds) => {
    // Mirror the server-side allowlist locally so the optimistic state can't
    // drift from what was actually persisted. Anything outside the allowlist
    // collapses to manual-only (undefined / null on the wire).
    const next = isAllowedRefreshInterval(refreshIntervalSeconds)
      ? refreshIntervalSeconds
      : null;
    set((s) => {
      const col = s.columns[columnId];
      if (!col) return s;
      return {
        columns: {
          ...s.columns,
          [columnId]: {
            ...col,
            refreshIntervalSeconds: next ?? undefined,
          },
        },
      };
    });
    fireAndLog(
      "updateColumnRefreshInterval",
      serverUpdateRefreshInterval(columnId, next),
    );
  },

  updateFilters: (columnId, filterKeywords, excludeKeywords) => {
    const nextInclude = filterKeywords.slice(0, 512);
    const nextExclude = excludeKeywords.slice(0, 512);
    set((s) => {
      const col = s.columns[columnId];
      if (!col) return s;
      return {
        columns: {
          ...s.columns,
          [columnId]: {
            ...col,
            filterKeywords: nextInclude.length === 0 ? undefined : nextInclude,
            excludeKeywords: nextExclude.length === 0 ? undefined : nextExclude,
          },
        },
      };
    });
    fireAndLog(
      "updateColumnFilters",
      serverUpdateFilters(columnId, nextInclude, nextExclude),
    );
  },

  updateTabGroup: (columnId, tabGroup) => {
    // Mirror the server-side normalization exactly so the optimistic state
    // can't drift: same whitespace collapse, trim, and length cap. Anything
    // empty after normalization clears the group (undefined / NULL on the wire).
    const next = tabGroup.replace(/\s+/g, " ").trim().slice(0, TAB_GROUP_MAX);
    set((s) => {
      const col = s.columns[columnId];
      if (!col) return s;
      return {
        columns: {
          ...s.columns,
          [columnId]: {
            ...col,
            tabGroup: next.length === 0 ? undefined : next,
          },
        },
      };
    });
    fireAndLog("updateColumnTabGroup", serverUpdateTabGroup(columnId, next));
  },

  updatePinned: (columnId, pinned) => {
    // Plain boolean — coerce to true/false so the optimistic state can't carry
    // a truthy non-boolean and silently differ from the server cast.
    const next = pinned === true;
    set((s) => {
      const col = s.columns[columnId];
      if (!col) return s;
      return {
        columns: {
          ...s.columns,
          [columnId]: {
            ...col,
            pinned: next ? true : undefined,
          },
        },
      };
    });
    fireAndLog("updateColumnPinned", serverUpdatePinned(columnId, next));
  },

  updateColor: (columnId, color) => {
    // Mirror the server-side normalizer exactly so the optimistic state can't
    // diverge from what the DB will actually persist. An empty string or any
    // non-hex input clears the color (undefined / NULL on the wire).
    const next = normalizeColumnColor(color);
    set((s) => {
      const col = s.columns[columnId];
      if (!col) return s;
      return {
        columns: {
          ...s.columns,
          [columnId]: {
            ...col,
            color: next ?? undefined,
          },
        },
      };
    });
    fireAndLog("updateColumnColor", serverUpdateColor(columnId, color));
  },

  renameColumn: (columnId, title) => {
    set((s) => {
      const col = s.columns[columnId];
      if (!col) return s;
      return { columns: { ...s.columns, [columnId]: { ...col, title } } };
    });
    fireAndLog("renameColumn", serverRenameColumn(columnId, title));
  },

  removeColumn: (columnId) => {
    set((s) => {
      if (!s.columns[columnId]) return s;
      const cols = { ...s.columns };
      delete cols[columnId];
      const decks = { ...s.decks };
      for (const [did, d] of Object.entries(s.decks)) {
        if (d.columnIds.includes(columnId)) {
          decks[did] = {
            ...d,
            columnIds: d.columnIds.filter((id) => id !== columnId),
          };
        }
      }
      const collapsed = new Set(s.collapsedColumnIds);
      collapsed.delete(columnId);
      const searchByColumn = { ...s.searchByColumn };
      delete searchByColumn[columnId];
      return { columns: cols, decks, collapsedColumnIds: collapsed, searchByColumn };
    });
    fireAndLog("deleteColumn", serverDeleteColumn(columnId));
  },

  reorderColumnsInDeck: (deckId, order) => {
    set((s) => {
      const deck = s.decks[deckId];
      if (!deck) return s;
      return { decks: { ...s.decks, [deckId]: { ...deck, columnIds: order } } };
    });
    fireAndLog("reorderColumnsInDeck", serverReorderColumns(deckId, order));
  },

  autoFetchColumn: async (columnId, type, ready) => {
    const col = get().columns[columnId];
    if (!col) return;
    set((s) => {
      const next = new Set(s.autoFetchingIds);
      next.add(columnId);
      return { autoFetchingIds: next };
    });
    try {
      // Wait for the server-side INSERT into columns to land before persisting
      // feed_items, otherwise the FK insert in persistFetchedItems races and
      // throws "violates foreign key constraint".
      if (ready) await ready.catch(() => undefined);
      const { items } = await callColumnApi(type.id, col.config);
      const count = await get().applyFetchedItems(columnId, items);
      toast.success(
        count > 0 ? `${count} new item${count === 1 ? "" : "s"}` : "No new items",
        { description: col.title },
      );
    } catch (err) {
      toast.error("Fetch failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      set((s) => {
        const next = new Set(s.autoFetchingIds);
        next.delete(columnId);
        return { autoFetchingIds: next };
      });
    }
  },

  exportDeck: (deckId) => serverExportDeck(deckId),

  // Client-only — never round-trips the server. Pulls the column's cached
  // items array straight out of the store, serializes to pretty-printed JSON,
  // and drops a download via a synthetic <a download>. The filename embeds the
  // column title (slugified) + UTC date so multiple exports of the same column
  // across days don't collide in the user's Downloads folder.
  //
  // Returns the number of items written so the caller (column-card.tsx) can
  // surface it in a toast — 0 means we deliberately did not trigger a download
  // (no items cached yet; UI should disable the menu entry instead of letting
  // the click through).
  downloadColumnItems: (columnId) => {
    if (typeof window === "undefined") return 0;
    const col = get().columns[columnId];
    if (!col || col.items.length === 0) return 0;

    const payload = {
      schema: "minitor.column-export.v1",
      exportedAt: new Date().toISOString(),
      column: {
        id: col.id,
        typeId: col.typeId,
        title: col.title,
      },
      itemCount: col.items.length,
      items: col.items,
    };

    const slug =
      col.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64) || "column";
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${slug}-${date}.json`;

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      // Revoke immediately — the click has already started the save dialog
      // by this point, and holding the URL alive leaks the blob for the
      // lifetime of the tab.
      URL.revokeObjectURL(url);
    }
    return col.items.length;
  },

  importDeck: async (json) => {
    const result = await serverImportDeck(json);
    set((s) => importedDeckPatch(s, result));
    return result;
  },

  loadDeckSnapshots: (deckId) => serverLoadDeckSnapshots(deckId),

  restoreDeckSnapshot: async (snapshotId) => {
    const result = await serverRestoreDeckSnapshot(snapshotId);
    set((s) => importedDeckPatch(s, result));
    return result;
  },

  applyFetchedItems: async (columnId, items) => {
    const before = get().columns[columnId];
    if (!before) return 0;
    const { newCount, lastFetchedAt } = await serverPersistItems(columnId, items);
    set((s) => {
      const col = s.columns[columnId];
      if (!col) return s;
      const seen = new Set(col.items.map((i) => i.id));
      const fresh = items.filter((i) => !seen.has(i.id));
      const combined = [...fresh, ...col.items]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, MAX_ITEMS_PER_COLUMN);
      return {
        columns: {
          ...s.columns,
          [columnId]: { ...col, items: combined, lastFetchedAt },
        },
      };
    });
    return newCount;
  },
}));
