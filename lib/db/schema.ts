import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

export const decks = pgTable("decks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
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
  position: integer("position").notNull().default(0),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
