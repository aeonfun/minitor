import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchFarcasterUser, fetchFarcasterSearch } from "@/lib/integrations/farcaster";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type FCConfig, type FCMeta } from "./plugin";

// Detect "from:handle" or a bare "@handle" token and route to the user-feed
// endpoint; everything else falls through to keyword search.
const USER_PREFIX = /^(?:from:|@)([a-z0-9_.-]+)$/i;

const fetch: ServerFetcher<FCConfig, FCMeta> = async (config, cursor) => {
  const q = config.query.trim();
  if (!q) throw new Error("Search query is required.");

  const m = USER_PREFIX.exec(q);
  const items = m ? await fetchFarcasterUser(m[1], 30) : await fetchFarcasterSearch(q, 30);
  return sliceForPage(items as FeedItem<FCMeta>[], cursor);
};

export const server = defineColumnServer<FCConfig, FCMeta>({ meta, fetch });
