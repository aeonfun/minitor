// Starter deck templates — pre-baked DeckExport v1 payloads operators can
// import in two clicks. Templates use the SAME schema as Export/Import/Share
// so there's no separate validation path: the existing `importDeck` server
// action runs them through Zod just like a manually-pasted JSON.
//
// Adding a template:
//   1. Append an entry to TEMPLATES with a unique id and a payload that
//      validates against the deck-export schema (version: 1).
//   2. Use plugin defaults where possible — columns whose config is "live
//      data with no required field" (HN top, arXiv cs.AI, GitHub trending)
//      work the moment the deck is imported. Columns with REQUIRED fields
//      (wallet-tx address, github-stars repo, x-search query) need a
//      sensible default that the operator can edit later.
//   3. Keep deck names ≤ 128 chars and column counts ≤ 64 (server-side
//      schema caps both).
//
// Why TS not JSON files:
//   - Single source of truth for both UI metadata (name/description/accent)
//     and the payload itself.
//   - The bundler tree-shakes unused fields; templates rarely change so
//     there's no value in a network round-trip to /templates/<id>.json.
//   - Imports stay synchronous — no fetch failure modes for the gallery UI.

export const DECK_TEMPLATE_VERSION = 1;

export interface DeckTemplateColumn {
  typeId: string;
  title: string;
  config: Record<string, unknown>;
  alertKeywords?: string;
  // Optional auto-refresh cadence in seconds. When set, the column re-fetches
  // on this cadence after import. Allowed values are whitelisted server-side
  // to {60, 300, 900, 3600}; anything else is dropped during importDeck.
  refreshIntervalSeconds?: number;
  // Optional include/exclude item filters (comma/space-separated). Let a
  // starter template ship a pre-focused column — e.g. a security feed that
  // only surfaces items mentioning "CVE". Round-trip through importDeck.
  filterKeywords?: string;
  excludeKeywords?: string;
  // Optional tab-group label. Let a multi-category starter deck ship pre-grouped
  // (e.g. "DeFi" / "Social" / "Dev") so the tab bar renders on first import
  // instead of forcing the operator to label each column by hand. Round-trips
  // through importDeck — same TAB_GROUP_MAX cap, same whitespace normalization.
  tabGroup?: string;
  // Optional pin flag. Let a starter template ship with a priority column (e.g.
  // the project's main GitHub repo, or a token price column) already pinned to
  // the front of the deck so it stays visible regardless of active tab and DnD
  // reorder. Round-trips through importDeck.
  pinned?: boolean;
  // Optional color label (6-char hex `#rrggbb`). Let a multi-category starter
  // deck ship with pre-colored lanes (e.g. orange for DeFi, blue for repos,
  // purple for social) so the visual grouping is immediate on first import.
  // Round-trips through importDeck — re-validated against the same hex regex
  // and dropped if it doesn't match.
  color?: string;
}

export interface DeckTemplatePayload {
  version: typeof DECK_TEMPLATE_VERSION;
  deckName: string;
  // Optional deck-level color label (6-char hex `#rrggbb`). Let a multi-category
  // starter template ship pre-tagged with a deck-identity color (e.g. the
  // markets pack ships orange, the dev pack ships blue) so the sidebar dot
  // is meaningful from first import. Round-trips through importDeck — the
  // same hex normalizer used for the per-column color drops it to null if
  // the template ships a malformed value, never aborts the import.
  deckColor?: string;
  columns: DeckTemplateColumn[];
}

export interface DeckTemplate {
  id: string;
  name: string;
  // One-line pitch shown on the template card.
  tagline: string;
  // Two-or-three sentence description shown on hover/expanded card.
  description: string;
  // Brand accent colour for the card chip. Mirrors a plugin colour so the
  // template feels at home with the columns it ships.
  accent: string;
  // Lucide icon name — resolved on the consumer side so we don't pull every
  // lucide module into this file. Pick something that visually echoes the
  // template's domain.
  iconName: "Sparkles" | "Layers" | "TrendingUp" | "Rocket";
  payload: DeckTemplatePayload;
}

// -----------------------------------------------------------------------------
// AI Research
// HN top + arXiv cs.AI + GitHub trending Python + Hugging Face trending models
// + X search for "AI". All five run keyless EXCEPT x-search, which needs
// XAI_API_KEY — the operator gets a one-off "missing key" toast on first fetch
// and can either add the key or remove the column. Including it anyway because
// the template's point is "what a research dashboard should look like" — every
// AI-research user wants X coverage.
// -----------------------------------------------------------------------------

const aiResearch: DeckTemplate = {
  id: "ai-research",
  name: "AI Research",
  tagline: "HN, arXiv, GitHub, Hugging Face, X",
  description:
    "A working starting deck for AI researchers and tinkerers. Front-page HN, newest arXiv cs.AI submissions, this-week GitHub trending in Python, Hugging Face trending models, and an X feed for the term 'AI'.",
  accent: "#FFD21F",
  iconName: "Sparkles",
  payload: {
    version: DECK_TEMPLATE_VERSION,
    deckName: "AI Research",
    columns: [
      {
        typeId: "hacker-news",
        title: "HN · Front page",
        config: { mode: "top", query: "" },
      },
      {
        typeId: "arxiv",
        title: "arXiv · cs.AI · Newest",
        config: { category: "cs.AI", mode: "recent", search: "" },
      },
      {
        typeId: "github-trending",
        title: "Trending · Python · this week",
        config: { language: "Python", period: "week" },
      },
      {
        typeId: "huggingface",
        title: "HF · Trending models",
        config: { resource: "models", mode: "trending", search: "" },
      },
      {
        typeId: "x-search",
        title: "X · AI",
        config: { query: "AI lang:en min_faves:50" },
      },
    ],
  },
};

// -----------------------------------------------------------------------------
// Base Ecosystem
// GitHub stars for aaronjmars/aeon + aaronjmars/aeon-agent + CoinGecko AEON
// watchlist + DeFiLlama top (operator filters category to Base) + X search
// for "@aeonframework". No wallet-tx — it requires a wallet address per row
// and a one-click template can't pick one for the operator.
// -----------------------------------------------------------------------------

const baseEcosystem: DeckTemplate = {
  id: "base-ecosystem",
  name: "Base Ecosystem",
  tagline: "Aeon repos + AEON price + DeFiLlama + X",
  description:
    "Tracks the Aeon project + the Base on-chain stack. Two GitHub-stars columns for aeon and aeon-agent, a CoinGecko watchlist with $AEON, a Dexscreener feed of every $AEON pair, the DeFiLlama protocol leaderboard, and the X feed for @aeonframework.",
  accent: "#445ed0",
  iconName: "Layers",
  payload: {
    version: DECK_TEMPLATE_VERSION,
    deckName: "Base Ecosystem",
    columns: [
      {
        typeId: "github-stars",
        title: "Stars · aaronjmars/aeon",
        config: { repo: "aaronjmars/aeon" },
      },
      {
        typeId: "github-stars",
        title: "Stars · aaronjmars/aeon-agent",
        config: { repo: "aaronjmars/aeon-agent" },
      },
      {
        typeId: "coingecko",
        title: "CoinGecko · Watchlist",
        config: { mode: "watchlist", watchlist: "aeon" },
      },
      {
        typeId: "dexscreener",
        title: "Dexscreener · $AEON",
        config: {
          mode: "watchlist",
          watchlist: "0xbf8e8f0e8866a7052f948c16508644347c57aba3",
        },
      },
      {
        typeId: "defillama",
        title: "DeFiLlama · Top protocols",
        config: { mode: "top", category: "" },
      },
      {
        typeId: "x-search",
        title: "X · @aeonframework",
        config: { query: "@aeonframework OR $AEON" },
      },
    ],
  },
};

// -----------------------------------------------------------------------------
// Crypto DeFi
// DeFiLlama 24h gainers + Polymarket trending + CoinGecko top-by-market-cap
// + X search for DeFi. Pairs the on-chain TVL flows (DeFiLlama) with the price
// + narrative layer (CoinGecko, X) and the prediction-market reference
// (Polymarket). All four are keyless except x-search.
// -----------------------------------------------------------------------------

const cryptoDefi: DeckTemplate = {
  id: "crypto-defi",
  name: "Crypto DeFi",
  tagline: "DeFiLlama, CoinGecko, Polymarket, X",
  description:
    "DeFi-focused starting deck. DeFiLlama's 24h biggest TVL movers, CoinGecko's top-by-market-cap leaderboard, Polymarket trending markets, and an X feed for the term 'DeFi'.",
  accent: "#8DC647",
  iconName: "TrendingUp",
  payload: {
    version: DECK_TEMPLATE_VERSION,
    deckName: "Crypto DeFi",
    columns: [
      {
        typeId: "defillama",
        title: "DeFiLlama · 24h gainers",
        config: { mode: "gainers", category: "" },
      },
      {
        typeId: "coingecko",
        title: "CoinGecko · Top by market cap",
        config: { mode: "top", watchlist: "" },
      },
      {
        typeId: "polymarket",
        title: "Polymarket · Trending",
        config: { mode: "trending", tag: "" },
      },
      {
        typeId: "x-search",
        title: "X · DeFi",
        config: { query: "DeFi OR defi lang:en min_faves:50" },
      },
    ],
  },
};

// -----------------------------------------------------------------------------
// Startup Tracker
// GitHub trending + Product Hunt today + HN Show + DEV.to top week + Reddit
// r/startups. All five are keyless, which makes this the lowest-friction
// template — a brand-new install can land on this and have a fully-working
// deck without setting a single env var.
// -----------------------------------------------------------------------------

const startupTracker: DeckTemplate = {
  id: "startup-tracker",
  name: "Startup Tracker",
  tagline: "GitHub, PH, Show HN, DEV.to, r/startups",
  description:
    "The 'what's new in startup-land' deck. GitHub trending all-languages-this-week, Product Hunt today, Show HN, DEV.to top of the week, and the r/startups subreddit. Fully keyless — every column works out of the box.",
  accent: "#DA552F",
  iconName: "Rocket",
  payload: {
    version: DECK_TEMPLATE_VERSION,
    deckName: "Startup Tracker",
    columns: [
      {
        typeId: "github-trending",
        title: "Trending · this week",
        config: { language: "", period: "week" },
      },
      {
        typeId: "producthunt",
        title: "Product Hunt · Today",
        config: { mode: "today", topic: "" },
      },
      {
        typeId: "hacker-news",
        title: "Show HN",
        config: { mode: "show", query: "" },
      },
      {
        typeId: "devto",
        title: "DEV · Top week",
        config: { mode: "top", tag: "" },
      },
      {
        typeId: "reddit",
        title: "r/startups",
        config: { subreddit: "startups", sortBy: "hot" },
      },
    ],
  },
};

export const TEMPLATES: DeckTemplate[] = [
  aiResearch,
  baseEcosystem,
  cryptoDefi,
  startupTracker,
];

export function getTemplate(id: string): DeckTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * Serialize a template's payload as a JSON string compatible with the
 * `importDeck` server action. The string is what we hand to the same import
 * path used by JSON-paste and share-link imports — no template-specific server
 * route, no template-specific validation. If the schema ever changes, the
 * server-side Zod check catches it at import time and the toast surfaces the
 * exact failure to the operator.
 */
export function templateAsImportJson(template: DeckTemplate): string {
  return JSON.stringify({
    ...template.payload,
    exportedAt: new Date().toISOString(),
  });
}
