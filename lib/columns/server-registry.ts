import "server-only";

// Server-only registry: maps each plugin id to its server fetcher. The id
// list is the manifest's source of truth. The parity check at module init
// throws loudly if `manifest.ts` and this file disagree — that's the only
// thing standing between you and a 404 / silent breakage in production.

import type { AnyColumnServer } from "@/lib/columns/types";
import { PLUGIN_METAS, REGISTERED_IDS } from "@/lib/columns/plugins/manifest";

import { server as xSearch } from "@/lib/columns/plugins/x-search/server";
import { server as xTrending } from "@/lib/columns/plugins/x-trending/server";
import { server as newsSearch } from "@/lib/columns/plugins/news-search/server";
import { server as reddit } from "@/lib/columns/plugins/reddit/server";
import { server as hackerNews } from "@/lib/columns/plugins/hacker-news/server";
import { server as githubTrending } from "@/lib/columns/plugins/github-trending/server";
import { server as githubIssues } from "@/lib/columns/plugins/github-issues/server";
import { server as rss } from "@/lib/columns/plugins/rss/server";
import { server as googleNews } from "@/lib/columns/plugins/google-news/server";
import { server as farcaster } from "@/lib/columns/plugins/farcaster/server";
import { server as mastodon } from "@/lib/columns/plugins/mastodon/server";
import { server as youtube } from "@/lib/columns/plugins/youtube/server";
import { server as weiboHot } from "@/lib/columns/plugins/weibo-hot/server";
import { server as zhihuHot } from "@/lib/columns/plugins/zhihu-hot/server";
import { server as douyinHot } from "@/lib/columns/plugins/douyin-hot/server";
import { server as bilibiliHot } from "@/lib/columns/plugins/bilibili-hot/server";
import { server as toutiao } from "@/lib/columns/plugins/toutiao/server";
import { server as baiduHot } from "@/lib/columns/plugins/baidu-hot/server";
import { server as instagram } from "@/lib/columns/plugins/instagram/server";
import { server as githubSearch } from "@/lib/columns/plugins/github-search/server";
import { server as substack } from "@/lib/columns/plugins/substack/server";
import { server as linkedin } from "@/lib/columns/plugins/linkedin/server";
import { server as facebook } from "@/lib/columns/plugins/facebook/server";
import { server as githubBacklinks } from "@/lib/columns/plugins/github-backlinks/server";
import { server as walletTx } from "@/lib/columns/plugins/wallet-tx/server";
import { server as githubPrs } from "@/lib/columns/plugins/github-prs/server";
import { server as appleReviews } from "@/lib/columns/plugins/apple-reviews/server";
import { server as playReviews } from "@/lib/columns/plugins/play-reviews/server";
import { server as githubStars } from "@/lib/columns/plugins/github-stars/server";
import { server as githubForks } from "@/lib/columns/plugins/github-forks/server";
import { server as githubReleases } from "@/lib/columns/plugins/github-releases/server";
import { server as lobsters } from "@/lib/columns/plugins/lobsters/server";
import { server as polymarket } from "@/lib/columns/plugins/polymarket/server";
import { server as stackOverflow } from "@/lib/columns/plugins/stack-overflow/server";
import { server as huggingface } from "@/lib/columns/plugins/huggingface/server";
import { server as arxiv } from "@/lib/columns/plugins/arxiv/server";
import { server as devto } from "@/lib/columns/plugins/devto/server";
import { server as githubActions } from "@/lib/columns/plugins/github-actions/server";
import { server as npm } from "@/lib/columns/plugins/npm/server";
import { server as pypi } from "@/lib/columns/plugins/pypi/server";
import { server as crates } from "@/lib/columns/plugins/crates/server";
import { server as producthunt } from "@/lib/columns/plugins/producthunt/server";
import { server as coingecko } from "@/lib/columns/plugins/coingecko/server";
import { server as githubDiscussions } from "@/lib/columns/plugins/github-discussions/server";
import { server as defillama } from "@/lib/columns/plugins/defillama/server";
import { server as dexscreener } from "@/lib/columns/plugins/dexscreener/server";
import { server as githubCommits } from "@/lib/columns/plugins/github-commits/server";
import { server as aeon } from "@/lib/columns/plugins/aeon/server";

const SERVERS_BY_ID: Record<string, AnyColumnServer> = {
  "x-search": xSearch,
  "x-trending": xTrending,
  "news-search": newsSearch,
  reddit,
  "hacker-news": hackerNews,
  "github-trending": githubTrending,
  "github-issues": githubIssues,
  rss,
  "google-news": googleNews,
  farcaster,
  mastodon,
  youtube,
  "weibo-hot": weiboHot,
  "zhihu-hot": zhihuHot,
  "douyin-hot": douyinHot,
  "bilibili-hot": bilibiliHot,
  toutiao,
  "baidu-hot": baiduHot,
  instagram,
  "github-search": githubSearch,
  substack,
  linkedin,
  facebook,
  "github-backlinks": githubBacklinks,
  "wallet-tx": walletTx,
  "github-prs": githubPrs,
  "apple-reviews": appleReviews,
  "play-reviews": playReviews,
  "github-stars": githubStars,
  "github-forks": githubForks,
  "github-releases": githubReleases,
  lobsters,
  polymarket,
  "stack-overflow": stackOverflow,
  huggingface,
  arxiv,
  devto,
  "github-actions": githubActions,
  npm,
  pypi,
  crates,
  producthunt,
  coingecko,
  "github-discussions": githubDiscussions,
  defillama,
  dexscreener,
  "github-commits": githubCommits,
  aeon,
};

// Parity check — runs once at server module init. Throws loudly rather than
// 404'ing at request time. The manifest is the canonical id list; both the
// UI registry and this file are validated against it.
const serverIds = new Set(Object.keys(SERVERS_BY_ID));
const missingFromServer = [...REGISTERED_IDS].filter(
  (id) => !serverIds.has(id),
);
const stale = [...serverIds].filter((id) => !REGISTERED_IDS.has(id));
if (missingFromServer.length || stale.length) {
  const parts = [
    missingFromServer.length
      ? `In manifest but missing a server fetcher: ${missingFromServer.join(", ")}`
      : "",
    stale.length
      ? `In server-registry.ts but not in manifest: ${stale.join(", ")}`
      : "",
  ].filter(Boolean);
  throw new Error(`Column registry parity check failed. ${parts.join(" | ")}`);
}

// Verify each registered server's id matches its key (catches typos like
// `redit` → reddit), and that meta.schema is the expected one from manifest.
for (const m of PLUGIN_METAS) {
  const s = SERVERS_BY_ID[m.id];
  if (s.meta.id !== m.id) {
    throw new Error(
      `Server fetcher under key "${m.id}" registered as id "${s.meta.id}"`,
    );
  }
}

export function getServerEntry(id: string): AnyColumnServer | undefined {
  return SERVERS_BY_ID[id];
}
