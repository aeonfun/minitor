import "server-only";

// Per-publication RSS via lib/integrations/rss.ts. Substack's discover/search
// API (substack.com/api/v1/post/search) returns empty results without auth, so
// the user picks one or more handles and we filter their feeds in-memory.

import { defineColumnServer, type ServerFetcher } from "@/lib/columns/types";
import {
  parseHandles,
  searchSubstackByKeyword,
  searchSubstackPublications,
} from "@/lib/integrations/substack";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type SubstackConfig, type SubstackMeta } from "./plugin";

const fetch: ServerFetcher<SubstackConfig, SubstackMeta> = async (config, cursor) => {
  const handles = parseHandles(config.handles);
  const query = config.query.trim();

  // Keyword-only mode: no publications, fall back to xAI Grok web_search
  // filtered to site:substack.com.
  if (handles.length === 0) {
    if (!query) return { items: [] };
    const items = await searchSubstackByKeyword(query, 50);
    return sliceForPage(items, cursor);
  }

  const items = await searchSubstackPublications(handles, config.query, 20, 100);
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<SubstackConfig, SubstackMeta>({
  meta,
  fetch,
});
