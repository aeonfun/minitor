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
  items: FeedItem[];
  lastFetchedAt?: string;
}

export interface Deck {
  id: string;
  name: string;
  columnIds: string[];
}
