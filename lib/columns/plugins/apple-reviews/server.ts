import "server-only";

import { defineColumnServer, type FeedItem, type ServerFetcher } from "@/lib/columns/types";
import { fetchReviews } from "@/lib/integrations/app-reviews";
import { sliceForPage } from "@/lib/columns/paginate";
import { meta, type AppleReviewsConfig, type AppleReviewsItemMeta } from "./plugin";

const fetch: ServerFetcher<AppleReviewsConfig, AppleReviewsItemMeta> = async (config, cursor) => {
  const appId = config.appId.trim();
  if (!appId) throw new Error("App Store numeric ID is required.");
  const country = (config.country.trim() || "us").toLowerCase();
  const items = (await fetchReviews(
    "app-store",
    appId,
    country,
  )) as FeedItem<AppleReviewsItemMeta>[];
  items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return sliceForPage(items, cursor);
};

export const server = defineColumnServer<AppleReviewsConfig, AppleReviewsItemMeta>({
  meta,
  fetch,
});
