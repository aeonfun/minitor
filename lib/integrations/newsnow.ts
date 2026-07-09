import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import { identiconUrl, truncateText } from "@/lib/utils";

// NewsNow public aggregator — used by TrendRadar / MindSpider.
// No auth, but Cloudflare-fronted so it requires a real browser User-Agent.
const BASE = "https://newsnow.busiyi.world";

export type NewsNowPlatform =
  | "weibo"
  | "zhihu"
  | "douyin"
  | "bilibili-hot-search"
  | "toutiao"
  | "baidu";

export const PLATFORM_LABELS: Record<NewsNowPlatform, string> = {
  weibo: "Weibo · Hot search",
  zhihu: "Zhihu · Hot",
  douyin: "Douyin · Hot",
  "bilibili-hot-search": "Bilibili · Hot search",
  toutiao: "Toutiao",
  baidu: "Baidu · Hot search",
};

interface NewsNowItem {
  id?: string;
  title?: string;
  url?: string;
  mobileUrl?: string;
  extra?: {
    info?: string;
    hover?: string;
    icon?: string;
  };
}

interface NewsNowResponse {
  status?: string;
  id?: string;
  updatedTime?: number;
  items?: NewsNowItem[];
  message?: string;
}

export async function fetchNewsNow(
  platform: NewsNowPlatform,
  limit = 20,
): Promise<FeedItem[]> {
  const res = await fetchUpstream(
    `${BASE}/api/s?id=${encodeURIComponent(platform)}&latest`,
    {
      headers: {
        // Cloudflare blocks default fetch UAs.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        accept: "application/json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(
      `NewsNow ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as NewsNowResponse;
  if (json.message && !json.items) {
    throw new Error(`NewsNow: ${json.message}`);
  }
  const updatedAt = json.updatedTime
    ? new Date(json.updatedTime).toISOString()
    : new Date().toISOString();
  const platformLabel = PLATFORM_LABELS[platform];
  const items = json.items ?? [];

  return items.slice(0, limit).map((it, idx) => {
    const url = it.url ?? it.mobileUrl ?? "";
    const title = (it.title ?? "").trim();
    const info = (it.extra?.info ?? "").trim();
    const hover = (it.extra?.hover ?? "").trim();
    const description = info && hover ? `${info} · ${hover}` : info || hover;
    const trimmed = truncateText(description, 280);
    return {
      id: it.id ?? `${platform}-${idx}`,
      author: {
        name: platformLabel,
        handle: platform,
        avatarUrl: identiconUrl(platform),
      },
      content: trimmed ? `${title}\n\n${trimmed}` : title,
      url,
      createdAt: updatedAt,
      meta: {
        kind: "newsnow",
        platform,
        platformLabel,
        rank: idx + 1,
        info: info || undefined,
      },
    } satisfies FeedItem;
  });
}
