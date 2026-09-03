import "server-only";

// LinkedIn has no public search API and the official Marketing/REST API is
// closed for this use case. We piggy-back on xAI Grok's web_search tool with a
// site:linkedin.com/posts filter, post-filtered to LinkedIn-only results.

import type { FeedItem } from "@/lib/columns/types";
import { grokWebSearch } from "@/lib/integrations/xai";

function isLinkedinUrl(u: string | undefined): boolean {
  if (!u) return false;
  try {
    const host = new URL(u).hostname.toLowerCase();
    return host === "linkedin.com" || host.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

function composeQuery(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "site:linkedin.com/posts";
  const isUrl = /^https?:\/\//i.test(trimmed);
  const term = isUrl ? `"${trimmed}"` : trimmed;
  return `site:linkedin.com/posts ${term}`;
}

export async function searchLinkedinPosts(query: string, limit = 8): Promise<FeedItem[]> {
  const composed = composeQuery(query);
  const items = await grokWebSearch(composed, limit * 2);
  return items
    .filter((i) => isLinkedinUrl(i.url))
    .map((i) => ({
      ...i,
      meta: {
        source: typeof i.author?.name === "string" && i.author.name ? i.author.name : "LinkedIn",
        isLinkedin: true,
      },
    }))
    .slice(0, limit);
}
