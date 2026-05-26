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
  exportDeck as serverExportDeck,
  importDeck as serverImportDeck,
  persistFetchedItems as serverPersistItems,
  renameColumn as serverRenameColumn,
  renameDeck as serverRenameDeck,
  reorderColumnsInDeck as serverReorderColumns,
  reorderDecks as serverReorderDecks,
  updateColumnAlertKeywords as serverUpdateAlertKeywords,
  updateColumnConfig as serverUpdateConfig,
  updateColumnWebhookUrl as serverUpdateWebhookUrl,
  updateColumnRefreshInterval as serverUpdateRefreshInterval,
  updateColumnFilters as serverUpdateFilters,
  isAllowedRefreshInterval,
  type ImportedDeckResult,
  type Snapshot,
} from "@/app/actions";

interface DeckState {
  hydrated: boolean;
  decks: Record<string, Deck>;
  deckOrder: string[];
  activeDeckId: string | null;
  columns: Record<string, Column>;
  autoFetchingIds: Set<string>;

  hydrate: (snapshot: Snapshot) => void;

  addDeck: (name: string) => string;
  renameDeck: (deckId: string, name: string) => void;
  deleteDeck: (deckId: string) => void;
  reorderDecks: (order: string[]) => void;
  setActiveDeck: (deckId: string) => void;

  addColumn: (
    deckId: string,
    typeId: string,
    title: string,
    config: Record<string, unknown>,
  ) => { id: string; ready: Promise<void> };
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
      return { decks, columns: cols, deckOrder, activeDeckId };
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
      return { columns: cols, decks };
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

  importDeck: async (json) => {
    const result = await serverImportDeck(json);
    set((s) => {
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
          },
        },
        deckOrder: [...s.deckOrder, result.deckId],
        activeDeckId: result.deckId,
        columns: cols,
      };
    });
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
