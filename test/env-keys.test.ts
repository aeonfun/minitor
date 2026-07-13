import { describe, it, expect } from "vitest";
import { isPlaceholderValue } from "@/lib/env-keys";

describe("isPlaceholderValue", () => {
  it("treats blank / nullish values as unset", () => {
    expect(isPlaceholderValue(undefined)).toBe(true);
    expect(isPlaceholderValue(null)).toBe(true);
    expect(isPlaceholderValue("")).toBe(true);
    expect(isPlaceholderValue("   ")).toBe(true);
  });

  it("treats the shipped .env.example ellipsis placeholders as unset", () => {
    // .env.example ships `XAI_API_KEY=xai-...`
    expect(isPlaceholderValue("xai-...")).toBe(true);
    expect(isPlaceholderValue("your-key-…")).toBe(true);
  });

  it("accepts a real-looking key", () => {
    expect(isPlaceholderValue("xai-abc123DEF456ghi789")).toBe(false);
    expect(isPlaceholderValue("ghp_aBcD1234")).toBe(false);
    expect(isPlaceholderValue("  xai-realkey  ")).toBe(false);
  });
});
