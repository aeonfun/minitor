import { describe, it, expect } from "vitest";
import {
  parseAlertKeywords,
  itemMatchesAlertKeywords,
  itemMatchesSearchQuery,
  matchedAlertKeywords,
} from "@/lib/columns/keyword-match";
import type { FeedItem } from "@/lib/columns/types";

const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  id: "1",
  author: { name: "Ada Lovelace", handle: "ada" },
  content: "Shipping a new Rust release with Tokio async runtime",
  url: "https://example.com/rust-release",
  createdAt: new Date(0).toISOString(),
  ...over,
});

describe("parseAlertKeywords", () => {
  it("splits on commas, semicolons, and whitespace and lowercases", () => {
    expect(parseAlertKeywords("Rust, Tokio; async  runtime")).toEqual([
      "rust",
      "tokio",
      "async",
      "runtime",
    ]);
  });
  it("dedupes case-insensitively and preserves first-seen order", () => {
    expect(parseAlertKeywords("Rust rust RUST tokio")).toEqual(["rust", "tokio"]);
  });
  it("drops empty and over-long terms", () => {
    expect(parseAlertKeywords("  ,;  ")).toEqual([]);
    expect(parseAlertKeywords("x".repeat(65))).toEqual([]);
  });
  it("caps at 16 terms", () => {
    const many = Array.from({ length: 30 }, (_, i) => `t${i}`).join(" ");
    expect(parseAlertKeywords(many)).toHaveLength(16);
  });
  it("returns [] for null / undefined / empty", () => {
    expect(parseAlertKeywords(null)).toEqual([]);
    expect(parseAlertKeywords(undefined)).toEqual([]);
    expect(parseAlertKeywords("")).toEqual([]);
  });
});

describe("itemMatchesAlertKeywords", () => {
  const terms = parseAlertKeywords("tokio, python");
  it("matches when a term appears in content", () => {
    expect(itemMatchesAlertKeywords(item(), terms)).toBe(true);
  });
  it("matches against author handle", () => {
    expect(
      itemMatchesAlertKeywords(
        item({ content: "no match here", author: { name: "x", handle: "tokio" } }),
        terms,
      ),
    ).toBe(true);
  });
  it("matches against the URL", () => {
    expect(
      itemMatchesAlertKeywords(
        item({ content: "nope", url: "https://python.org", author: { name: "x" } }),
        terms,
      ),
    ).toBe(true);
  });
  it("does not match when no term is present", () => {
    expect(
      itemMatchesAlertKeywords(
        item({ content: "golang only", url: "", author: { name: "x" } }),
        terms,
      ),
    ).toBe(false);
  });
  it("empty term list never matches", () => {
    expect(itemMatchesAlertKeywords(item(), [])).toBe(false);
  });
});

describe("matchedAlertKeywords", () => {
  it("returns exactly the terms that fired, in order", () => {
    const terms = parseAlertKeywords("rust, tokio, python");
    expect(matchedAlertKeywords(item(), terms)).toEqual(["rust", "tokio"]);
  });
});

describe("itemMatchesSearchQuery", () => {
  it("does a case-insensitive substring (phrase) match", () => {
    expect(itemMatchesSearchQuery(item(), "async runtime")).toBe(true);
    expect(itemMatchesSearchQuery(item(), "ASYNC")).toBe(true);
  });
  it("is a literal phrase, not OR-split like keywords", () => {
    expect(itemMatchesSearchQuery(item(), "rust python")).toBe(false);
  });
  it("empty query never matches", () => {
    expect(itemMatchesSearchQuery(item(), "   ")).toBe(false);
  });
});
