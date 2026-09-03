import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchUpstream, parseRetryAfterMs, UpstreamError } from "@/lib/integrations/fetch";

afterEach(() => vi.unstubAllGlobals());

describe("parseRetryAfterMs", () => {
  it("parses delta-seconds", () => {
    expect(parseRetryAfterMs("120")).toBe(120_000);
    expect(parseRetryAfterMs("0")).toBe(0);
  });
  it("parses an HTTP-date relative to `now`", () => {
    const now = Date.parse("2020-01-01T00:00:00Z");
    expect(parseRetryAfterMs("Wed, 01 Jan 2020 00:00:30 GMT", now)).toBe(30_000);
  });
  it("clamps a past date to 0", () => {
    const now = Date.parse("2020-01-01T00:01:00Z");
    expect(parseRetryAfterMs("Wed, 01 Jan 2020 00:00:00 GMT", now)).toBe(0);
  });
  it("returns undefined for null / garbage", () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs("soon")).toBeUndefined();
  });
});

describe("fetchUpstream", () => {
  it("returns a 2xx response on the first try", async () => {
    const mock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const res = await fetchUpstream("https://api.example.com/x");
    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("returns a non-retryable 4xx unchanged (caller handles its own message)", async () => {
    const mock = vi.fn(async () => new Response("nope", { status: 404 }));
    vi.stubGlobal("fetch", mock);
    const res = await fetchUpstream("https://api.example.com/x");
    expect(res.status).toBe(404);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("retries a transient 5xx then succeeds", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response("err", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mock);
    const res = await fetchUpstream("https://api.example.com/x");
    expect(res.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("throws a friendly rate-limit error on a terminal 429", async () => {
    const mock = vi.fn(
      async () =>
        new Response("slow down", {
          status: 429,
          headers: { "retry-after": "3600" },
        }),
    );
    vi.stubGlobal("fetch", mock);
    let err: unknown;
    try {
      await fetchUpstream("https://api.github.com/x", undefined, {
        label: "GitHub",
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(UpstreamError);
    expect((err as UpstreamError).status).toBe(429);
    expect((err as Error).message).toMatch(/rate-limited/i);
    expect((err as Error).message).toContain("GitHub");
    // A far-future Retry-After is surfaced immediately, not slept on.
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("throws an UpstreamError with isTimeout when the request outruns its timeout", async () => {
    // A fetch that only settles when its signal aborts.
    const mock = vi.fn(
      (_url: unknown, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason ?? new Error("aborted")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", mock);
    let err: unknown;
    try {
      await fetchUpstream("https://api.example.com/x", undefined, {
        timeoutMs: 25,
        retries: 0,
        label: "Example",
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(UpstreamError);
    expect((err as UpstreamError).isTimeout).toBe(true);
    expect((err as Error).message).toMatch(/timed out/i);
  });
});
