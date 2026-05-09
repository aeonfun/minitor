import type { FeedItem } from "@/lib/columns/types";
import { identiconUrl } from "@/lib/utils";

// arXiv Atom-XML query API — public, no auth, no rate-limit headers documented
// beyond the polite-crawler advice (≥3 sec between requests, recognisable UA).
// https://info.arxiv.org/help/api/user-manual.html
//
// We hit /api/query with a `search_query` (e.g. cat:cs.AI, optionally ANDed
// with ti:KEYWORD or abs:KEYWORD), `sortBy` + `sortOrder`, and start/limit
// pagination. The response is Atom 1.0 — `<entry>` rows with `title`,
// `summary` (abstract), `author/name` repeated, `category@term` repeated,
// `link rel="alternate"` (the abs/ permalink), `published`, `updated`, and
// the unique `id` (also a URL).
const BASE = "https://export.arxiv.org";

export type ArxivCategory =
  | "cs.AI"
  | "cs.CL"
  | "cs.LG"
  | "cs.CV"
  | "cs.RO"
  | "cs.CR"
  | "cs.DC"
  | "cs.NE"
  | "cs.SE"
  | "cs.PL"
  | "stat.ML"
  | "math.OC";

export type ArxivMode = "recent" | "updated";

export interface ArxivMeta {
  // Primary category as reported by arXiv (often more specific than the
  // user's filter — a cs.AI paper might primary-cat as cs.LG when it's more
  // ML than agentic, useful signal for the renderer).
  primaryCategory: string;
  categories: string[];
  authors: string[];
  abstract: string;
  pdfUrl?: string;
  arxivId: string;
  publishedAt: string;
  updatedAt: string;
  // Distinguishes a freshly published paper from a v2/v3 revision — useful
  // for picking out genuinely new work in `updated` mode.
  isRevision: boolean;
  // Free-form `<arxiv:comment>` from the Atom entry. Authors typically use it
  // for venue acceptance ("Accepted to ICML 2026", "SIGGRAPH 2026"), code
  // links ("Code: https://github.com/..."), or page count ("33 pages"). ~56%
  // of recent cs.LG entries populate it; the renderer hides the line when
  // empty.
  comment?: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, (m) => NAMED_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function getTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)</${escaped}>`, "i");
  return xml.match(re)?.[1] ?? "";
}

function getAllTags(xml: string, tag: string): string[] {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)</${escaped}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function clean(s: string): string {
  return decodeEntities(s)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchQuery(category: ArxivCategory, search: string): string {
  // search is an optional title/abstract keyword filter ANDed onto the
  // category. Empty → just the category. Multiple words are joined with
  // explicit AND so arXiv treats them as conjunction, not disjunction.
  const trimmed = search.trim();
  if (!trimmed) return `cat:${category}`;
  const words = trimmed
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => `(ti:${w}+OR+abs:${w})`);
  if (words.length === 0) return `cat:${category}`;
  return `cat:${category}+AND+${words.join("+AND+")}`;
}

function sortFor(mode: ArxivMode): {
  sortBy: "submittedDate" | "lastUpdatedDate";
  sortOrder: "descending";
} {
  return {
    sortBy: mode === "updated" ? "lastUpdatedDate" : "submittedDate",
    sortOrder: "descending",
  };
}

function extractArxivId(idUrl: string): string {
  // arXiv `<id>` URLs look like https://arxiv.org/abs/2501.12345v2 — extract
  // the bare id (with version) so the renderer can show the canonical form.
  const m = idUrl.match(/abs\/([^?#\s]+)/i);
  if (m) return m[1].trim();
  // Fallback: anything resembling an id (digits.digits with optional vN).
  const fallback = idUrl.match(/\d{4}\.\d{4,5}(v\d+)?/);
  return fallback ? fallback[0] : idUrl;
}

function extractPdfUrl(entry: string): string | undefined {
  const linkRe = /<link\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(entry))) {
    const attrs = m[1];
    const title = attrs.match(/\btitle=["']pdf["']/i);
    const href = attrs.match(/\bhref=["']([^"']+)["']/)?.[1];
    if (title && href) return href;
  }
  return undefined;
}

function extractAlternateUrl(entry: string, fallback: string): string {
  const linkRe = /<link\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(entry))) {
    const attrs = m[1];
    const rel = attrs.match(/\brel=["']([^"']+)["']/)?.[1] ?? "alternate";
    const href = attrs.match(/\bhref=["']([^"']+)["']/)?.[1];
    if (href && rel === "alternate") return href;
  }
  return fallback;
}

function extractCategories(entry: string): {
  primary: string;
  all: string[];
} {
  // <category term="cs.LG" .../> repeated, plus <arxiv:primary_category .../>
  // as the canonical primary. Some entries omit the namespaced primary; in
  // that case the first <category> is the primary by arXiv convention.
  const all: string[] = [];
  const re = /<category\b([^>]*?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(entry))) {
    const term = m[1].match(/\bterm=["']([^"']+)["']/)?.[1];
    if (term) all.push(term);
  }
  const primaryMatch = entry.match(
    /<arxiv:primary_category\b[^>]*\bterm=["']([^"']+)["']/i,
  );
  const primary = primaryMatch ? primaryMatch[1] : (all[0] ?? "");
  return { primary, all };
}

function extractAuthors(entry: string): string[] {
  const authorBlocks = getAllTags(entry, "author");
  const out: string[] = [];
  for (const block of authorBlocks) {
    const name = clean(getTag(block, "name"));
    if (name) out.push(name);
  }
  return out;
}

function mapEntry(entry: string): FeedItem<ArxivMeta> | null {
  const idUrl = clean(getTag(entry, "id"));
  const title = clean(getTag(entry, "title"));
  // Schema-drift safe — without an id and a title there's nothing to render
  // or link to. arXiv has occasionally returned malformed entries during
  // upstream maintenance windows, so drop rather than emit a dead row.
  if (!idUrl || !title) return null;

  const arxivId = extractArxivId(idUrl);
  const link = extractAlternateUrl(entry, idUrl);
  const pdfUrl = extractPdfUrl(entry);
  const abstract = clean(getTag(entry, "summary"));
  const authors = extractAuthors(entry);
  const { primary, all } = extractCategories(entry);
  const comment = clean(getTag(entry, "arxiv:comment"));

  const publishedRaw = getTag(entry, "published").trim();
  const updatedRaw = getTag(entry, "updated").trim();
  const publishedMs = publishedRaw ? Date.parse(publishedRaw) : NaN;
  const updatedMs = updatedRaw ? Date.parse(updatedRaw) : NaN;
  const createdMs = Number.isFinite(updatedMs)
    ? updatedMs
    : Number.isFinite(publishedMs)
      ? publishedMs
      : Date.now();

  // A revision is detectable two ways: a `vN` suffix where N>1 on the id, or
  // an `updated` strictly later than `published`. Either is sufficient.
  const versionMatch = arxivId.match(/v(\d+)$/);
  const version = versionMatch ? Number(versionMatch[1]) : 1;
  const isRevision =
    version > 1 ||
    (Number.isFinite(publishedMs) &&
      Number.isFinite(updatedMs) &&
      updatedMs - publishedMs > 60_000);

  // The author byline for the card uses the first author + "et al." when
  // there are more — matches the convention every arXiv paper uses on its
  // own abs page. Identicon falls back to that name.
  const headlineAuthor =
    authors.length === 0
      ? "arXiv"
      : authors.length === 1
        ? authors[0]
        : `${authors[0]} et al.`;

  return {
    id: arxivId,
    author: {
      name: headlineAuthor,
      handle: arxivId,
      avatarUrl: identiconUrl(headlineAuthor),
    },
    content: title,
    url: link,
    createdAt: new Date(createdMs).toISOString(),
    meta: {
      primaryCategory: primary,
      categories: all,
      authors,
      abstract,
      pdfUrl,
      arxivId,
      publishedAt: Number.isFinite(publishedMs)
        ? new Date(publishedMs).toISOString()
        : new Date(createdMs).toISOString(),
      updatedAt: Number.isFinite(updatedMs)
        ? new Date(updatedMs).toISOString()
        : new Date(createdMs).toISOString(),
      isRevision,
      comment: comment || undefined,
    },
  };
}

export async function fetchArxivPage(
  category: ArxivCategory,
  mode: ArxivMode,
  search: string,
  limit: number,
  page: number,
): Promise<{ items: FeedItem<ArxivMeta>[]; hasMore: boolean }> {
  const start = Math.max(page, 0) * limit;
  const { sortBy, sortOrder } = sortFor(mode);

  // arXiv requires `search_query` URL-encoded but with `+` left literal as
  // the query separator — URLSearchParams escapes `+` to `%2B` which arXiv
  // then rejects. So build the query string manually for `search_query`.
  const query = buildSearchQuery(category, search);
  const url =
    `${BASE}/api/query?` +
    `search_query=${query}` +
    `&start=${start}` +
    `&max_results=${limit}` +
    `&sortBy=${sortBy}` +
    `&sortOrder=${sortOrder}`;

  const res = await fetch(url, {
    headers: {
      // Atom 1.0 — the only response shape arXiv's API speaks.
      accept: "application/atom+xml, application/xml;q=0.9, text/xml;q=0.9",
      // arXiv's user manual asks scrapers to identify themselves so the
      // operations team can rate-limit cooperatively if needed.
      "user-agent": "minitor/1.0 (+https://github.com/aaronjmars/minitor)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`arXiv ${res.status}: ${detail}`);
  }

  const xml = await res.text();
  // arXiv reports `<opensearch:totalResults>N</opensearch:totalResults>` and
  // `<opensearch:itemsPerPage>` near the head — read totalResults to decide
  // whether more pages exist. Falls back to `entries.length === limit` when
  // missing (very rare, only seen during upstream maintenance).
  const totalMatch = xml.match(
    /<opensearch:totalResults\b[^>]*>(\d+)<\/opensearch:totalResults>/i,
  );
  const total = totalMatch ? Number(totalMatch[1]) : Number.NaN;

  const entries = getAllTags(xml, "entry");
  const items = entries
    .map(mapEntry)
    .filter((e): e is FeedItem<ArxivMeta> => e !== null);

  const hasMore = Number.isFinite(total)
    ? start + items.length < total
    : entries.length >= limit;

  return { items, hasMore };
}
