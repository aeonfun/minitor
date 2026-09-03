import "server-only";

import { defineColumnServer, type ServerFetcher } from "@/lib/columns/types";
import { fetchLobstersPage } from "@/lib/integrations/lobsters";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type LobstersConfig, type LobstersMeta } from "./plugin";

const fetch: ServerFetcher<LobstersConfig, LobstersMeta> = async (config, cursor) => {
  const page = cursor ? Number(cursor) || 0 : 0;
  // Tag mode requires a tag — fall back to hottest if the user picked tag
  // without filling one in, so the column always renders something rather
  // than throwing a 404 from /t/.json.
  const effectiveMode = config.mode === "tag" && !config.tag.trim() ? "hottest" : config.mode;
  const r = await fetchLobstersPage(effectiveMode, config.tag, PAGE_SIZE, page);
  return {
    items: r.items,
    nextCursor: r.hasMore ? String(page + 1) : undefined,
  };
};

export const server = defineColumnServer<LobstersConfig, LobstersMeta>({
  meta,
  fetch,
});
