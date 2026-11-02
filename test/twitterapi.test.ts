import { describe, it, expect } from "vitest";
import { tweetToFeedItem, twitterCreatedAtToIso } from "@/lib/integrations/twitterapi";

describe("twitterCreatedAtToIso", () => {
  it("normalizes Twitter-native createdAt to ISO", () => {
    const iso = twitterCreatedAtToIso("Wed Sep 09 20:21:43 +0000 2026");
    expect(iso).toBe("2026-09-09T20:21:43.000Z");
  });

  it("passes through already-ISO timestamps", () => {
    expect(twitterCreatedAtToIso("2026-09-09T20:21:43.000Z")).toBe("2026-09-09T20:21:43.000Z");
  });
});

describe("tweetToFeedItem", () => {
  it("maps a twitterapi.io tweet onto a feed item", () => {
    const item = tweetToFeedItem({
      id: "123",
      text: "shipped the X column",
      url: "https://x.com/aeonframework/status/123",
      createdAt: "Wed Sep 09 20:21:43 +0000 2026",
      likeCount: 4,
      retweetCount: 1,
      replyCount: 0,
      viewCount: 90,
      author: { userName: "aeonframework", name: "aeon" },
    });
    expect(item).toMatchObject({
      id: "123",
      content: "shipped the X column",
      url: "https://x.com/aeonframework/status/123",
      createdAt: "2026-09-09T20:21:43.000Z",
      author: { name: "aeon", handle: "aeonframework" },
      meta: { likes: 4, retweets: 1, replies: 0, views: 90 },
    });
  });

  it("drops empty tweets", () => {
    expect(tweetToFeedItem({ text: "  " })).toBeNull();
  });
});
