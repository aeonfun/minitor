"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Filter,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Pin,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { RelativeTime } from "@/components/relative-time";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getColumnType } from "@/lib/columns/registry";
import { callColumnApi } from "@/lib/columns/api-client";
import { useDeckStore } from "@/lib/store/use-deck-store";
import { useMinDuration } from "@/hooks/use-min-duration";
import { BEAM_MIN_DURATION_MS } from "@/lib/columns/constants";
import {
  itemMatchesAlertKeywords,
  itemMatchesSearchQuery,
  parseAlertKeywords,
} from "@/lib/columns/keyword-match";
import type { Column } from "@/lib/columns/types";
import { ConfigureColumnDialog } from "@/components/column/configure-column-dialog";
import { RenameDialog } from "@/components/dialogs/rename-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";

export function ColumnCard({ column }: { column: Column }) {
  const type = getColumnType(column.typeId);
  const removeColumn = useDeckStore((s) => s.removeColumn);
  const applyFetchedItems = useDeckStore((s) => s.applyFetchedItems);
  const renameColumn = useDeckStore((s) => s.renameColumn);
  const downloadColumnItems = useDeckStore((s) => s.downloadColumnItems);
  const duplicateColumn = useDeckStore((s) => s.duplicateColumn);
  const hasItems = column.items.length > 0;
  const isAutoFetchingRaw = useDeckStore((s) => s.autoFetchingIds.has(column.id));
  const isCollapsed = useDeckStore((s) => s.collapsedColumnIds.has(column.id));
  const toggleColumnCollapsed = useDeckStore((s) => s.toggleColumnCollapsed);
  const searchQuery = useDeckStore((s) => s.searchByColumn[column.id] ?? "");
  const setColumnSearch = useDeckStore((s) => s.setColumnSearch);
  // Three-step width override (view-state only). Absence = "normal" (360px),
  // the historical default. Narrow drops to 240px for densest signal-per-px
  // (price columns, ticker lists); wide rises to 480px for headline feeds
  // whose text wraps badly at 360. Collapsed columns ignore this — collapse
  // owns its own 48px strip and the saved width re-applies on expand.
  const columnWidth = useDeckStore((s) => s.widthByColumn[column.id] ?? null);
  const setColumnWidth = useDeckStore((s) => s.setColumnWidth);
  const isFocused = useDeckStore((s) => s.focusedColumnId === column.id);
  const setFocusedColumn = useDeckStore((s) => s.setFocusedColumn);
  const pendingSearchOpen = useDeckStore((s) => s.pendingSearchOpen);
  const clearPendingSearchOpen = useDeckStore((s) => s.clearPendingSearchOpen);
  const isPendingRefresh = useDeckStore((s) =>
    s.pendingRefreshIds.has(column.id),
  );
  const clearPendingRefresh = useDeckStore((s) => s.clearPendingRefresh);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [isFetchingRaw, setIsFetching] = useState(false);
  const isFetching = useMinDuration(isFetchingRaw, BEAM_MIN_DURATION_MS);
  const isAutoFetching = useMinDuration(isAutoFetchingRaw, BEAM_MIN_DURATION_MS);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // undefined = unknown (initial state, never fetched OR no pagination support)
  // string = ready to load that page
  // null = exhausted
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(
    undefined,
  );
  const [configureOpen, setConfigureOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.id });

  if (!type) {
    return (
      <div className="flex w-[min(360px,calc(100vw-1rem))] shrink-0 snap-start flex-col rounded-lg border border-destructive/50 bg-card p-4 text-sm sm:w-[360px] sm:snap-none">
        <p className="font-medium">Unknown column type</p>
        <p className="mt-1 text-muted-foreground">
          Type <code>{column.typeId}</code> is not registered.
        </p>
        <Button
          variant="destructive"
          size="sm"
          className="mt-3"
          onClick={() => removeColumn(column.id)}
        >
          Remove
        </Button>
      </div>
    );
  }

  const Icon = type.icon;
  const ItemRenderer = type.ItemRenderer;

  const paginated = type?.capabilities?.paginated === true;

  const alertTerms = useMemo(
    () => parseAlertKeywords(column.alertKeywords),
    [column.alertKeywords],
  );
  const includeTerms = useMemo(
    () => parseAlertKeywords(column.filterKeywords),
    [column.filterKeywords],
  );
  const excludeTerms = useMemo(
    () => parseAlertKeywords(column.excludeKeywords),
    [column.excludeKeywords],
  );
  const filtersActive = includeTerms.length > 0 || excludeTerms.length > 0;

  // Apply include/exclude filters client-side. Include = keep only items
  // matching at least one term; exclude = drop items matching any term, and
  // exclude wins when an item matches both. Reuses the alert-keyword matcher so
  // filter semantics (author + content + url, case-insensitive substring) stay
  // identical to the highlight behaviour operators already know.
  const filteredItems = useMemo(() => {
    if (!filtersActive) return column.items;
    return column.items.filter((it) => {
      if (includeTerms.length > 0 && !itemMatchesAlertKeywords(it, includeTerms))
        return false;
      if (excludeTerms.length > 0 && itemMatchesAlertKeywords(it, excludeTerms))
        return false;
      return true;
    });
  }, [filtersActive, column.items, includeTerms, excludeTerms]);

  // Quick-search runs on top of include/exclude — view-state-only narrowing.
  // Empty query passes through, so a closed search bar has zero cost. Search
  // never widens past the persisted-filter results, matching the operator's
  // mental model: filters decide what the column *contains*, search decides
  // what they're looking at *right now* inside that subset.
  const searchActive = searchQuery.trim().length > 0;
  const visibleItems = useMemo(() => {
    if (!searchActive) return filteredItems;
    return filteredItems.filter((it) => itemMatchesSearchQuery(it, searchQuery));
  }, [filteredItems, searchActive, searchQuery]);

  const matchedItemIds = useMemo(() => {
    if (alertTerms.length === 0) return new Set<string>();
    const out = new Set<string>();
    for (const it of visibleItems) {
      if (itemMatchesAlertKeywords(it, alertTerms)) out.add(it.id);
    }
    return out;
  }, [alertTerms, visibleItems]);
  const matchCount = matchedItemIds.size;

  // Auto-open the search row when a query already exists on mount — covers
  // the case where the operator collapsed/expanded a column or switched tabs
  // and the search state was preserved in-session. Closing collapses the row
  // visually but never clears the query, so re-opening shows what they last
  // typed (until they reload or manually clear).
  useEffect(() => {
    if (searchActive && !searchOpen) setSearchOpen(true);
    // intentionally only react to searchActive flipping true — don't auto-
    // close when the operator clears the query mid-type; let them keep the
    // input visible to keep typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchActive]);

  // React to the `/` keyboard shortcut routed via the store. The deck-board
  // listener sets `pendingSearchOpen` to this column's id; we open the search
  // row, focus the input, then clear the signal so a future `/` keypress
  // re-fires cleanly.
  useEffect(() => {
    if (pendingSearchOpen !== column.id) return;
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
    clearPendingSearchOpen(column.id);
  }, [pendingSearchOpen, column.id, clearPendingSearchOpen]);

  // Auto-refresh tick — useRef snapshots so the interval closure always reads
  // the latest typeId/config without forcing a tear-down on every config edit.
  const typeIdRef = useRef(column.typeId);
  const configRef = useRef(column.config);
  typeIdRef.current = column.typeId;
  configRef.current = column.config;

  useEffect(() => {
    const intervalSeconds = column.refreshIntervalSeconds;
    if (!intervalSeconds || intervalSeconds <= 0) return;

    let inFlight = false;
    const tick = async () => {
      // Pause while the tab is hidden so background tabs don't burn upstream
      // rate limits. Re-checked each tick rather than via visibilitychange
      // listener so the check stays colocated with the fetch decision.
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      if (inFlight) return;
      inFlight = true;
      try {
        const { items } = await callColumnApi(
          typeIdRef.current,
          configRef.current,
        );
        await applyFetchedItems(column.id, items);
      } catch (err) {
        // Silent on auto-refresh so a flaky upstream doesn't spam toasts; the
        // operator already has the manual refresh button to surface errors.
        console.warn(
          `[minitor] auto-refresh failed for column ${column.id}`,
          err,
        );
      } finally {
        inFlight = false;
      }
    };

    const handle = setInterval(tick, intervalSeconds * 1000);
    return () => clearInterval(handle);
  }, [applyFetchedItems, column.id, column.refreshIntervalSeconds]);

  async function onRefresh() {
    if (!type) return;
    setIsFetching(true);
    try {
      const { items, nextCursor: cursor } = await callColumnApi(
        type.id,
        column.config,
      );
      const count = await applyFetchedItems(column.id, items);
      // Reset pagination cursor on a fresh refresh.
      setNextCursor(paginated ? (cursor ?? null) : undefined);
      toast.success(count > 0 ? `${count} new item${count === 1 ? "" : "s"}` : "No new items", {
        description: column.title,
      });
    } catch (err) {
      toast.error("Fetch failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsFetching(false);
    }
  }

  // React to the deck-header "Refresh all" button + the `r` / Shift-`R`
  // keyboard shortcuts routed via the store. Each column drains its own id
  // from `pendingRefreshIds` on receipt so the Set converges to empty once
  // every targeted column has fired. While `isFetching` is true (an in-flight
  // refresh) we leave the id in the Set; the effect re-fires the moment the
  // current fetch completes and the operator's intent is honoured without
  // racing two parallel fetches against the same column. `onRefreshRef`
  // captures the latest `onRefresh` without forcing the effect to re-run on
  // every render (it would otherwise depend on a fresh function reference and
  // tear down its own subscription mid-tick).
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  useEffect(() => {
    if (!isPendingRefresh) return;
    if (isFetching) return;
    clearPendingRefresh(column.id);
    void onRefreshRef.current();
  }, [isPendingRefresh, isFetching, column.id, clearPendingRefresh]);

  async function onLoadMore() {
    if (!paginated) return;
    setIsLoadingMore(true);
    try {
      // First load after a cold open: cached items came from the DB without
      // a cursor. Discover the cursor via a refresh-style call — items are
      // already cached so dedup hides the visual repaint — then fetch the
      // next page in the same click.
      let cursor: string | undefined =
        typeof nextCursor === "string" ? nextCursor : undefined;
      if (!cursor) {
        const first = await callColumnApi(type.id, column.config);
        await applyFetchedItems(column.id, first.items);
        cursor = first.nextCursor ?? undefined;
        if (!cursor) {
          setNextCursor(null);
          return;
        }
      }
      const r = await callColumnApi(type.id, column.config, cursor);
      await applyFetchedItems(column.id, r.items);
      setNextCursor(r.nextCursor ?? null);
    } catch (err) {
      toast.error("Couldn't load more", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoadingMore(false);
    }
  }

  // CSSProperties doesn't model `--*` custom properties, so widen with a
  // template-literal index signature to type the beam-frame variables without
  // resorting to `as never` on the keys.
  const style: CSSProperties & Record<`--${string}`, string | number> = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    // consumed by the beam-frame CSS
    "--beam-radius": "10px",
    "--beam-duration": "2s",
  };

  const beamActive = isFetching || isAutoFetching;

  // Resolved width classes. Mobile (<sm) keeps the existing
  // `min(360px, calc(100vw-1rem))` clamp regardless of width override — narrow
  // decks already snap to the viewport on mobile, and a 480px wide column
  // would overflow the available width. Width override applies on desktop only.
  // The default branch (null) preserves the historical sm:w-[360px] exactly so
  // every existing column renders identically until the operator opts in.
  const widthClass =
    columnWidth === "narrow"
      ? "w-[min(360px,calc(100vw-1rem))] sm:w-[240px]"
      : columnWidth === "wide"
        ? "w-[min(480px,calc(100vw-1rem))] sm:w-[480px]"
        : "w-[min(360px,calc(100vw-1rem))] sm:w-[360px]";

  // Collapsed view: render a narrow 48px vertical strip instead of the full
  // 360px column. The strip keeps brand-accent + icon + a rotated title so the
  // operator can still see what they collapsed, plus refresh-state and match
  // badges so a column quietly accumulating alerts isn't invisible. Clicking
  // anywhere on the strip (except the dnd drag distance threshold) re-expands.
  // Auto-refresh and item-state computations continue normally — only the body
  // is hidden, so the moment the operator expands they see the live state.
  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        id={`column-${column.id}`}
        style={style}
        data-beam-active={beamActive ? "true" : "false"}
        data-beam-variant="fetch"
        className={cn(
          "beam-frame group/col-collapsed relative flex h-full w-12 shrink-0 snap-start cursor-pointer flex-col items-center overflow-hidden rounded-lg border border-border bg-card shadow-[0_4px_12px_-10px_rgba(0,0,0,0.10)] transition-all hover:-translate-y-0.5 hover:bg-surface/40 hover:shadow-[0_10px_24px_-14px_rgba(0,0,0,0.18)] sm:snap-none",
          isDragging &&
            "cursor-grabbing shadow-[0_24px_60px_-20px_rgba(0,0,0,0.32)] ring-1 ring-foreground/10",
          isFocused && "ring-2 ring-[color:var(--brand)]/60",
        )}
        onClick={() => {
          // Mouse + keyboard agree on what's focused: a click sets focus to
          // this column AND performs the click's normal action (expand).
          setFocusedColumn(column.id);
          toggleColumnCollapsed(column.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleColumnCollapsed(column.id);
          }
        }}
        aria-label={`Expand ${column.title}`}
        title={`Expand ${column.title}`}
        {...attributes}
        {...listeners}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
          style={{
            background: `linear-gradient(90deg, transparent, ${column.color ?? type.accent}, transparent)`,
          }}
        />
        <div
          className="mt-2.5 flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-black/5"
          style={{ backgroundColor: `${type.accent}33`, color: type.accent }}
        >
          <Icon className="size-4" strokeWidth={2.25} />
        </div>
        <div className="my-2 flex flex-1 w-full items-center justify-center overflow-hidden">
          <div
            className="origin-center -rotate-90 truncate text-[12.5px] font-medium leading-tight text-foreground"
            style={{ width: "200px", letterSpacing: "-0.01em" }}
          >
            {column.title}
          </div>
        </div>
        <div className="mb-2 flex flex-col items-center gap-1.5">
          {column.pinned && (
            <Pin
              aria-label="Pinned to the front of the deck"
              className="size-3 text-[color:var(--brand)]"
              strokeWidth={2.5}
            />
          )}
          {beamActive && (
            <Loader2
              aria-label="Fetching"
              className="size-3 animate-spin text-muted-foreground"
            />
          )}
          {searchActive && (
            <Search
              aria-label={`Search active: "${searchQuery}"`}
              className="size-3 text-emerald-600 dark:text-emerald-400"
            />
          )}
          {matchCount > 0 && (
            <span
              aria-label={`${matchCount} alert match${matchCount === 1 ? "" : "es"}`}
              className="inline-flex items-center justify-center rounded-full bg-yellow-400/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-yellow-700 ring-1 ring-yellow-400/40 dark:text-yellow-300"
            >
              {matchCount}
            </span>
          )}
          <ChevronRight
            className="size-4 text-muted-foreground/70 transition-colors group-hover/col-collapsed:text-foreground"
            aria-hidden
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        id={`column-${column.id}`}
        style={style}
        data-beam-active={beamActive ? "true" : "false"}
        data-beam-variant="fetch"
        className={cn(
          "beam-frame relative h-full shrink-0 snap-start shadow-[0_8px_24px_-16px_rgba(0,0,0,0.12)] transition-[box-shadow,width] sm:snap-none hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.18)]",
          widthClass,
          isDragging &&
            "cursor-grabbing shadow-[0_24px_60px_-20px_rgba(0,0,0,0.32)] ring-1 ring-foreground/10",
          isFocused && "ring-2 ring-[color:var(--brand)]/60",
        )}
        onClick={() => setFocusedColumn(column.id)}
      >
        <div
          className={cn(
            "group/col flex h-full w-full shrink-0 flex-col overflow-hidden bg-card",
          )}
        >
        <div className="relative flex items-center gap-2 border-b border-border bg-surface/50 px-3 py-2.5">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
            style={{ background: `linear-gradient(90deg, transparent, ${column.color ?? type.accent}, transparent)` }}
          />
          <button
            type="button"
            aria-label="Drag column"
            className="shrink-0 cursor-grab touch-none text-muted-foreground/50 opacity-0 transition-opacity group-hover/col:opacity-100 hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-black/5"
            style={{ backgroundColor: `${type.accent}33`, color: type.accent }}
          >
            <Icon className="size-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="flex items-center gap-1.5 truncate text-[13px] font-medium leading-tight text-foreground"
              style={{ letterSpacing: "-0.01em" }}
            >
              {column.color && (
                <span
                  aria-label="Column color label"
                  title={`Color label ${column.color}`}
                  className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: column.color }}
                />
              )}
              <span className="truncate">{column.title}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <span className="truncate">{type.label}</span>
              {column.lastFetchedAt && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="truncate">
                    <RelativeTime date={column.lastFetchedAt} addSuffix />
                  </span>
                </>
              )}
            </div>
          </div>
          {matchCount > 0 && (
            <Tooltip>
              <TooltipTrigger
                aria-label={`${matchCount} item${matchCount === 1 ? "" : "s"} matched alert keywords`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-yellow-400/15 px-2 py-0.5 text-[11px] font-medium text-yellow-700 ring-1 ring-yellow-400/40 dark:text-yellow-300"
              >
                <Bell className="size-3" strokeWidth={2.5} />
                <span className="tabular-nums">{matchCount}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {matchCount} match{matchCount === 1 ? "" : "es"} for: {alertTerms.join(", ")}
              </TooltipContent>
            </Tooltip>
          )}
          {filtersActive && (
            <Tooltip>
              <TooltipTrigger
                aria-label={`Filtered: showing ${filteredItems.length} of ${column.items.length} items`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-400/40 dark:text-sky-300"
              >
                <Filter className="size-3" strokeWidth={2.5} />
                <span className="tabular-nums">
                  {filteredItems.length}/{column.items.length}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Showing {filteredItems.length} of {column.items.length}
                {includeTerms.length > 0 && (
                  <> · only: {includeTerms.join(", ")}</>
                )}
                {excludeTerms.length > 0 && (
                  <> · hiding: {excludeTerms.join(", ")}</>
                )}
              </TooltipContent>
            </Tooltip>
          )}
          {searchActive && (
            <Tooltip>
              <TooltipTrigger
                aria-label={`Search: ${visibleItems.length} of ${filteredItems.length} match "${searchQuery}"`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-400/40 dark:text-emerald-300"
              >
                <Search className="size-3" strokeWidth={2.5} />
                <span className="tabular-nums">
                  {visibleItems.length}/{filteredItems.length}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {visibleItems.length} match{visibleItems.length === 1 ? "" : "es"} for &ldquo;{searchQuery}&rdquo;
              </TooltipContent>
            </Tooltip>
          )}
          {column.refreshIntervalSeconds !== undefined &&
            column.refreshIntervalSeconds > 0 && (
              <Tooltip>
                <TooltipTrigger
                  aria-label={`Auto-refreshing every ${formatRefreshLabel(column.refreshIntervalSeconds)}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border"
                >
                  <Clock className="size-3" strokeWidth={2.5} />
                  <span className="tabular-nums">
                    {formatRefreshLabel(column.refreshIntervalSeconds)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Auto-refreshes every{" "}
                  {formatRefreshLabel(column.refreshIntervalSeconds)} while the
                  tab is visible
                </TooltipContent>
              </Tooltip>
            )}
          {column.pinned && (
            <Tooltip>
              <TooltipTrigger
                aria-label="Pinned to the front of the deck"
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand)]/10 text-[color:var(--brand)] ring-1 ring-[color:var(--brand)]/30"
              >
                <Pin className="size-3" strokeWidth={2.5} />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Pinned to the front · stays visible on every tab
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger
              onClick={() => {
                setSearchOpen((open) => {
                  const next = !open;
                  if (next) {
                    // Focus on next tick so the input mounts before we ask
                    // for focus. requestAnimationFrame is the cheapest hook
                    // for "after this render commits".
                    requestAnimationFrame(() => searchInputRef.current?.focus());
                  }
                  return next;
                });
              }}
              title="Search items"
              aria-label={searchOpen ? "Close search" : "Search items"}
              aria-pressed={searchOpen}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-surface hover:text-[color:var(--brand-hover)]",
                searchActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}
            >
              <Search className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Search items</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              onClick={onRefresh}
              disabled={isFetching}
              title="Refresh"
              aria-label="Refresh"
              className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-[color:var(--brand-hover)] disabled:pointer-events-none disabled:opacity-50"
            >
              {isFetching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </TooltipTrigger>
            <TooltipContent side="bottom">Refresh</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              onClick={() => toggleColumnCollapsed(column.id)}
              title="Collapse"
              aria-label="Collapse column"
              className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-[color:var(--brand-hover)]"
            >
              <ChevronLeft className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom">Collapse</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Column options"
              className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-[color:var(--brand-hover)]"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setConfigureOpen(true)}>
                <Settings2 className="mr-2 size-4" /> Configure
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Pencil className="mr-2 size-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const result = duplicateColumn(column.id);
                  if (result) {
                    toast.success("Column duplicated", {
                      description: `${column.title} (copy)`,
                    });
                  }
                }}
              >
                <Copy className="mr-2 size-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasItems}
                onClick={() => {
                  const n = downloadColumnItems(column.id);
                  if (n > 0) {
                    toast.success(
                      `Exported ${n} item${n === 1 ? "" : "s"}`,
                      { description: column.title },
                    );
                  }
                }}
              >
                <Download className="mr-2 size-4" />{" "}
                {hasItems ? "Download items (JSON)" : "No items loaded yet"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setColumnWidth(column.id, "narrow")}>
                <Minimize2 className="mr-2 size-4" />
                <span className="flex-1">Narrow width</span>
                {columnWidth === "narrow" && (
                  <Check className="ml-2 size-3.5 text-[color:var(--brand)]" aria-hidden />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColumnWidth(column.id, null)}>
                <span className="mr-2 inline-block size-4" aria-hidden />
                <span className="flex-1">Normal width</span>
                {columnWidth === null && (
                  <Check className="ml-2 size-3.5 text-[color:var(--brand)]" aria-hidden />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColumnWidth(column.id, "wide")}>
                <Maximize2 className="mr-2 size-4" />
                <span className="flex-1">Wide width</span>
                {columnWidth === "wide" && (
                  <Check className="ml-2 size-3.5 text-[color:var(--brand)]" aria-hidden />
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {searchOpen && (
          <div className="flex items-center gap-1.5 border-b border-border bg-surface/40 px-2 py-1.5">
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setColumnSearch(column.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setColumnSearch(column.id, "");
                  setSearchOpen(false);
                }
              }}
              placeholder="Find in column…"
              aria-label="Search items in this column"
              maxLength={256}
              className="flex-1 min-w-0 bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {searchActive && (
              <button
                type="button"
                onClick={() => {
                  setColumnSearch(column.id, "");
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
              className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              Esc
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {column.items.length === 0 ? (
            isFetching || isAutoFetching ? (
              <LoadingSkeleton />
            ) : (
              <EmptyState isFetching={isFetching} onRefresh={onRefresh} />
            )
          ) : (
            <div>
              {visibleItems.length === 0 ? (
                searchActive ? (
                  <SearchEmptyState
                    query={searchQuery}
                    onClear={() => {
                      setColumnSearch(column.id, "");
                      searchInputRef.current?.focus();
                    }}
                  />
                ) : (
                  <FilteredEmptyState totalCount={column.items.length} />
                )
              ) : (
                visibleItems.map((item) =>
                  matchedItemIds.has(item.id) ? (
                    <div
                      key={item.id}
                      data-alert-match="true"
                      className="relative bg-yellow-50/40 ring-1 ring-inset ring-yellow-400/50 dark:bg-yellow-400/[0.06]"
                    >
                      <ItemRenderer item={item} />
                    </div>
                  ) : (
                    <ItemRenderer key={item.id} item={item} />
                  ),
                )
              )}
              {paginated && nextCursor !== null && (
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="flex w-full items-center justify-center gap-2 px-3.5 py-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground disabled:opacity-60"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </button>
              )}
              {paginated && nextCursor === null && (
                <div className="px-3.5 py-3 text-center text-[11.5px] text-muted-foreground/70">
                  End of results
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      <ConfigureColumnDialog
        open={configureOpen}
        onOpenChange={setConfigureOpen}
        column={column}
      />
      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename column"
        initialValue={column.title}
        onSubmit={(next) => renameColumn(column.id, next)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${column.title}?`}
        description="Stored items for this column will be deleted. The column type is not affected."
        confirmLabel="Delete column"
        onConfirm={() => removeColumn(column.id)}
      />
    </>
  );
}

function EmptyState({
  isFetching,
  onRefresh,
}: {
  isFetching: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="text-sm font-medium">No items yet</div>
      <div className="text-xs text-muted-foreground">
        Click refresh to fetch the latest.
      </div>
      <Button size="sm" variant="outline" onClick={onRefresh} disabled={isFetching}>
        {isFetching ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 size-4" />
        )}
        Refresh
      </Button>
    </div>
  );
}

function FilteredEmptyState({ totalCount }: { totalCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <Filter className="size-5 text-muted-foreground/60" />
      <div className="text-sm font-medium">No items match the filter</div>
      <div className="text-xs text-muted-foreground">
        {totalCount} item{totalCount === 1 ? "" : "s"} hidden. Adjust the
        column&rsquo;s filters in Configure.
      </div>
    </div>
  );
}

function SearchEmptyState({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <Search className="size-5 text-muted-foreground/60" />
      <div className="text-sm font-medium">No matches for &ldquo;{query}&rdquo;</div>
      <div className="text-xs text-muted-foreground">
        Search is a view-only narrowing on top of the column&rsquo;s filters.
      </div>
      <button
        type="button"
        onClick={onClear}
        className="mt-1 text-xs font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
      >
        Clear search
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading items"
      className="flex h-full flex-col divide-y divide-border"
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <SkeletonRow key={i} delay={i * 120} />
      ))}
    </div>
  );
}

// Short-form label for the clock badge: "1m" / "5m" / "15m" / "60m". Falls
// back to a minute count for off-allowlist values so a future cadence option
// (or a hand-edited deck import that slipped past the allowlist before this
// build) still renders something useful instead of an empty pill.
function formatRefreshLabel(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours}h`;
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

function SkeletonRow({ delay }: { delay: number }) {
  const style = { animationDelay: `${delay}ms` };
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-3">
      <div
        className="size-9 shrink-0 animate-pulse rounded-full bg-foreground/[0.06]"
        style={style}
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-24 animate-pulse rounded bg-foreground/[0.06]"
            style={style}
          />
          <div
            className="h-3 w-12 animate-pulse rounded bg-foreground/[0.04]"
            style={style}
          />
        </div>
        <div
          className="h-3.5 w-full animate-pulse rounded bg-foreground/[0.06]"
          style={style}
        />
        <div
          className="h-3.5 w-4/5 animate-pulse rounded bg-foreground/[0.06]"
          style={style}
        />
      </div>
    </div>
  );
}
