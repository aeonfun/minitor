import { describe, it, expect } from "vitest";
import { validateWebhookUrl, WEBHOOK_URL_MAX } from "@/lib/columns/webhook";

// `validateWebhookUrl` is the SSRF gate for the alert-webhook feature: it is the
// only thing stopping the server from being coerced into POSTing to internal
// addresses. Its failure mode is silent and security-relevant, so it gets the
// most thorough coverage in the suite.

describe("validateWebhookUrl — accepts", () => {
  it("a plain https public URL, returning the normalized form", () => {
    const res = validateWebhookUrl("https://hooks.example.com/abc?tok=123");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.url).toBe("https://hooks.example.com/abc?tok=123");
  });

  it("a public IPv4 literal over https", () => {
    expect(validateWebhookUrl("https://8.8.8.8/path").ok).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const res = validateWebhookUrl("  https://example.com/hook  ");
    expect(res.ok).toBe(true);
  });
});

describe("validateWebhookUrl — rejects", () => {
  const rejected: [string, string][] = [
    ["", "empty"],
    ["not a url", "garbage"],
    ["http://example.com/hook", "http (not https)"],
    ["ftp://example.com", "non-http scheme"],
    ["https://localhost/hook", "localhost"],
    ["https://sub.localhost/hook", "*.localhost"],
    ["https://ip6-localhost/hook", "ip6-localhost"],
    ["https://127.0.0.1/hook", "loopback v4"],
    ["https://0.0.0.0/hook", "this-network"],
    ["https://10.1.2.3/hook", "10/8 private"],
    ["https://172.16.5.4/hook", "172.16/12 private"],
    ["https://172.31.255.1/hook", "172.31 private"],
    ["https://192.168.0.1/hook", "192.168/16 private"],
    ["https://169.254.1.1/hook", "link-local"],
    ["https://100.64.0.1/hook", "CGNAT"],
    ["https://224.0.0.1/hook", "multicast"],
    ["https://[::1]/hook", "IPv6 loopback"],
    ["https://[fc00::1]/hook", "IPv6 unique-local fc"],
    ["https://[fd12:3456::1]/hook", "IPv6 unique-local fd"],
    ["https://[fe80::1]/hook", "IPv6 link-local"],
    ["https://[::ffff:10.0.0.1]/hook", "IPv4-mapped private"],
  ];
  for (const [url, why] of rejected) {
    it(`${why}: ${url || "(empty)"}`, () => {
      expect(validateWebhookUrl(url).ok).toBe(false);
    });
  }

  it("a URL longer than the max length", () => {
    const long = `https://example.com/${"a".repeat(WEBHOOK_URL_MAX)}`;
    expect(validateWebhookUrl(long).ok).toBe(false);
  });

  it("172.15 and 172.32 are public (just outside the private block)", () => {
    expect(validateWebhookUrl("https://172.15.0.1/x").ok).toBe(true);
    expect(validateWebhookUrl("https://172.32.0.1/x").ok).toBe(true);
  });
});
