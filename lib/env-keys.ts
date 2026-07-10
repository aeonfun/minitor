// Canonical list of user-configurable API keys exposed in the Settings dialog.
// The server actions in `app/actions.ts` use this as an allowlist — only keys
// listed here can be read or written through the UI.

export interface EnvKeySpec {
  key: string;
  label: string;
  description: string;
  signupUrl: string;
  required: boolean;
}

export const ENV_KEYS: EnvKeySpec[] = [
  {
    key: "XAI_API_KEY",
    label: "xAI (Grok)",
    description:
      "Powers X · Search, X · Trending, News · Topic, Web search, Grok-driven Instagram / LinkedIn / Facebook, and Substack keyword search.",
    signupUrl: "https://console.x.ai",
    required: true,
  },
  {
    key: "NEYNAR_API_KEY",
    label: "Neynar",
    description:
      "Farcaster column. Optional — a public demo key is used when this is unset (rate-limited but functional).",
    signupUrl: "https://neynar.com",
    required: false,
  },
  {
    key: "YOUTUBE_API_KEY",
    label: "YouTube Data API",
    description:
      "Only needed for YouTube Search mode. Channel and Playlist modes use free public Atom feeds and need no key.",
    signupUrl:
      "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
    required: false,
  },
  {
    key: "GITHUB_TOKEN",
    label: "GitHub",
    description:
      "Optional — raises every GitHub plugin's rate limit from 60 → 5000 req/hr. GitHub code search, stars, and discussions additionally require a token (GitHub auth-gates those endpoints).",
    signupUrl: "https://github.com/settings/tokens",
    required: false,
  },
  {
    key: "COINGECKO_DEMO_API_KEY",
    label: "CoinGecko (Demo)",
    description:
      "Optional — raises CoinGecko column rate limits beyond the keyless ~10–30 calls/min ceiling. Free Demo plan works.",
    signupUrl: "https://www.coingecko.com/en/developers/dashboard",
    required: false,
  },
];

export const ENV_KEY_NAMES = new Set(ENV_KEYS.map((k) => k.key));
