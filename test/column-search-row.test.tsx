// @vitest-environment jsdom

// Behavioural coverage for ColumnCard's inline search row.
//
// This row is driven by a state adjustment during render rather than an
// effect, and the exact trigger shape matters: it has to fire on the query
// going from empty to non-empty, NOT simply whenever a query is present. The
// difference is invisible until you close the row while a query is still
// active — the "Esc" button and the toolbar toggle both do exactly that — at
// which point a condition-triggered version re-opens the row on the next
// render and makes it impossible to dismiss. `closes with an active query and
// stays closed` is the regression test for that.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";

import { ColumnCard } from "@/components/column/column-card";
import { useDeckStore } from "@/lib/store/use-deck-store";
import type { Column } from "@/lib/columns/types";

// The card never fetches on mount, but stub the client anyway so a regression
// that introduces one fails loudly here instead of reaching the network.
vi.mock("@/lib/columns/api-client", () => ({
  callColumnApi: vi.fn(async () => ({ items: [], nextCursor: null })),
}));

const COLUMN_ID = "col-search-test";

function hnItem(id: string, content: string) {
  return {
    id,
    author: { name: "tester" },
    content,
    url: `https://example.com/${id}`,
    createdAt: new Date(0).toISOString(),
    meta: {
      points: 1,
      comments: 0,
      commentsUrl: `https://news.ycombinator.com/item?id=${id}`,
    },
  };
}

const column: Column = {
  id: COLUMN_ID,
  typeId: "hacker-news",
  title: "HN",
  config: { mode: "top" },
  items: [
    hnItem("i1", "Postgres index internals"),
    hnItem("i2", "The LSM tree"),
  ],
} as unknown as Column;

function renderCard() {
  return render(
    <DndContext>
      <SortableContext items={[COLUMN_ID]}>
        <ColumnCard column={column} />
      </SortableContext>
    </DndContext>,
  );
}

/** The inline query input, or null when the row is closed. */
function searchInput() {
  return screen.queryByLabelText("Search items in this column");
}

// Both the header toggle and the in-row dismiss button carry
// aria-label="Close search" while the row is open, so neither can be selected
// by accessible name alone.

/** The header toggle, identified by its stable `title`. */
function toggleButton() {
  return screen.getByTitle("Search items");
}

/** The "Esc" dismiss button inside the row, identified by its text. */
function escButton() {
  return screen.getByText("Esc");
}

function seedStore(overrides: Record<string, unknown> = {}) {
  useDeckStore.setState({
    columns: { [COLUMN_ID]: column },
    searchByColumn: {},
    collapsedColumnIds: new Set<string>(),
    autoFetchingIds: new Set<string>(),
    pendingRefreshIds: new Set<string>(),
    pendingSearchOpen: null,
    focusedColumnId: null,
    widthByColumn: {},
    ...overrides,
  });
}

beforeEach(() => {
  seedStore();
});

describe("ColumnCard search row", () => {
  it("stays closed on mount when there is no query", () => {
    renderCard();
    expect(searchInput()).not.toBeInTheDocument();
  });

  it("opens on mount when a query already exists", () => {
    // Mirrors a column remounting after a collapse/expand or tab switch with
    // the in-session query still in the store.
    seedStore({ searchByColumn: { [COLUMN_ID]: "postgres" } });
    renderCard();

    expect(searchInput()).toBeInTheDocument();
    expect(searchInput()).toHaveValue("postgres");
  });

  it("opens when the operator types a query into the row", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(toggleButton());
    await user.type(searchInput()!, "lsm");

    expect(searchInput()).toHaveValue("lsm");
    expect(useDeckStore.getState().searchByColumn[COLUMN_ID]).toBe("lsm");
  });

  // The regression test. A condition-triggered adjustment re-opens the row
  // here, because the query is still active after the close.
  it("closes with an active query and stays closed", async () => {
    const user = userEvent.setup();
    seedStore({ searchByColumn: { [COLUMN_ID]: "postgres" } });
    renderCard();

    expect(searchInput()).toBeInTheDocument();

    await user.click(escButton());

    expect(searchInput()).not.toBeInTheDocument();
    // The query is deliberately retained — closing hides the row, it does not
    // clear the search.
    expect(useDeckStore.getState().searchByColumn[COLUMN_ID]).toBe("postgres");
  });

  it("restores the retained query when reopened", async () => {
    const user = userEvent.setup();
    seedStore({ searchByColumn: { [COLUMN_ID]: "postgres" } });
    renderCard();

    await user.click(escButton());
    expect(searchInput()).not.toBeInTheDocument();

    await user.click(toggleButton());

    expect(searchInput()).toHaveValue("postgres");
  });

  it("keeps the row open when the query is cleared mid-type", async () => {
    const user = userEvent.setup();
    seedStore({ searchByColumn: { [COLUMN_ID]: "postgres" } });
    renderCard();

    await user.clear(searchInput()!);

    // Clearing must not auto-close: the operator is still typing.
    expect(searchInput()).toBeInTheDocument();
    expect(searchInput()).toHaveValue("");
  });

  it("opens and focuses the input when the `/` signal arrives", async () => {
    renderCard();
    expect(searchInput()).not.toBeInTheDocument();

    // What the deck-board `/` handler does for the focused column.
    await act(async () => {
      useDeckStore.getState().requestSearchOpen(COLUMN_ID);
    });

    expect(searchInput()).toBeInTheDocument();
    // The effect drains the one-shot signal so a later `/` re-fires.
    expect(useDeckStore.getState().pendingSearchOpen).toBeNull();

    // Focus is moved in a rAF callback, which the setup file shims onto a
    // macrotask.
    await vi.waitFor(() => expect(searchInput()).toHaveFocus());
  });
});
