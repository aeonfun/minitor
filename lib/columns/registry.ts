// Client-safe registry: maps each plugin id to its full UI bundle (icon,
// ConfigForm, ItemRenderer, etc.). The id list is the manifest's source of
// truth — this file just attaches the matching client.tsx export to each id.
//
// To register a new column type:
//   1. Add an entry to `lib/columns/plugins/manifest.ts`.
//   2. Add the matching `column` import + map entry below.
//   3. Add the matching `server` import + map entry in `server-registry.ts`.
// `server-registry.ts` runs a parity check at module init and will throw
// loudly if any of the three are out of sync.

import type { AnyColumnUI } from "@/lib/columns/types";
import { PLUGIN_METAS } from "@/lib/columns/plugins/manifest";

import { column as xSearch } from "@/lib/columns/plugins/x-search/client";
import { column as xTrending } from "@/lib/columns/plugins/x-trending/client";
import { column as newsSearch } from "@/lib/columns/plugins/news-search/client";
import { column as reddit } from "@/lib/columns/plugins/reddit/client";
import { column as hackerNews } from "@/lib/columns/plugins/hacker-news/client";
import { column as githubTrending } from "@/lib/columns/plugins/github-trending/client";
import { column as githubIssues } from "@/lib/columns/plugins/github-issues/client";
import { column as rss } from "@/lib/columns/plugins/rss/client";
import { column as googleNews } from "@/lib/columns/plugins/google-news/client";
import { column as bing } from "@/lib/columns/plugins/bing/client";
import { column as farcaster } from "@/lib/columns/plugins/farcaster/client";
import { column as mastodon } from "@/lib/columns/plugins/mastodon/client";
import { column as youtube } from "@/lib/columns/plugins/youtube/client";
import { column as weiboHot } from "@/lib/columns/plugins/weibo-hot/client";
import { column as zhihuHot } from "@/lib/columns/plugins/zhihu-hot/client";
import { column as douyinHot } from "@/lib/columns/plugins/douyin-hot/client";
import { column as bilibiliHot } from "@/lib/columns/plugins/bilibili-hot/client";
import { column as toutiao } from "@/lib/columns/plugins/toutiao/client";
import { column as baiduHot } from "@/lib/columns/plugins/baidu-hot/client";
import { column as instagram } from "@/lib/columns/plugins/instagram/client";
import { column as githubSearch } from "@/lib/columns/plugins/github-search/client";
import { column as substack } from "@/lib/columns/plugins/substack/client";
import { column as linkedin } from "@/lib/columns/plugins/linkedin/client";
import { column as facebook } from "@/lib/columns/plugins/facebook/client";
import { column as githubBacklinks } from "@/lib/columns/plugins/github-backlinks/client";
import { column as walletTx } from "@/lib/columns/plugins/wallet-tx/client";
import { column as githubPrs } from "@/lib/columns/plugins/github-prs/client";
import { column as appleReviews } from "@/lib/columns/plugins/apple-reviews/client";
import { column as playReviews } from "@/lib/columns/plugins/play-reviews/client";
import { column as githubStars } from "@/lib/columns/plugins/github-stars/client";
import { column as githubForks } from "@/lib/columns/plugins/github-forks/client";
import { column as githubReleases } from "@/lib/columns/plugins/github-releases/client";
import { column as bluesky } from "@/lib/columns/plugins/bluesky/client";
import { column as lobsters } from "@/lib/columns/plugins/lobsters/client";
import { column as polymarket } from "@/lib/columns/plugins/polymarket/client";
import { column as stackOverflow } from "@/lib/columns/plugins/stack-overflow/client";
import { column as huggingface } from "@/lib/columns/plugins/huggingface/client";
import { column as arxiv } from "@/lib/columns/plugins/arxiv/client";
import { column as devto } from "@/lib/columns/plugins/devto/client";
import { column as githubActions } from "@/lib/columns/plugins/github-actions/client";
import { column as npm } from "@/lib/columns/plugins/npm/client";
import { column as pypi } from "@/lib/columns/plugins/pypi/client";
import { column as crates } from "@/lib/columns/plugins/crates/client";
import { column as producthunt } from "@/lib/columns/plugins/producthunt/client";
import { column as coingecko } from "@/lib/columns/plugins/coingecko/client";
import { column as githubDiscussions } from "@/lib/columns/plugins/github-discussions/client";
import { column as defillama } from "@/lib/columns/plugins/defillama/client";
import { column as dexscreener } from "@/lib/columns/plugins/dexscreener/client";
import { column as githubCommits } from "@/lib/columns/plugins/github-commits/client";

// Keyed by id rather than positional — "use client" boundary means we can't
// read `column.id` reliably from a server context anyway, so the id has to
// come from the static key on the left.
const COLUMNS_BY_ID: Record<string, AnyColumnUI> = {
  "x-search": xSearch,
  "x-trending": xTrending,
  "news-search": newsSearch,
  reddit,
  "hacker-news": hackerNews,
  "github-trending": githubTrending,
  "github-issues": githubIssues,
  rss,
  "google-news": googleNews,
  bing,
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
  bluesky,
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
};

// Pre-built ordered list, indexed by manifest order. Built once at module init.
const ALL: AnyColumnUI[] = PLUGIN_METAS.map((m) => {
  const col = COLUMNS_BY_ID[m.id];
  if (!col) {
    throw new Error(
      `lib/columns/registry.ts is missing a UI entry for plugin "${m.id}"`,
    );
  }
  return col;
});

export function listColumnTypes(): AnyColumnUI[] {
  return ALL;
}

export function getColumnType(id: string): AnyColumnUI | undefined {
  return COLUMNS_BY_ID[id];
}
