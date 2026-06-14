// Shared server-side text helpers for the integration fetchers. These run on
// raw upstream payloads (RSS/Atom XML, Gamma/Lobsters HTML fragments) before
// the data crosses into renderer-facing `FeedItem`s.

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Decode the handful of named entities plus numeric (`&#NN;`) and hex
 * (`&#xNN;`) character references that show up in RSS/Atom feed text. Shared
 * by the `rss` and `arxiv` parsers (byte-identical in both).
 *
 * Note: `stackoverflow.ts` and `pypi.ts` keep narrower bespoke variants —
 * those are intentionally not routed through here.
 */
export function decodeEntities(s: string): string {
  return s
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, (m) => NAMED_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

/**
 * Strip a sanitised HTML fragment down to plain text, preserving block breaks
 * as newlines and decoding the few entities that survive. Targeted regex strip
 * rather than a full parser — safe because the upstreams (Lobsters story
 * descriptions, Polymarket Gamma market descriptions) only emit a small,
 * well-formed tag set. Shared by `lobsters` and `polymarket` (byte-identical).
 *
 * Note: `mastodon.ts` keeps a richer `<a>`/`<p>`-aware variant — not this one.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
