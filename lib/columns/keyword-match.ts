import type { FeedItem } from "./types";

/**
 * Parse a comma/semicolon/space-separated alert-keyword string into a normalised
 * list of lowercase terms. Empty strings and whitespace-only segments are
 * dropped. Terms longer than 64 characters are dropped (defensive — no operator
 * intentionally writes a 64-char keyword, and unbounded lengths would slow
 * substring scans without changing match semantics). At most 16 terms are
 * retained per column.
 */
export function parseAlertKeywords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const segment of raw.split(/[,;]+/)) {
    for (const term of segment.split(/\s+/)) {
      const trimmed = term.trim().toLowerCase();
      if (trimmed.length === 0) continue;
      if (trimmed.length > 64) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
      if (out.length >= 16) return out;
    }
  }
  return out;
}

/**
 * Returns true when any of the parsed `terms` appears as a substring in the
 * item's author, content, or URL. Comparison is case-insensitive — `terms` is
 * already lowercased by `parseAlertKeywords`.
 */
export function itemMatchesAlertKeywords(
  item: FeedItem,
  terms: string[],
): boolean {
  if (terms.length === 0) return false;
  const haystack = [
    item.content,
    item.author?.name ?? "",
    item.author?.handle ?? "",
    item.url ?? "",
  ]
    .join("\n")
    .toLowerCase();
  for (const t of terms) {
    if (haystack.includes(t)) return true;
  }
  return false;
}

/**
 * Single-string substring match — case-insensitive, scans the same haystack as
 * `itemMatchesAlertKeywords` (content + author name + author handle + url).
 * Returns true when `query` is non-empty and appears as a substring.
 *
 * Used by the per-column quick-search input. Distinct from `parseAlertKeywords`
 * which splits a config string into a list of OR-combined terms — the search
 * input is one literal query, not a keyword list, so split semantics would just
 * confuse "rust foo" → "rust" OR "foo" when the operator meant the phrase.
 */
export function itemMatchesSearchQuery(item: FeedItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return false;
  const haystack = [
    item.content,
    item.author?.name ?? "",
    item.author?.handle ?? "",
    item.url ?? "",
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(q);
}

/**
 * Like `itemMatchesAlertKeywords`, but returns the subset of `terms` that
 * actually matched (in their original order). Empty array = no match. Used to
 * tell a webhook consumer *which* keywords fired for each item.
 */
export function matchedAlertKeywords(item: FeedItem, terms: string[]): string[] {
  if (terms.length === 0) return [];
  const haystack = [
    item.content,
    item.author?.name ?? "",
    item.author?.handle ?? "",
    item.url ?? "",
  ]
    .join("\n")
    .toLowerCase();
  return terms.filter((t) => haystack.includes(t));
}
