import "server-only";

import type { FeedItem } from "@/lib/columns/types";
import { grokWebSearch } from "./xai";

// Instagram has no public hashtag/keyword search — Graph API requires per-user
// OAuth + Business/Creator accounts (locked down 2018). This module wraps
// grokWebSearch with a site:instagram.com filter as the default fetcher.
//
// To swap in a paid scraper later (Apify / Bright Data / Phantombuster /
// RapidAPI), replace the body of `fetchInstagram` and update the plugin's
// `capabilities.requiresEnv`. The signature is the seam — callers don't care
// which backend produced the items.
export async function fetchInstagram(query: string, limit = 10): Promise<FeedItem[]> {
  const q = query.trim();
  if (!q) return [];
  const isUrl = /^https?:\/\//i.test(q);
  const filter = isUrl ? `site:instagram.com ${JSON.stringify(q)}` : `site:instagram.com ${q}`;
  return grokWebSearch(filter, limit);
}
