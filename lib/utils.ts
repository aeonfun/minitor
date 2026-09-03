import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCompactCount(n: number): string {
  if (Math.abs(n) < 1000) return String(n);
  if (Math.abs(n) < 1_000_000)
    return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  if (Math.abs(n) < 1_000_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
}

export function identiconUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(seed)}`;
}

export function truncateText(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

// Normalise a user tag/topic filter: accept commas / semicolons / whitespace,
// lowercase, drop blanks, dedupe, and clamp to `cap` (most tag APIs narrow
// aggressively past ~5 tags). Shared by the dev.to / Stack Overflow / topic
// filters.
export function normaliseTags(input: string, cap = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,;\s]+/)) {
    const tag = raw.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length === cap) break;
  }
  return out;
}
