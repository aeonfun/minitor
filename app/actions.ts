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
import {
  parseAlertKeywords,
  matchedAlertKeywords,
} from "@/lib/columns/keyword-match";
import {
  sendColumnWebhook,
  validateWebhookUrl,
  WEBHOOK_URL_MAX,
  type WebhookMatch,
} from "@/lib/columns/webhook";

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
      alertKeywords: c.alertKeywords ?? undefined,
      notifyWebhookUrl: c.notifyWebhookUrl ?? undefined,
      refreshIntervalSeconds: c.refreshIntervalSeconds ?? undefined,
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

/**
 * Persist a column's alert-keyword string. Pass an empty string to clear.
 * Validated to 512 chars to bound storage; longer inputs are truncated so the
 * UI never silently rejects a paste.
 */
export async function updateColumnAlertKeywords(
  id: string,
  alertKeywords: string,
): Promise<void> {
  const trimmed = alertKeywords.slice(0, 512);
  await db
    .update(columns)
    .set({ alertKeywords: trimmed.length === 0 ? null : trimmed })
    .where(eq(columns.id, id));
}

/**
 * Persist a column's alert-webhook URL. Pass an empty string to clear. The URL
 * is validated server-side (https only, no localhost / private IP literals) so
 * the dashboard can't be used to make the server POST to internal addresses.
 * Throws on an invalid non-empty URL so the caller can surface the reason.
 */
export async function updateColumnWebhookUrl(
  id: string,
  webhookUrl: string,
): Promise<void> {
  const trimmed = webhookUrl.trim();
  if (trimmed.length === 0) {
    await db
      .update(columns)
      .set({ notifyWebhookUrl: null })
      .where(eq(columns.id, id));
    return;
  }
  const check = validateWebhookUrl(trimmed);
  if (!check.ok) {
    throw new Error(check.reason);
  }
  await db
    .update(columns)
    .set({ notifyWebhookUrl: check.url })
    .where(eq(columns.id, id));
}

/**
 * Whitelist of refresh-interval cadences (seconds). Anything outside this set
 * is rejected server-side and persisted as NULL (manual-only). Keeping the
 * allowlist short prevents the UI from being used to schedule pathological
 * sub-minute polling that would hammer upstream rate limits.
 */
export const REFRESH_INTERVAL_OPTIONS = [60, 300, 900, 3600] as const;
export type RefreshIntervalSeconds = (typeof REFRESH_INTERVAL_OPTIONS)[number];

const REFRESH_INTERVAL_SET = new Set<number>(REFRESH_INTERVAL_OPTIONS);

export function isAllowedRefreshInterval(
  value: unknown,
): value is RefreshIntervalSeconds {
  return typeof value === "number" && REFRESH_INTERVAL_SET.has(value);
}

/**
 * Persist a column's auto-refresh cadence. Pass `null` to clear (manual-only).
 * Non-allowlisted values are coerced to `null` server-side — never trust the
 * client to enforce the cadence floor.
 */
export async function updateColumnRefreshInterval(
  id: string,
  refreshIntervalSeconds: number | null,
): Promise<void> {
  const next = isAllowedRefreshInterval(refreshIntervalSeconds)
    ? refreshIntervalSeconds
    : null;
  await db
    .update(columns)
    .set({ refreshIntervalSeconds: next })
    .where(eq(columns.id, id));
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
  alertKeywords: z.string().max(512).optional(),
  // Part of DeckExport v1 so a hand-authored or full-backup config can carry a
  // webhook, but `exportDeck` deliberately never emits it (see below). Any value
  // present on import is re-validated through the SSRF guard before persisting.
  notifyWebhookUrl: z.string().max(WEBHOOK_URL_MAX).optional(),
  // Optional auto-refresh cadence. Unknown / non-allowlisted values are dropped
  // in importDeck so a tampered or hand-edited payload can't smuggle a 1-second
  // poll past the server-side guard.
  refreshIntervalSeconds: z.number().int().positive().optional(),
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
      alertKeywords: columns.alertKeywords,
      refreshIntervalSeconds: columns.refreshIntervalSeconds,
    })
    .from(columns)
    .where(eq(columns.deckId, deckId))
    .orderBy(asc(columns.position), asc(columns.createdAt));

  // notifyWebhookUrl is intentionally NOT exported. A webhook URL is
  // install-private (it commonly embeds a secret token, e.g. a Slack/Discord
  // webhook), and the same exportDeck output feeds both the copy-JSON action
  // and the public share link. Emitting it here would leak the secret to anyone
  // the deck is shared with. Operators re-enter the webhook on import.
  const payload: DeckExport = {
    version: DECK_EXPORT_VERSION,
    deckName: deck.name,
    exportedAt: new Date().toISOString(),
    columns: cols.map((c) => ({
      typeId: c.typeId,
      title: c.title,
      config: (c.config as Record<string, unknown>) ?? {},
      ...(c.alertKeywords ? { alertKeywords: c.alertKeywords } : {}),
      ...(isAllowedRefreshInterval(c.refreshIntervalSeconds)
        ? { refreshIntervalSeconds: c.refreshIntervalSeconds }
        : {}),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export interface ImportedDeckColumn {
  id: string;
  typeId: string;
  title: string;
  config: Record<string, unknown>;
  alertKeywords?: string;
  notifyWebhookUrl?: string;
  refreshIntervalSeconds?: number;
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
      const alertKeywords =
        c.alertKeywords && c.alertKeywords.length > 0 ? c.alertKeywords : null;
      // Re-validate any imported webhook URL through the SSRF guard. A bad or
      // internal-pointing URL is dropped (null), not fatal — the rest of the
      // column still imports.
      let notifyWebhookUrl: string | null = null;
      if (c.notifyWebhookUrl && c.notifyWebhookUrl.trim().length > 0) {
        const check = validateWebhookUrl(c.notifyWebhookUrl);
        if (check.ok) notifyWebhookUrl = check.url;
      }
      const refreshIntervalSeconds = isAllowedRefreshInterval(
        c.refreshIntervalSeconds,
      )
        ? c.refreshIntervalSeconds
        : null;
      await tx.insert(columns).values({
        id,
        deckId,
        typeId: c.typeId,
        title: c.title,
        config: c.config,
        alertKeywords,
        notifyWebhookUrl,
        refreshIntervalSeconds,
        position: i,
      });
      created.push({
        id,
        typeId: c.typeId,
        title: c.title,
        config: c.config,
        ...(alertKeywords ? { alertKeywords } : {}),
        ...(notifyWebhookUrl ? { notifyWebhookUrl } : {}),
        ...(refreshIntervalSeconds !== null ? { refreshIntervalSeconds } : {}),
      });
    }
  });

  return { deckId, deckName, columns: created };
}

export async function persistFetchedItems(
  columnId: string,
  items: FeedItem[],
): Promise<{ newCount: number; lastFetchedAt: string }> {
  const fetchedAt = new Date();

  // Gather existing ids to identify "new" arrivals
  let newItems: FeedItem[] = items;
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
    newItems = items.filter((i) => !existingIds.has(i.id));

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

  // Fire the alert webhook for NEW items that match the column's keywords.
  // Keyed on new arrivals only, so a re-fetch of already-seen items never
  // re-notifies. Bounded and non-throwing — never fails the persist.
  await notifyColumnWebhookIfMatched(columnId, newItems);

  return { newCount: newItems.length, lastFetchedAt: fetchedAt.toISOString() };
}

/**
 * If the column has both an alert-webhook URL and alert keywords configured,
 * POST the subset of `candidateItems` that match the keywords. No-op when
 * either is unset or nothing matches. The send is bounded (5s) and swallows
 * its own errors, so this never affects the fetch result.
 */
async function notifyColumnWebhookIfMatched(
  columnId: string,
  candidateItems: FeedItem[],
): Promise<void> {
  if (candidateItems.length === 0) return;

  const [col] = await db
    .select({
      title: columns.title,
      typeId: columns.typeId,
      alertKeywords: columns.alertKeywords,
      notifyWebhookUrl: columns.notifyWebhookUrl,
    })
    .from(columns)
    .where(eq(columns.id, columnId));

  if (!col?.notifyWebhookUrl || !col.alertKeywords) return;

  const terms = parseAlertKeywords(col.alertKeywords);
  if (terms.length === 0) return;

  const matches: WebhookMatch[] = [];
  for (const item of candidateItems) {
    const matchedKeywords = matchedAlertKeywords(item, terms);
    if (matchedKeywords.length === 0) continue;
    matches.push({
      id: item.id,
      url: item.url,
      text: item.content,
      matchedKeywords,
    });
  }
  if (matches.length === 0) return;

  await sendColumnWebhook(col.notifyWebhookUrl, {
    columnId,
    columnTitle: col.title,
    typeId: col.typeId,
    matches,
    timestamp: new Date().toISOString(),
  });
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
