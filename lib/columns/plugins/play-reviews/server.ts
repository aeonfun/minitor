import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchReviews } from "@/lib/integrations/app-reviews";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type PlayReviewsConfig, type PlayReviewsItemMeta } from "./plugin";

const fetch: ServerFetcher<PlayReviewsConfig, PlayReviewsItemMeta> = async (config, cursor) => {
  const appId = config.appId.trim();
  if (!appId) throw new Error("Google Play package ID is required.");
  const country = (config.country.trim() || "us").toLowerCase();
  const items = (await fetchReviews(
    "google-play",
    appId,
    country,
  )) as FeedItem<PlayReviewsItemMeta>[];
  items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<PlayReviewsConfig, PlayReviewsItemMeta>({
  meta,
  fetch,
});
