"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Filter,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Settings2,
  Trash2,
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
  const hasItems = column.items.length > 0;
  const isAutoFetchingRaw = useDeckStore((s) => s.autoFetchingIds.has(column.id));
  const isCollapsed = useDeckStore((s) => s.collapsedColumnIds.has(column.id));
  const toggleColumnCollapsed = useDeckStore((s) => s.toggleColumnCollapsed);

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
  const visibleItems = useMemo(() => {
    if (!filtersActive) return column.items;
    return column.items.filter((it) => {
      if (includeTerms.length > 0 && !itemMatchesAlertKeywords(it, includeTerms))
        return false;
      if (excludeTerms.length > 0 && itemMatchesAlertKeywords(it, excludeTerms))
        return false;
      return true;
    });
  }, [filtersActive, column.items, includeTerms, excludeTerms]);

  const matchedItemIds = useMemo(() => {
    if (alertTerms.length === 0) return new Set<string>();
    const out = new Set<string>();
    for (const it of visibleItems) {
      if (itemMatchesAlertKeywords(it, alertTerms)) out.add(it.id);
    }
    return out;
  }, [alertTerms, visibleItems]);
  const matchCount = matchedItemIds.size;

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
        )}
        onClick={() => toggleColumnCollapsed(column.id)}
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
            background: `linear-gradient(90deg, transparent, ${type.accent}, transparent)`,
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
          {beamActive && (
            <Loader2
              aria-label="Fetching"
              className="size-3 animate-spin text-muted-foreground"
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
          "beam-frame relative h-full w-[min(360px,calc(100vw-1rem))] shrink-0 snap-start shadow-[0_8px_24px_-16px_rgba(0,0,0,0.12)] transition-shadow sm:w-[360px] sm:snap-none hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.18)]",
          isDragging &&
            "cursor-grabbing shadow-[0_24px_60px_-20px_rgba(0,0,0,0.32)] ring-1 ring-foreground/10",
        )}
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
            style={{ background: `linear-gradient(90deg, transparent, ${type.accent}, transparent)` }}
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
              className="truncate text-[13px] font-medium leading-tight text-foreground"
              style={{ letterSpacing: "-0.01em" }}
            >
              {column.title}
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
                aria-label={`Filtered: showing ${visibleItems.length} of ${column.items.length} items`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-400/40 dark:text-sky-300"
              >
                <Filter className="size-3" strokeWidth={2.5} />
                <span className="tabular-nums">
                  {visibleItems.length}/{column.items.length}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Showing {visibleItems.length} of {column.items.length}
                {includeTerms.length > 0 && (
                  <> · only: {includeTerms.join(", ")}</>
                )}
                {excludeTerms.length > 0 && (
                  <> · hiding: {excludeTerms.join(", ")}</>
                )}
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
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

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
                <FilteredEmptyState totalCount={column.items.length} />
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
