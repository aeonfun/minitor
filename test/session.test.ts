import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  sanitizeNext,
  SESSION_TTL_MS,
} from "@/lib/auth/session";

// The session token is the whole hosted login gate: a bad verify either locks
// everyone out or (far worse) lets everyone in. These cover the paths the
// proxy relies on — round-trip, wrong password, tamper, and expiry.

const PW = "correct horse battery staple";
const NOW = 1_700_000_000_000; // fixed clock; the module accepts an injected `now`

describe("session token — round-trip", () => {
  it("verifies a token minted with the same password", async () => {
    const token = await createSessionToken(PW, NOW);
    expect(await verifySessionToken(token, PW, NOW)).toBe(true);
  });

  it("still verifies just before expiry", async () => {
    const token = await createSessionToken(PW, NOW);
    const justBefore = NOW + SESSION_TTL_MS - 1;
    expect(await verifySessionToken(token, PW, justBefore)).toBe(true);
  });
});

describe("session token — rejects", () => {
  it("a token verified under a different password (rotation invalidates)", async () => {
    const token = await createSessionToken(PW, NOW);
    expect(await verifySessionToken(token, "different", NOW)).toBe(false);
  });

  it("an expired token", async () => {
    const token = await createSessionToken(PW, NOW);
    const afterExpiry = NOW + SESSION_TTL_MS + 1;
    expect(await verifySessionToken(token, PW, afterExpiry)).toBe(false);
  });

  it("a tampered expiry (signature no longer matches)", async () => {
    const token = await createSessionToken(PW, NOW);
    const [, sig] = token.split(".");
    const forged = `${NOW + 10 * SESSION_TTL_MS}.${sig}`;
    expect(await verifySessionToken(forged, PW, NOW)).toBe(false);
  });

  it("a tampered signature", async () => {
    const token = await createSessionToken(PW, NOW);
    const [payload] = token.split(".");
    expect(await verifySessionToken(`${payload}.deadbeef`, PW, NOW)).toBe(false);
  });

  it("empty / malformed tokens", async () => {
    expect(await verifySessionToken(undefined, PW, NOW)).toBe(false);
    expect(await verifySessionToken(null, PW, NOW)).toBe(false);
    expect(await verifySessionToken("", PW, NOW)).toBe(false);
    expect(await verifySessionToken("no-dot-here", PW, NOW)).toBe(false);
    expect(await verifySessionToken("notanumber.sig", PW, NOW)).toBe(false);
  });
});

describe("sanitizeNext — blocks open redirects", () => {
  it("passes through same-origin single-slash paths", () => {
    expect(sanitizeNext("/gallery")).toBe("/gallery");
    expect(sanitizeNext("/deck/abc?x=1")).toBe("/deck/abc?x=1");
  });

  it("falls back to / for protocol-relative and absolute URLs", () => {
    expect(sanitizeNext("//evil.com")).toBe("/");
    expect(sanitizeNext("https://evil.com")).toBe("/");
    expect(sanitizeNext("javascript:alert(1)")).toBe("/");
    expect(sanitizeNext(null)).toBe("/");
    expect(sanitizeNext(undefined)).toBe("/");
    expect(sanitizeNext("")).toBe("/");
  });
});
