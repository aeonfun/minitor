import { describe, it, expect, beforeEach } from "vitest";
import {
  cacheKeyFor,
  cachedColumnFetch,
  ttlForMeta,
  DEFAULT_TTL_MS,
  MAX_TTL_MS,
  __resetFetchCache,
} from "@/lib/columns/fetch-cache";
import type { PageResult } from "@/lib/columns/types";

const page = (id: string): PageResult => ({
  items: [
    {
      id,
      author: { name: "a" },
      content: id,
      createdAt: new Date(0).toISOString(),
    },
  ],
});

beforeEach(() => __resetFetchCache());

describe("cacheKeyFor", () => {
  it("is stable regardless of config key order", () => {
    const a = cacheKeyFor("reddit", { sub: "rust", sort: "hot" });
    const b = cacheKeyFor("reddit", { sort: "hot", sub: "rust" });
    expect(a).toBe(b);
  });
  it("distinguishes type, cursor, and config value", () => {
    const base = cacheKeyFor("reddit", { sub: "rust" });
    expect(cacheKeyFor("hn", { sub: "rust" })).not.toBe(base);
    expect(cacheKeyFor("reddit", { sub: "go" })).not.toBe(base);
    expect(cacheKeyFor("reddit", { sub: "rust" }, "cursor2")).not.toBe(base);
  });
});

describe("ttlForMeta", () => {
  it("falls back to the default when no hint is set", () => {
    expect(ttlForMeta({ capabilities: undefined })).toBe(DEFAULT_TTL_MS);
    expect(ttlForMeta({ capabilities: {} })).toBe(DEFAULT_TTL_MS);
  });
  it("uses a positive hint, clamped to the ceiling", () => {
    expect(ttlForMeta({ capabilities: { refreshIntervalHintMs: 5_000 } })).toBe(5_000);
    expect(ttlForMeta({ capabilities: { refreshIntervalHintMs: 10_000_000 } })).toBe(MAX_TTL_MS);
  });
});

describe("cachedColumnFetch — coalescing", () => {
  it("collapses concurrent identical requests into one producer call", async () => {
    let calls = 0;
    let resolve!: (v: PageResult) => void;
    const gate = new Promise<PageResult>((r) => (resolve = r));
    const producer = () => {
      calls++;
      return gate;
    };

    const p1 = cachedColumnFetch("k", DEFAULT_TTL_MS, producer);
    const p2 = cachedColumnFetch("k", DEFAULT_TTL_MS, producer);
    resolve(page("x"));
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(calls).toBe(1);
    expect(r1).toBe(r2); // same shared result object
  });

  it("serves a fresh cached result without re-invoking the producer", async () => {
    let calls = 0;
    const producer = async () => {
      calls++;
      return page(`v${calls}`);
    };
    const first = await cachedColumnFetch("k", DEFAULT_TTL_MS, producer);
    const second = await cachedColumnFetch("k", DEFAULT_TTL_MS, producer);
    expect(calls).toBe(1);
    expect(second).toBe(first);
  });

  it("re-fetches once the TTL has elapsed", async () => {
    let calls = 0;
    const producer = async () => {
      calls++;
      return page(`v${calls}`);
    };
    await cachedColumnFetch("k", 1, producer);
    await new Promise((r) => setTimeout(r, 5));
    await cachedColumnFetch("k", 1, producer);
    expect(calls).toBe(2);
  });

  it("never caches a rejected producer (next call retries)", async () => {
    let calls = 0;
    const producer = async () => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return page("ok");
    };
    await expect(cachedColumnFetch("k", DEFAULT_TTL_MS, producer)).rejects.toThrow("boom");
    const res = await cachedColumnFetch("k", DEFAULT_TTL_MS, producer);
    expect(calls).toBe(2);
    expect(res.items[0].id).toBe("ok");
  });

  it("does not cache when ttl is 0, but still coalesces in flight", async () => {
    let calls = 0;
    const producer = async () => {
      calls++;
      return page(`v${calls}`);
    };
    await cachedColumnFetch("k", 0, producer);
    await cachedColumnFetch("k", 0, producer);
    expect(calls).toBe(2);
  });
});
