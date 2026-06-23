import "server-only";

import {
  defineColumnServer,
  type FeedItem,
  type ServerFetcher,
} from "@/lib/columns/types";
import {
  fetchYouTube,
  fetchSearchPage as fetchYouTubeSearchPage,
} from "@/lib/integrations/youtube";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type YTConfig, type YTMeta } from "./plugin";

const fetch: ServerFetcher<YTConfig, YTMeta> = async (config, cursor) => {
  if (config.mode === "search") {
    if (!config.query.trim()) throw new Error("Search query is required.");
    const r = await fetchYouTubeSearchPage(
      config.query,
      config.order,
      PAGE_SIZE,
      cursor,
    );
    return {
      items: r.items as FeedItem<YTMeta>[],
      nextCursor: r.nextPageToken,
    };
  }
  if (config.mode === "channel" && !config.channel.trim())
    throw new Error("Channel handle or ID is required.");
  if (config.mode === "playlist" && !config.playlist.trim())
    throw new Error("Playlist ID is required.");
  const items = (await fetchYouTube(config.mode, {
    query: config.query,
    order: config.order,
    channel: config.channel,
    playlist: config.playlist,
  })) as FeedItem<YTMeta>[];
  return { items };
};

export const server = defineColumnServer<YTConfig, YTMeta>({ meta, fetch });
