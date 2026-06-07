import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  jsonb,
  boolean,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

export const decks = pgTable("decks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  color: text("color"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const columns = pgTable("columns", {
  id: text("id").primaryKey(),
  deckId: text("deck_id")
    .notNull()
    .references(() => decks.id, { onDelete: "cascade" }),
  typeId: text("type_id").notNull(),
  title: text("title").notNull(),
  config: jsonb("config").notNull().default({}),
  alertKeywords: text("alert_keywords"),
  notifyWebhookUrl: text("notify_webhook_url"),
  refreshIntervalSeconds: integer("refresh_interval_seconds"),
  filterKeywords: text("filter_keywords"),
  excludeKeywords: text("exclude_keywords"),
  tabGroup: text("tab_group"),
  pinned: boolean("pinned").notNull().default(false),
  color: text("color"),
  position: integer("position").notNull().default(0),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Rolling per-deck snapshot log for version history. Each row is a full
// DeckExport v1 JSON of the deck at a moment just before a structural mutation
// (or just after an import/restore). Capped to the most recent few rows per
// deck in app/actions.ts; cascades away with its parent deck.
export const deckSnapshots = pgTable(
  "deck_snapshots",
  {
    id: serial("id").primaryKey(),
    deckId: text("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    snapshotJson: text("snapshot_json").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("deck_snapshots_deck_captured_idx").on(t.deckId, t.capturedAt)],
);

export const feedItems = pgTable(
  "feed_items",
  {
    id: text("id").notNull(),
    columnId: text("column_id")
      .notNull()
      .references(() => columns.id, { onDelete: "cascade" }),
    author: jsonb("author").notNull(),
    content: text("content").notNull(),
    url: text("url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    meta: jsonb("meta"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.columnId, t.id] }),
    index("feed_items_column_created_idx").on(t.columnId, t.createdAt),
  ],
);
