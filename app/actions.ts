"use server";

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { columns, deckSnapshots, decks, feedItems } from "@/lib/db/schema";
import type { Column, Deck, FeedItem } from "@/lib/columns/types";
import { MAX_ITEMS_PER_COLUMN } from "@/lib/columns/constants";
import { ENV_KEYS, ENV_KEY_NAMES } from "@/lib/env-keys";
import { isHostedDeployment } from "@/lib/hosted";
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
// Plain constants + sync validators shared with the client store. They live
// outside this "use server" file because a "use server" module may only export
// async functions — see `lib/deck-rules.ts` for the why.
import {
  DECK_EXPORT_VERSION,
  TAB_GROUP_MAX,
  isAllowedRefreshInterval,
  normalizeColumnColor,
} from "@/lib/deck-rules";

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
    decksById[d.id] = {
      id: d.id,
      name: d.name,
      columnIds: [],
      color: d.color ?? undefined,
    };
    deckOrder.push(d.id);
  }

  const columnsById: Record<string, Column> = {};
  for (const c of columnRows) {
    columnsById[c.id] = {
      id: c.id,
      typeId: c.typeId,
      title: c.title,
      config: c.config ?? {},
      alertKeywords: c.alertKeywords ?? undefined,
      notifyWebhookUrl: c.notifyWebhookUrl ?? undefined,
      refreshIntervalSeconds: c.refreshIntervalSeconds ?? undefined,
      filterKeywords: c.filterKeywords ?? undefined,
      excludeKeywords: c.excludeKeywords ?? undefined,
      tabGroup: c.tabGroup ?? undefined,
      pinned: c.pinned ? true : undefined,
      color: c.color ?? undefined,
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

/**
 * Persist a deck's color label. Pass an empty string or an invalid hex to
 * clear (the normalizer treats both the same way — the UI validates before
 * calling). Validation is server-authoritative so a hand-edited payload
 * can never bypass the hex check. Mirrors `updateColumnColor` exactly —
 * the deck-level analog of the column color labels.
 */
export async function updateDeckColor(
  id: string,
  color: string,
): Promise<void> {
  // Same hex shape as columns — reuse the canonical column normalizer so
  // the two label surfaces (deck-level + per-column) can never drift on
  // case-folding or shorthand acceptance.
  const normalized = normalizeColumnColor(color);
  await db.update(decks).set({ color: normalized }).where(eq(decks.id, id));
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
  // Snapshot the pre-add deck state so the add is reversible from version history.
  await captureDeckSnapshot(deckId);
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

/**
 * Persist a column's include/exclude item filters. Pass empty strings to clear
 * either side. Both are bounded to 512 chars (same budget as alert keywords) so
 * a paste can't bloat storage; the UI never silently rejects, it just truncates.
 * Unlike the webhook URL these are not secrets — they round-trip through deck
 * export / import / share links.
 */
export async function updateColumnFilters(
  id: string,
  filterKeywords: string,
  excludeKeywords: string,
): Promise<void> {
  const include = filterKeywords.slice(0, 512);
  const exclude = excludeKeywords.slice(0, 512);
  await db
    .update(columns)
    .set({
      filterKeywords: include.length === 0 ? null : include,
      excludeKeywords: exclude.length === 0 ? null : exclude,
    })
    .where(eq(columns.id, id));
}

/**
 * Persist a column's tab-group label. Pass an empty string to clear (no group).
 * Whitespace is collapsed to a single space and trimmed so "AI", " AI ", and
 * "AI  " all bucket to the same tab — operators don't have to think about
 * exact-match casing when typing the same label across columns.
 */
export async function updateColumnTabGroup(
  id: string,
  tabGroup: string,
): Promise<void> {
  const normalized = tabGroup.replace(/\s+/g, " ").trim().slice(0, TAB_GROUP_MAX);
  await db
    .update(columns)
    .set({ tabGroup: normalized.length === 0 ? null : normalized })
    .where(eq(columns.id, id));
}

/**
 * Persist a column's pinned flag. Pinned columns render before every unpinned
 * column in the deck regardless of their stored `position`, so the deck-board's
 * sort order is `pinned DESC, position ASC` instead of `position ASC` alone.
 * DnD reorder still works within each group (pinned among pinned, unpinned
 * among unpinned) — `position` keeps the stable relative order.
 */
export async function updateColumnPinned(
  id: string,
  pinned: boolean,
): Promise<void> {
  await db
    .update(columns)
    .set({ pinned })
    .where(eq(columns.id, id));
}

/**
 * Persist a column's color label. Pass an empty string or an invalid hex
 * to clear (the normalizer treats both the same way — there's no value in
 * differentiating "no color" from "tried to set an invalid color"; the UI
 * validates before calling). Validation is server-authoritative so a
 * hand-edited payload can never bypass the hex check.
 */
export async function updateColumnColor(
  id: string,
  color: string,
): Promise<void> {
  const normalized = normalizeColumnColor(color);
  await db
    .update(columns)
    .set({ color: normalized })
    .where(eq(columns.id, id));
}

export async function renameColumn(id: string, title: string): Promise<void> {
  await db.update(columns).set({ title }).where(eq(columns.id, id));
}

/**
 * Duplicate an existing column inside the same deck. The duplicate inherits
 * every persisted setting that round-trips through a deck export
 * (typeId, config, alertKeywords, refreshIntervalSeconds, filterKeywords,
 * excludeKeywords, tabGroup) AND the install-private notifyWebhookUrl — this
 * is a same-install copy, not an export, so the secret stays inside the
 * trust boundary it was originally configured within. The caller controls
 * the new title (the client passes a sensible default like "Original (copy)").
 *
 * `pinned` is deliberately NOT inherited — pinning is the operator's
 * explicit "this is a primary column" decision. Mirrors the deck-board's
 * "DnD across pin/unpin no-op" rule: crossing the pin boundary
 * always requires an explicit action.
 *
 * `color` IS inherited — unlike pinned (a routing decision about where in
 * the deck the column lives), color is a visual labeling decision about
 * what kind of column this is. A duplicated DeFi column is still a DeFi
 * column; if the operator wanted to recolor it, they would do so
 * explicitly afterwards. Inheriting matches the "same lane, same color"
 * intent that color labels exist to encode.
 *
 * The duplicate is inserted at `source.position + 1` so it lands
 * immediately next to its source — every later column shifts right by one.
 * Inserting at the end of the deck would force the operator to drag the
 * copy back over the rest of a long deck to find it, which is the
 * opposite of what a duplicate action is for.
 */
export async function duplicateColumn(
  sourceId: string,
  newId: string,
  newTitle: string,
): Promise<ImportedDeckColumn | null> {
  const [src] = await db.select().from(columns).where(eq(columns.id, sourceId));
  if (!src) return null;

  // Snapshot the pre-duplicate deck state so the structural mutation is
  // reversible from version history — same pattern as createColumn /
  // deleteColumn / reorderColumnsInDeck.
  await captureDeckSnapshot(src.deckId);

  const title = newTitle.trim().slice(0, 256) || src.title.slice(0, 256);

  // Shift-then-insert must be atomic: a crash between the two writes would
  // leave every later column shifted right with no duplicate filling the gap.
  // Wrap both in a transaction, mirroring importDeck.
  await db.transaction(async (tx) => {
    // Shift every column after the source right by 1 to make room for the
    // duplicate at source.position + 1.
    await tx
      .update(columns)
      .set({ position: sql`${columns.position} + 1` })
      .where(
        and(
          eq(columns.deckId, src.deckId),
          sql`${columns.position} > ${src.position}`,
        ),
      );

    await tx.insert(columns).values({
      id: newId,
      deckId: src.deckId,
      typeId: src.typeId,
      title,
      config: src.config,
      alertKeywords: src.alertKeywords,
      notifyWebhookUrl: src.notifyWebhookUrl,
      refreshIntervalSeconds: src.refreshIntervalSeconds,
      filterKeywords: src.filterKeywords,
      excludeKeywords: src.excludeKeywords,
      tabGroup: src.tabGroup,
      pinned: false,
      color: src.color,
      position: src.position + 1,
    });
  });

  return {
    id: newId,
    typeId: src.typeId,
    title,
    config: src.config ?? {},
    alertKeywords: src.alertKeywords ?? undefined,
    notifyWebhookUrl: src.notifyWebhookUrl ?? undefined,
    refreshIntervalSeconds: src.refreshIntervalSeconds ?? undefined,
    filterKeywords: src.filterKeywords ?? undefined,
    excludeKeywords: src.excludeKeywords ?? undefined,
    tabGroup: src.tabGroup ?? undefined,
    pinned: false,
    color: src.color ?? undefined,
  };
}

export async function deleteColumn(id: string): Promise<void> {
  // Snapshot the deck (still holding this column) before the delete, so an
  // accidental removal can be recovered from version history.
  const [col] = await db
    .select({ deckId: columns.deckId })
    .from(columns)
    .where(eq(columns.id, id));
  if (col) await captureDeckSnapshot(col.deckId);
  await db.delete(columns).where(eq(columns.id, id));
}

export async function reorderColumnsInDeck(
  deckId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return;
  // Snapshot the pre-reorder column order before mutating positions.
  await captureDeckSnapshot(deckId);
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
  // Optional include/exclude item filters. Not secrets, so (unlike the webhook)
  // they are emitted by exportDeck and round-trip through share links.
  filterKeywords: z.string().max(512).optional(),
  excludeKeywords: z.string().max(512).optional(),
  // Optional tab-group label. Not a secret — round-trips through export /
  // import / share links so a multi-section starter deck can ship pre-grouped.
  // Normalized server-side (whitespace collapsed, trimmed, capped to TAB_GROUP_MAX).
  tabGroup: z.string().max(TAB_GROUP_MAX).optional(),
  // Optional pin flag. Not a secret — round-trips through export / import /
  // share links so a starter template can ship with priority columns already
  // pinned to the deck's front.
  pinned: z.boolean().optional(),
  // Optional color label (6-char hex `#rrggbb`). Not a secret — round-trips
  // through export / import / share links so a starter template can ship
  // with pre-colored lanes. Deliberately NOT `.regex()`-validated here (same
  // posture as notifyWebhookUrl above): the real check is the imperative
  // `normalizeColumnColor(c.color)` in importDeck, which returns null for any
  // non-`#rrggbb` string so a bad value is *dropped*, not fatal. A `.regex()`
  // here would fail safeParse and throw, killing the entire deck import on a
  // single malformed color — contradicting that drop-not-fail contract.
  color: z.string().max(64).optional(),
});

const importedDeckSchema = z.object({
  version: z.literal(DECK_EXPORT_VERSION),
  deckName: z.string().min(1).max(128),
  // Optional deck-level color label (6-char hex `#rrggbb`). Additive to v1 —
  // exports created before deck color labels existed simply omit this field
  // and import as a deck with `color = null`. Same drop-not-fail contract
  // as column color: a malformed value is dropped to null in importDeck via
  // `normalizeColumnColor`, never aborts the entire deck import.
  deckColor: z.string().max(64).optional(),
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
      filterKeywords: columns.filterKeywords,
      excludeKeywords: columns.excludeKeywords,
      tabGroup: columns.tabGroup,
      pinned: columns.pinned,
      color: columns.color,
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
    ...(deck.color ? { deckColor: deck.color } : {}),
    exportedAt: new Date().toISOString(),
    columns: cols.map((c) => ({
      typeId: c.typeId,
      title: c.title,
      config: c.config ?? {},
      ...(c.alertKeywords ? { alertKeywords: c.alertKeywords } : {}),
      ...(isAllowedRefreshInterval(c.refreshIntervalSeconds)
        ? { refreshIntervalSeconds: c.refreshIntervalSeconds }
        : {}),
      ...(c.filterKeywords ? { filterKeywords: c.filterKeywords } : {}),
      ...(c.excludeKeywords ? { excludeKeywords: c.excludeKeywords } : {}),
      ...(c.tabGroup ? { tabGroup: c.tabGroup } : {}),
      ...(c.pinned ? { pinned: true } : {}),
      ...(c.color ? { color: c.color } : {}),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

// A persisted column as returned from an import/restore: every field a `Column`
// carries except the runtime-only `items` (fetched fresh on first view) and
// `lastFetchedAt` (set on first fetch). Derived from `Column` so a new persisted
// column field is threaded through automatically rather than hand-maintained
// here in lockstep.
export type ImportedDeckColumn = Omit<Column, "items" | "lastFetchedAt">;

export interface ImportedDeckResult {
  deckId: string;
  deckName: string;
  /**
   * Color label applied to the freshly created deck during import — present
   * when the export payload included a valid `deckColor`, absent otherwise.
   * The store reads this to seed the optimistic deck-row insert so the
   * sidebar dot renders the imported deck's color immediately, without
   * waiting for the next loadSnapshot round-trip.
   */
  deckColor?: string;
  columns: ImportedDeckColumn[];
}

/**
 * Validate `json` against the deck-export schema and create a new deck with
 * the imported columns. Always inserts as a new deck (never merges into an
 * existing one) and appends ` (imported)` to the name so the source deck
 * remains untouched. `nameSuffix` overrides the parenthetical tag (e.g.
 * `"restored"` when called from `restoreDeckSnapshot`). Returns the IDs needed
 * to update the client store without a full re-fetch.
 */
export async function importDeck(
  json: string,
  nameSuffix = "imported",
): Promise<ImportedDeckResult> {
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
  const deckName = `${data.deckName} (${nameSuffix})`;
  const created: ImportedDeckColumn[] = [];
  // Hoisted out of the transaction so the post-tx return shape can carry it
  // back to the client store without an extra round-trip.
  let deckColorPersisted: string | null = null;

  await db.transaction(async (tx) => {
    const [{ maxDeckPos }] = await tx
      .select({ maxDeckPos: sql<number>`coalesce(max(${decks.position}), -1)` })
      .from(decks);

    // Re-validate any imported deck color through the same hex normalizer the
    // server action uses for direct writes — drops non-`#rrggbb` strings to
    // null rather than aborting the entire import (same drop-not-fail contract
    // as the column-level color field).
    deckColorPersisted = normalizeColumnColor(data.deckColor ?? null);

    await tx.insert(decks).values({
      id: deckId,
      name: deckName,
      position: maxDeckPos + 1,
      color: deckColorPersisted,
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
      const filterKeywords =
        c.filterKeywords && c.filterKeywords.length > 0
          ? c.filterKeywords.slice(0, 512)
          : null;
      const excludeKeywords =
        c.excludeKeywords && c.excludeKeywords.length > 0
          ? c.excludeKeywords.slice(0, 512)
          : null;
      // Normalize the imported tab-group label through the same rule as the
      // server action (collapse internal whitespace, trim, cap) so a hand-edited
      // payload can't smuggle "  AI  " and "AI" as two distinct buckets.
      const tabGroupRaw = c.tabGroup ?? "";
      const tabGroupNormalized = tabGroupRaw
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, TAB_GROUP_MAX);
      const tabGroup = tabGroupNormalized.length === 0 ? null : tabGroupNormalized;
      // Pinned is a plain boolean — coerce missing/non-true to false so a
      // hand-edited payload can't smuggle a truthy non-boolean into the DB.
      const pinned = c.pinned === true;
      // Re-validate any imported color string through the same hex normalizer
      // the live update path uses. A non-matching value is silently dropped
      // (null) rather than failing the import — same posture as
      // notifyWebhookUrl's SSRF guard above.
      const color = normalizeColumnColor(c.color);
      await tx.insert(columns).values({
        id,
        deckId,
        typeId: c.typeId,
        title: c.title,
        config: c.config,
        alertKeywords,
        notifyWebhookUrl,
        refreshIntervalSeconds,
        filterKeywords,
        excludeKeywords,
        tabGroup,
        pinned,
        color,
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
        ...(filterKeywords ? { filterKeywords } : {}),
        ...(excludeKeywords ? { excludeKeywords } : {}),
        ...(tabGroup ? { tabGroup } : {}),
        ...(pinned ? { pinned: true } : {}),
        ...(color ? { color } : {}),
      });
    }
  });

  // Seed version history for the freshly created deck (also covers restores,
  // which route through this same path). Fire-and-forget — never fails import.
  await captureDeckSnapshot(deckId);

  return {
    deckId,
    deckName,
    ...(deckColorPersisted ? { deckColor: deckColorPersisted } : {}),
    columns: created,
  };
}

const DECK_SNAPSHOT_CAP = 5;

export interface DeckSnapshotMeta {
  id: number;
  capturedAt: string;
  columnCount: number;
}

/**
 * Capture the current state of `deckId` into the rolling version-history log.
 * Serializes via the same `exportDeck` path (so a snapshot is a valid
 * DeckExport v1 payload that restores cleanly) and trims the deck's history to
 * the most recent `DECK_SNAPSHOT_CAP` rows in one transaction. Fire-and-forget:
 * it swallows its own errors so a failed capture never breaks the mutation that
 * triggered it. Empty decks are skipped — an empty snapshot is noise with
 * nothing to restore. Note: like every export path, snapshots deliberately omit
 * `notifyWebhookUrl` (it can embed a secret), so a restored deck re-prompts for
 * any alert webhook — same contract as deck export / share links.
 */
export async function captureDeckSnapshot(deckId: string): Promise<void> {
  try {
    const json = await exportDeck(deckId);
    const parsed = JSON.parse(json) as DeckExport;
    if (!parsed.columns || parsed.columns.length === 0) return;
    await db.transaction(async (tx) => {
      await tx.insert(deckSnapshots).values({ deckId, snapshotJson: json });
      await tx.execute(sql`
        DELETE FROM deck_snapshots
        WHERE deck_id = ${deckId}
          AND id NOT IN (
            SELECT id FROM deck_snapshots
            WHERE deck_id = ${deckId}
            ORDER BY captured_at DESC, id DESC
            LIMIT ${DECK_SNAPSHOT_CAP}
          )
      `);
    });
  } catch {
    // Snapshotting must never break the triggering mutation.
  }
}

/**
 * Return the most recent snapshots for a deck (newest first), each with a
 * lightweight column count parsed from the stored payload for the UI.
 */
export async function loadDeckSnapshots(
  deckId: string,
): Promise<DeckSnapshotMeta[]> {
  const rows = await db
    .select({
      id: deckSnapshots.id,
      capturedAt: deckSnapshots.capturedAt,
      snapshotJson: deckSnapshots.snapshotJson,
    })
    .from(deckSnapshots)
    .where(eq(deckSnapshots.deckId, deckId))
    .orderBy(desc(deckSnapshots.capturedAt), desc(deckSnapshots.id))
    .limit(DECK_SNAPSHOT_CAP);

  return rows.map((r) => {
    let columnCount = 0;
    try {
      const parsed = JSON.parse(r.snapshotJson) as DeckExport;
      columnCount = parsed.columns?.length ?? 0;
    } catch {
      // Leave columnCount at 0 if a stored payload is somehow unparseable.
    }
    return {
      id: r.id,
      capturedAt: r.capturedAt.toISOString(),
      columnCount,
    };
  });
}

/**
 * Restore a snapshot by replaying its stored DeckExport JSON through
 * `importDeck`. Non-destructive: it always creates a NEW deck (suffixed
 * `(restored)`) rather than overwriting the current one, so a restore can
 * itself be undone by deleting the new deck. Reuses importDeck's full Zod
 * validation + SSRF re-check + new-deck contract.
 */
export async function restoreDeckSnapshot(
  snapshotId: number,
): Promise<ImportedDeckResult> {
  const [row] = await db
    .select({ snapshotJson: deckSnapshots.snapshotJson })
    .from(deckSnapshots)
    .where(eq(deckSnapshots.id, snapshotId));
  if (!row) {
    throw new Error("Snapshot not found");
  }
  return importDeck(row.snapshotJson, "restored");
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
  // On a hosted deployment, keys come from host environment variables — the
  // filesystem is often read-only, and (behind the password gate or not) the
  // UI must never be usable to write arbitrary allowlisted keys. Authoritative
  // server-side refusal; the Settings dialog also renders read-only in this mode.
  if (isHostedDeployment()) {
    throw new Error(
      "Editing API keys is disabled on hosted deployments. Set them as environment variables on your host and redeploy.",
    );
  }

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
