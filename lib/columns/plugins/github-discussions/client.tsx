"use client";

import {
  ArrowBigUp,
  Check,
  Circle,
  MessageSquare,
  MessageSquareText,
} from "lucide-react";
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
import { formatCompactCount } from "@/lib/utils";
import {
  meta,
  type GHDiscussionsConfig,
  type GHDiscussionsMeta,
} from "./plugin";

const MODE_LABELS: Record<GHDiscussionsConfig["mode"], string> = {
  recent: "Recent — newest first",
  unanswered: "Unanswered — open questions only",
  top: "Top — most upvoted",
};

function ConfigForm({ value, onChange }: ConfigFormProps<GHDiscussionsConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="ghd-repo">Repository</Label>
        <Input
          id="ghd-repo"
          placeholder="vercel/next.js"
          value={value.repo}
          onChange={(e) => onChange({ ...value, repo: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          <code>owner/repo</code> or full GitHub URL. The repo must have
          Discussions enabled in its settings.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({
              ...value,
              mode: v as GHDiscussionsConfig["mode"],
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MODE_LABELS) as GHDiscussionsConfig["mode"][]).map(
              (m) => (
                <SelectItem key={m} value={m}>
                  {MODE_LABELS[m]}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          <code>GITHUB_TOKEN</code> is optional — it raises the rate limit from
          60 to 5000 requests/hour but isn&apos;t required for the column to
          work.
        </p>
      </div>
    </div>
  );
}

function AnsweredIndicator({ answered }: { answered: boolean }) {
  if (answered) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
        style={{
          backgroundColor: "rgba(16, 185, 129, 0.18)",
          color: "#047857",
        }}
        title="Answered"
      >
        <Check className="size-3" strokeWidth={3} />
        answered
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60"
      title="Unanswered"
    >
      <Circle className="size-3" />
      unanswered
    </span>
  );
}

function CategoryPill({ name }: { name: string }) {
  // GitHub returns emojiHTML like `<g-emoji>💬</g-emoji>`. We deliberately
  // don't render it as HTML — that would mean inserting an arbitrary fetched
  // string into the DOM, and the security note in CLAUDE.md treats all
  // upstream strings as untrusted. The category name alone is plenty.
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-foreground/90 ring-1 ring-black/5"
      style={{ backgroundColor: "rgba(124, 58, 237, 0.14)" }}
    >
      <MessageSquare className="size-3" style={{ color: "#7C3AED" }} />
      {name}
    </span>
  );
}

function ItemRenderer({ item }: ItemRendererProps<GHDiscussionsMeta>) {
  const m = item.meta;
  if (!m) return null;
  // Q&A categories are the only ones that carry a meaningful answered state.
  // For Announcements / Polls / General / Show-and-tell etc. there's no
  // "answer" concept — hide the indicator rather than render a misleading
  // "unanswered" pill on every announcement.
  const isQA =
    (m.categoryName ?? "").trim().toLowerCase().includes("q&a") ||
    (m.categoryName ?? "").trim().toLowerCase().includes("question");

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        {m.categoryName && <CategoryPill name={m.categoryName} />}
        {isQA && <AnsweredIndicator answered={m.isAnswered} />}
        <span className="truncate text-foreground/80">
          {item.author.handle ?? item.author.name}
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
      </div>
      <h3
        className="mt-1 font-serif text-[16px] leading-[1.3] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand-hover)]"
        style={{ letterSpacing: "-0.005em", fontFeatureSettings: '"cswh" 1' }}
      >
        {item.content}
      </h3>
      <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
        <span className="tabular-nums text-foreground/70">#{m.number}</span>
        <span className="flex items-center gap-1">
          <ArrowBigUp className="size-3.5" />
          <span className="tabular-nums">
            {formatCompactCount(m.upvotes)}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <MessageSquareText className="size-3.5" />
          <span className="tabular-nums">
            {formatCompactCount(m.comments)}
          </span>
        </span>
      </div>
    </a>
  );
}

export const column = defineColumnUI<GHDiscussionsConfig, GHDiscussionsMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
