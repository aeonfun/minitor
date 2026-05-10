// Pure plugin manifest — single source of truth for which column types exist.
// Imports only `plugin.ts` files (no JSX, no server-only deps), so it can be
// safely evaluated on either the server or the client without crossing the
// "use client" boundary. Both registries (client UI + server fetchers) take
// their canonical id list from here.

import { meta as xSearch } from "./x-search/plugin";
import { meta as xTrending } from "./x-trending/plugin";
import { meta as newsSearch } from "./news-search/plugin";
import { meta as reddit } from "./reddit/plugin";
import { meta as hackerNews } from "./hacker-news/plugin";
import { meta as githubTrending } from "./github-trending/plugin";
import { meta as githubIssues } from "./github-issues/plugin";
import { meta as rss } from "./rss/plugin";
import { meta as googleNews } from "./google-news/plugin";
import { meta as bing } from "./bing/plugin";
import { meta as farcaster } from "./farcaster/plugin";
import { meta as mastodon } from "./mastodon/plugin";
import { meta as youtube } from "./youtube/plugin";
import { meta as weiboHot } from "./weibo-hot/plugin";
import { meta as zhihuHot } from "./zhihu-hot/plugin";
import { meta as douyinHot } from "./douyin-hot/plugin";
import { meta as bilibiliHot } from "./bilibili-hot/plugin";
import { meta as toutiao } from "./toutiao/plugin";
import { meta as baiduHot } from "./baidu-hot/plugin";
import { meta as instagram } from "./instagram/plugin";
import { meta as githubSearch } from "./github-search/plugin";
import { meta as substack } from "./substack/plugin";
import { meta as linkedin } from "./linkedin/plugin";
import { meta as facebook } from "./facebook/plugin";
import { meta as githubBacklinks } from "./github-backlinks/plugin";
import { meta as walletTx } from "./wallet-tx/plugin";
import { meta as githubPrs } from "./github-prs/plugin";
import { meta as appleReviews } from "./apple-reviews/plugin";
import { meta as playReviews } from "./play-reviews/plugin";
import { meta as githubStars } from "./github-stars/plugin";
import { meta as githubForks } from "./github-forks/plugin";
import { meta as githubReleases } from "./github-releases/plugin";
import { meta as bluesky } from "./bluesky/plugin";
import { meta as lobsters } from "./lobsters/plugin";
import { meta as polymarket } from "./polymarket/plugin";
import { meta as stackOverflow } from "./stack-overflow/plugin";
import { meta as huggingface } from "./huggingface/plugin";
import { meta as arxiv } from "./arxiv/plugin";
import { meta as devto } from "./devto/plugin";

export const PLUGIN_METAS = [
  xSearch,
  xTrending,
  newsSearch,
  reddit,
  hackerNews,
  githubTrending,
  githubIssues,
  rss,
  googleNews,
  bing,
  farcaster,
  mastodon,
  youtube,
  weiboHot,
  zhihuHot,
  douyinHot,
  bilibiliHot,
  toutiao,
  baiduHot,
  instagram,
  githubSearch,
  substack,
  linkedin,
  facebook,
  githubBacklinks,
  walletTx,
  githubPrs,
  appleReviews,
  playReviews,
  githubStars,
  githubForks,
  githubReleases,
  bluesky,
  lobsters,
  polymarket,
  stackOverflow,
  huggingface,
  arxiv,
  devto,
];

export const REGISTERED_IDS: ReadonlySet<string> = new Set(
  PLUGIN_METAS.map((m) => m.id),
);

if (PLUGIN_METAS.length !== REGISTERED_IDS.size) {
  const ids = PLUGIN_METAS.map((m) => m.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  throw new Error(`Duplicate plugin ids in manifest: ${dupes.join(", ")}`);
}
