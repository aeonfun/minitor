"use client";

import { FileText, GitMerge, Users } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  defineColumnUI,
  type ConfigFormProps,
  type ItemRendererProps,
} from "@/lib/columns/types";
import {
  meta,
  type ArxivConfig,
  type ArxivMeta,
  ARXIV_CATEGORIES,
  ARXIV_CATEGORY_LABELS,
} from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<ArxivConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Category</Label>
        <Select
          value={value.category}
          onValueChange={(v) =>
            onChange({ ...value, category: v as ArxivConfig["category"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ARXIV_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c} — {ARXIV_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Sort</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as ArxivConfig["mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Newest submissions</SelectItem>
            <SelectItem value="updated">Recently updated</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="arxiv-search">Search (optional)</Label>
        <Input
          id="arxiv-search"
          placeholder="agents, llm, retrieval…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Title + abstract keyword filter, ANDed with the category. Multiple
          words are joined as AND. See{" "}
          <a
            href="https://info.arxiv.org/help/api/user-manual.html"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            arxiv.org/help/api
          </a>{" "}
          for the underlying query syntax.
        </p>
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function ItemRenderer({ item }: ItemRendererProps<ArxivMeta>) {
  const m = item.meta;
  const primary = m?.primaryCategory ?? "";
  const otherCats = (m?.categories ?? []).filter((c) => c !== primary);
  const authors = m?.authors ?? [];
  const abstract = m?.abstract ?? "";
  const arxivId = m?.arxivId ?? "";
  const pdfUrl = m?.pdfUrl;
  const isRevision = !!m?.isRevision;

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-white"
          style={{ backgroundColor: "#B31B1B" }}
        >
          arXiv
        </span>
        {primary && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono text-[10.5px] text-muted-foreground/90">
              {primary}
            </span>
          </>
        )}
        {arxivId && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono text-[10.5px] text-muted-foreground/70">
              {arxivId}
            </span>
          </>
        )}
        {isRevision && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span
              className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"
              title="This entry is a revised version (v2 or later)"
            >
              <GitMerge className="size-3" />
              revision
            </span>
          </>
        )}
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
      </div>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block"
      >
        <h3
          className="font-serif text-[16px] leading-[1.3] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand)]"
          style={{ letterSpacing: "-0.005em", fontFeatureSettings: '"cswh" 1' }}
        >
          {item.content}
        </h3>
      </a>
      {authors.length > 0 && (
        <div className="mt-1 flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <Users className="size-3" />
          <span className="truncate">
            {authors.length <= 3
              ? authors.join(", ")
              : `${authors.slice(0, 3).join(", ")} + ${authors.length - 3} more`}
          </span>
        </div>
      )}
      {abstract && (
        <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground/90">
          {truncate(abstract, 280)}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {otherCats.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {otherCats.slice(0, 4).map((c) => (
              <span
                key={c}
                className="rounded-sm px-1 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border/60"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/90 underline-offset-2 hover:text-foreground hover:underline"
          >
            <FileText className="size-3" />
            PDF
          </a>
        )}
      </div>
    </div>
  );
}

export const column = defineColumnUI<ArxivConfig, ArxivMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
