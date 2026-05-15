"use server";

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { columns, decks, feedItems } from "@/lib/db/schema";
import type { Column, Deck, FeedItem } from "@/lib/columns/types";
import { MAX_ITEMS_PER_COLUMN } from "@/lib/columns/constants";
import { ENV_KEYS, ENV_KEY_NAMES } from "@/lib/env-keys";

export interface Snapshot {
  decks: Record<string, Deck>;
  deckOrder: string[];
  columns: Record<string, Column>;
}

type ItemRow = {
  id: string;
  column_id: string;
  author: FeedItem["author"];
  content: string;
  url: string | null;
  created_at: string;
  meta: Record<string, unknown> | null;
};

// Returns whether each env var is set on the server, without ever leaking
// the values themselves. Used by the AddColumn dialog to grey out / filter
// plugins whose required keys aren't configured.
export async function getKeyAvailability(
  keys: string[],
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const k of keys) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(k)) continue;
    out[k] = Boolean(process.env[k]);
  }
  return out;
}

export async function loadSnapshot(): Promise<Snapshot> {
  // Page items at the DB instead of slicing in memory: window-function with
  // row_number() returns at most MAX_ITEMS_PER_COLUMN per column, ordered
  // newest-first within each partition.
  const itemQuery = db.execute(sql`
    SELECT id, column_id, author, content, url, created_at, meta
    FROM (
      SELECT *,
        row_number() OVER (PARTITION BY column_id ORDER BY created_at DESC) AS rn
      FROM feed_items
    ) t
    WHERE rn <= ${MAX_ITEMS_PER_COLUMN}
    ORDER BY column_id, created_at DESC
  `);

  const [deckRows, columnRows, itemResult] = await Promise.all([
    db.select().from(decks).orderBy(asc(decks.position), asc(decks.createdAt)),
    db
      .select()
      .from(columns)
      .orderBy(asc(columns.position), asc(columns.createdAt)),
    itemQuery,
  ]);

  const decksById: Record<string, Deck> = {};
  const deckOrder: string[] = [];
  for (const d of deckRows) {
    decksById[d.id] = { id: d.id, name: d.name, columnIds: [] };
    deckOrder.push(d.id);
  }

  const columnsById: Record<string, Column> = {};
  for (const c of columnRows) {
    columnsById[c.id] = {
      id: c.id,
      typeId: c.typeId,
      title: c.title,
      config: (c.config as Record<string, unknown>) ?? {},
      items: [],
      lastFetchedAt: c.lastFetchedAt ? c.lastFetchedAt.toISOString() : undefined,
    };
    decksById[c.deckId]?.columnIds.push(c.id);
  }

  // All three Drizzle drivers (pglite / neon-http / node-postgres) return
  // `{ rows: T[] }` from `db.execute(sql)`, so we can read `.rows` directly
  // without normalizing across drivers.
  const itemRows = (itemResult.rows ?? []) as ItemRow[];
  for (const item of itemRows) {
    const col = columnsById[item.column_id];
    if (!col) continue;
    col.items.push({
      id: item.id,
      author: item.author,
      content: item.content,
      url: item.url ?? undefined,
      createdAt: new Date(item.created_at).toISOString(),
      meta: item.meta ?? undefined,
    });
  }

  return { decks: decksById, deckOrder, columns: columnsById };
}

export async function createDeck(id: string, name: string): Promise<void> {
  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${decks.position}), -1)` })
    .from(decks);
  await db.insert(decks).values({ id, name, position: maxPos + 1 });
}

export async function renameDeck(id: string, name: string): Promise<void> {
  await db.update(decks).set({ name }).where(eq(decks.id, id));
}

export async function deleteDeck(id: string): Promise<void> {
  await db.delete(decks).where(eq(decks.id, id));
}

export async function reorderDecks(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const values = sql.join(
    orderedIds.map((id, i) => sql`(${id}::text, ${i}::int)`),
    sql`, `,
  );
  await db.execute(sql`
    UPDATE decks
    SET position = v.position
    FROM (VALUES ${values}) AS v(id, position)
    WHERE decks.id = v.id
  `);
}

export async function createColumn(
  id: string,
  deckId: string,
  typeId: string,
  title: string,
  config: Record<string, unknown>,
): Promise<void> {
  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${columns.position}), -1)` })
    .from(columns)
    .where(eq(columns.deckId, deckId));
  await db.insert(columns).values({
    id,
    deckId,
    typeId,
    title,
    config,
    position: maxPos + 1,
  });
}

export async function updateColumnConfig(
  id: string,
  config: Record<string, unknown>,
): Promise<void> {
  await db.update(columns).set({ config }).where(eq(columns.id, id));
}

export async function renameColumn(id: string, title: string): Promise<void> {
  await db.update(columns).set({ title }).where(eq(columns.id, id));
}

export async function deleteColumn(id: string): Promise<void> {
  await db.delete(columns).where(eq(columns.id, id));
}

export async function reorderColumnsInDeck(
  deckId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return;
  const values = sql.join(
    orderedIds.map((id, i) => sql`(${id}::text, ${i}::int)`),
    sql`, `,
  );
  await db.execute(sql`
    UPDATE columns
    SET position = v.position, deck_id = ${deckId}
    FROM (VALUES ${values}) AS v(id, position)
    WHERE columns.id = v.id
  `);
}

export const DECK_EXPORT_VERSION = 1;

const importedColumnSchema = z.object({
  typeId: z.string().min(1).max(128),
  title: z.string().min(1).max(256),
  config: z.record(z.string(), z.unknown()),
});

const importedDeckSchema = z.object({
  version: z.literal(DECK_EXPORT_VERSION),
  deckName: z.string().min(1).max(128),
  exportedAt: z.string().optional(),
  columns: z.array(importedColumnSchema).max(64),
});

export type DeckExport = z.infer<typeof importedDeckSchema>;

/**
 * Serialize a deck (name + ordered columns) to a JSON string suitable for
 * sharing. Feed items are intentionally not included — they're fetched from
 * upstream sources, not stored in user state. Imports recreate columns and
 * trigger a fresh fetch on first view.
 */
export async function exportDeck(deckId: string): Promise<string> {
  const [deck] = await db.select().from(decks).where(eq(decks.id, deckId));
  if (!deck) {
    throw new Error("Deck not found");
  }
  const cols = await db
    .select({
      typeId: columns.typeId,
      title: columns.title,
      config: columns.config,
    })
    .from(columns)
    .where(eq(columns.deckId, deckId))
    .orderBy(asc(columns.position), asc(columns.createdAt));

  const payload: DeckExport = {
    version: DECK_EXPORT_VERSION,
    deckName: deck.name,
    exportedAt: new Date().toISOString(),
    columns: cols.map((c) => ({
      typeId: c.typeId,
      title: c.title,
      config: (c.config as Record<string, unknown>) ?? {},
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export interface ImportedDeckColumn {
  id: string;
  typeId: string;
  title: string;
  config: Record<string, unknown>;
}

export interface ImportedDeckResult {
  deckId: string;
  deckName: string;
  columns: ImportedDeckColumn[];
}

/**
 * Validate `json` against the deck-export schema and create a new deck with
 * the imported columns. Always inserts as a new deck (never merges into an
 * existing one) and appends ` (imported)` to the name so the source deck
 * remains untouched. Returns the IDs needed to update the client store
 * without a full re-fetch.
 */
export async function importDeck(json: string): Promise<ImportedDeckResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Not valid JSON");
  }
  const result = importedDeckSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.length > 0 ? first.path.join(".") : "<root>";
    throw new Error(`Invalid deck JSON at ${path}: ${first.message}`);
  }
  const data = result.data;

  const deckId = nanoid();
  const deckName = `${data.deckName} (imported)`;
  const created: ImportedDeckColumn[] = [];

  await db.transaction(async (tx) => {
    const [{ maxDeckPos }] = await tx
      .select({ maxDeckPos: sql<number>`coalesce(max(${decks.position}), -1)` })
      .from(decks);

    await tx.insert(decks).values({
      id: deckId,
      name: deckName,
      position: maxDeckPos + 1,
    });

    for (let i = 0; i < data.columns.length; i++) {
      const c = data.columns[i];
      const id = nanoid();
      await tx.insert(columns).values({
        id,
        deckId,
        typeId: c.typeId,
        title: c.title,
        config: c.config,
        position: i,
      });
      created.push({ id, typeId: c.typeId, title: c.title, config: c.config });
    }
  });

  return { deckId, deckName, columns: created };
}

export async function persistFetchedItems(
  columnId: string,
  items: FeedItem[],
): Promise<{ newCount: number; lastFetchedAt: string }> {
  const fetchedAt = new Date();

  // Gather existing ids to count "new" arrivals
  let newCount = items.length;
  if (items.length > 0) {
    const existing = await db
      .select({ id: feedItems.id })
      .from(feedItems)
      .where(
        and(
          eq(feedItems.columnId, columnId),
          inArray(
            feedItems.id,
            items.map((i) => i.id),
          ),
        ),
      );
    const existingIds = new Set(existing.map((r) => r.id));
    newCount = items.filter((i) => !existingIds.has(i.id)).length;

    await db
      .insert(feedItems)
      .values(
        items.map((i) => ({
          id: i.id,
          columnId,
          author: i.author,
          content: i.content,
          url: i.url ?? null,
          createdAt: new Date(i.createdAt),
          meta: i.meta ?? null,
          fetchedAt,
        })),
      )
      .onConflictDoNothing({ target: [feedItems.columnId, feedItems.id] });
  }

  await db
    .update(columns)
    .set({ lastFetchedAt: fetchedAt })
    .where(eq(columns.id, columnId));

  // Cap history per column
  await db.execute(sql`
    DELETE FROM feed_items
    WHERE column_id = ${columnId}
      AND (column_id, id) NOT IN (
        SELECT column_id, id FROM feed_items
        WHERE column_id = ${columnId}
        ORDER BY created_at DESC
        LIMIT ${MAX_ITEMS_PER_COLUMN}
      )
  `);

  return { newCount, lastFetchedAt: fetchedAt.toISOString() };
}

const ENV_LOCAL_PATH = join(process.cwd(), ".env.local");

export interface EnvKeyStatus {
  key: string;
  set: boolean;
  /** Last 4 chars of the current value, for "ending in …abcd" hints. */
  preview?: string;
}

/**
 * Returns set/unset + a tail preview for each known key. The preview lets the
 * UI hint at which key is currently configured ("ending in …abcd") without
 * leaking the full secret.
 */
export async function getEnvKeysStatus(): Promise<EnvKeyStatus[]> {
  return ENV_KEYS.map(({ key }) => {
    const v = process.env[key] ?? "";
    if (!v) return { key, set: false };
    const preview = v.length >= 4 ? v.slice(-4) : v;
    return { key, set: true, preview };
  });
}

/**
 * Writes `updates` into `.env.local` (creating it if missing) and mirrors the
 * same change into `process.env` so the running fetchers pick it up without a
 * manual restart. Empty-string values delete the key.
 *
 * Only keys in the `ENV_KEYS` allowlist are accepted — prevents the UI from
 * being abused to write arbitrary env vars.
 */
export async function setEnvKeys(
  updates: Record<string, string>,
): Promise<void> {
  const sanitized: Record<string, string> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (!ENV_KEY_NAMES.has(k)) continue;
    if (typeof v !== "string") continue;
    sanitized[k] = v;
  }
  if (Object.keys(sanitized).length === 0) return;

  let raw = "";
  try {
    raw = await readFile(ENV_LOCAL_PATH, "utf8");
  } catch {
    // File may not exist yet — start from empty.
  }

  const lines = raw.length === 0 ? [] : raw.split(/\r?\n/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
    const key = m?.[1];
    if (key && key in sanitized) {
      seen.add(key);
      const v = sanitized[key];
      if (v) result.push(`${key}=${escapeEnvValue(v)}`);
      // empty value ⇒ drop the line
    } else {
      result.push(line);
    }
  }
  for (const [k, v] of Object.entries(sanitized)) {
    if (seen.has(k)) continue;
    if (!v) continue;
    if (result.length > 0 && result[result.length - 1] !== "") result.push("");
    result.push(`${k}=${escapeEnvValue(v)}`);
  }

  let body = result.join("\n");
  if (!body.endsWith("\n")) body += "\n";
  await writeFile(ENV_LOCAL_PATH, body, { mode: 0o600 });

  for (const [k, v] of Object.entries(sanitized)) {
    if (v) process.env[k] = v;
    else delete process.env[k];
  }
}

function escapeEnvValue(v: string): string {
  if (/[\s"'`$#\\]/.test(v)) {
    return `"${v.replace(/(["\\$`])/g, "\\$1")}"`;
  }
  return v;
}
