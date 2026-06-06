import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import type { z } from "zod";

export interface FeedAuthor {
  name: string;
  handle?: string;
  avatarUrl?: string;
}

export interface FeedItem<TMeta = unknown> {
  id: string;
  author: FeedAuthor;
  content: string;
  url?: string;
  createdAt: string;
  meta?: TMeta;
}

export interface ConfigFormProps<TConfig> {
  value: TConfig;
  onChange: (next: TConfig) => void;
}

export interface ItemRendererProps<TMeta = unknown> {
  item: FeedItem<TMeta>;
}

export interface PageResult<TMeta = unknown> {
  items: FeedItem<TMeta>[];
  /** Opaque cursor for the next page, or undefined when exhausted. */
  nextCursor?: string;
}

export type ColumnCategory =
  | "ai"
  | "social"
  | "news"
  | "video"
  | "blockchain"
  | "other";

/**
 * Declarative capabilities a plugin opts into. The UI reads these to render
 * conditionally — e.g. show "Load more" only when `paginated`, warn about
 * missing API keys via `requiresEnv`.
 */
export interface ColumnCapabilities {
  /** Server may return a `nextCursor`; UI shows Load more. */
  paginated?: boolean;
  /** Hint for auto-refresh; UI may use this to schedule background fetches. */
  refreshIntervalHintMs?: number;
  /** Env vars the server fetcher requires. UI surfaces a warning when missing. */
  requiresEnv?: string[];
  /** Free-form rate-limit description shown in the config form. */
  rateLimitHint?: string;
}

/**
 * Pure plugin metadata — describes a column type without depending on any
 * React JSX (so it can be imported from server code) or server-only modules
 * (so it can be imported from client code). The full UI is assembled by
 * combining this with `ConfigForm` + `ItemRenderer` in the plugin's `client.tsx`.
 */
export interface PluginMeta<
  TConfig extends Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TMeta = unknown,
> {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  category: ColumnCategory;
  /** Single source of truth for the config shape. Server validates with this. */
  schema: z.ZodType<TConfig>;
  /** Default config used when creating a column. Usually `schema.parse({})`. */
  defaultConfig: TConfig;
  defaultTitle: (config: TConfig) => string;
  capabilities?: ColumnCapabilities;
}

/**
 * Full client-side description: metadata + UI components. Registered in
 * `lib/columns/registry.ts` and consumed by the dashboard.
 */
export interface ColumnUI<
  TConfig extends Record<string, unknown>,
  TMeta = unknown,
> extends PluginMeta<TConfig, TMeta> {
  ConfigForm: ComponentType<ConfigFormProps<TConfig>>;
  ItemRenderer: ComponentType<ItemRendererProps<TMeta>>;
}

/** Config-erased view stored in the registry. Meta is widened to `unknown` so
 *  any concrete `TMeta` (with or without an index signature) flows through. */
export type AnyColumnUI = ColumnUI<Record<string, unknown>, unknown>;

/**
 * Server-side fetch contract. Receives a validated config (already passed
 * through the plugin's Zod schema) and an opaque cursor for pagination.
 */
export type ServerFetcher<
  TConfig extends Record<string, unknown>,
  TMeta = unknown,
> = (config: TConfig, cursor?: string) => Promise<PageResult<TMeta>>;

/** Server-side plugin registration: meta (incl. schema for validation) + fetcher. */
export interface ColumnServer<
  TConfig extends Record<string, unknown>,
  TMeta = unknown,
> {
  meta: PluginMeta<TConfig, TMeta>;
  fetch: ServerFetcher<TConfig, TMeta>;
}

export type AnyColumnServer = ColumnServer<Record<string, unknown>, unknown>;

/**
 * Registers a typed `ColumnUI<C, M>` as `AnyColumnUI` without sprinkling
 * `as unknown as` casts. The cast is unsafe in principle (TConfig is invariant)
 * but safe in practice because every consumer treats config + meta as opaque.
 */
export function defineColumnUI<
  TConfig extends Record<string, unknown>,
  TMeta = unknown,
>(ui: ColumnUI<TConfig, TMeta>): AnyColumnUI {
  return ui as unknown as AnyColumnUI;
}

export function defineColumnServer<
  TConfig extends Record<string, unknown>,
  TMeta = unknown,
>(server: ColumnServer<TConfig, TMeta>): AnyColumnServer {
  return server as unknown as AnyColumnServer;
}

export interface Column {
  id: string;
  typeId: string;
  title: string;
  config: Record<string, unknown>;
  /**
   * Optional comma/semicolon/space-separated list of alert keywords. When set,
   * matching feed items get a yellow highlight ring and the column header
   * shows a badge with the match count. Purely client-side — never sent to
   * server fetchers, so it works with every plugin without per-plugin opt-in.
   */
  alertKeywords?: string;
  /**
   * Optional https webhook URL. When set together with `alertKeywords`, the
   * server POSTs a JSON payload here whenever a fetch brings in NEW items that
   * match the alert keywords. Install-private (a webhook URL often embeds a
   * secret token), so it is stored in the DB and never emitted into shared
   * deck exports / share links — see `exportDeck`.
   */
  notifyWebhookUrl?: string;
  /**
   * Optional auto-refresh cadence in seconds. When set, the column re-fetches
   * on that interval (paused while the tab is hidden so background tabs don't
   * burn upstream rate limits). When null/undefined, the column only refreshes
   * on mount and on manual click. Allowed values are whitelisted server-side
   * to {60, 300, 900, 3600}; any other input is treated as manual-only.
   */
  refreshIntervalSeconds?: number;
  /**
   * Optional comma/semicolon/space-separated include filter. When set, the
   * column shows ONLY items whose author, content, or URL matches at least one
   * term (same matcher as `alertKeywords`). Empty/unset = show everything.
   * Purely client-side — never sent to server fetchers, so it works with every
   * plugin without per-plugin opt-in. Unlike `notifyWebhookUrl` this is not a
   * secret, so it round-trips through deck export / import / share links.
   */
  filterKeywords?: string;
  /**
   * Optional comma/semicolon/space-separated exclude filter. Items matching any
   * term are hidden. Applied AFTER `filterKeywords`, so exclude wins: an item
   * that matches both an include and an exclude term is hidden. Client-side and
   * exported, same as `filterKeywords`.
   */
  excludeKeywords?: string;
  /**
   * Optional tab-group label. When at least one column in the active deck has a
   * `tabGroup`, the deck renders a tab bar above the grid: clicking a tab
   * filters the visible columns to those sharing that group. Untagged columns
   * appear under an implicit "All" tab so a half-grouped deck stays usable.
   * Bounded to 50 chars server-side. Round-trips through export / import /
   * share links (not a secret).
   */
  tabGroup?: string;
  /**
   * Optional pin flag. When true, the column is rendered before every unpinned
   * column in the deck regardless of its stored `position`. Pinned order among
   * themselves follows the same `position` ordering, so a deck with two pinned
   * columns keeps them in their relative DnD-reorder order. Round-trips through
   * export / import / share links (not a secret); a starter template can ship
   * with priority columns already pinned.
   */
  pinned?: boolean;
  /**
   * Optional 6-char hex color label (e.g. `#f97316`). When set, the column
   * renders a small color dot in the expanded header and replaces the top
   * accent gradient on the collapsed strip — letting operators apply a
   * group-level color code (DeFi orange, GitHub blue, social purple) for
   * at-a-glance deck scanning. Independent of tab groups (which hide/show)
   * and pin (which reorders): color is the "what kind of column is this"
   * marker layered on top of both. Round-trips through export / import /
   * share links (not a secret); a starter template can ship with priority
   * lanes pre-colored. Server-validated to `/^#[0-9a-f]{6}$/i` and
   * normalized to lowercase; anything that doesn't match is dropped.
   */
  color?: string;
  items: FeedItem[];
  lastFetchedAt?: string;
}

export interface Deck {
  id: string;
  name: string;
  columnIds: string[];
  /**
   * Optional 6-char hex color label (e.g. `#f97316`). When set, the deck
   * renders a colored dot in the sidebar header (replacing the brand
   * active/inactive dot) and in the deck-view top bar — letting operators
   * apply a group-level color code at the deck level for at-a-glance
   * identification across a long sidebar (markets orange, dev blue,
   * social purple, etc.). The deck-level analog of `Column.color`
   * (column color labels, PR #61). Round-trips through deck export /
   * import / share links / version-history snapshots as the optional
   * `deckColor` field of the v1 schema (additive — old exports omit it
   * and import as null). Server-validated to `/^#[0-9a-f]{6}$/i` and
   * normalized to lowercase; anything that doesn't match is dropped.
   */
  color?: string;
}
