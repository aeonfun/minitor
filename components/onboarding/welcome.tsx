"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Layers,
  LayoutTemplate,
  Rocket,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { listColumnTypes, getColumnType } from "@/lib/columns/registry";
import { useDeckStore } from "@/lib/store/use-deck-store";
import type { AnyColumnUI } from "@/lib/columns/types";
import {
  TEMPLATES,
  templateAsImportJson,
  type DeckTemplate,
} from "@/lib/deck-templates";

const TEMPLATE_ICONS: Record<DeckTemplate["iconName"], LucideIcon> = {
  Sparkles,
  Layers,
  TrendingUp,
  Rocket,
};

interface Suggestion {
  typeId: string;
  title: string;
  config: Record<string, unknown>;
  hint: string;
}

// A handful of opinionated starting columns. Keyless suggestions are listed
// first so the default pre-selection (indexes 0, 1) works without any setup.
const SUGGESTIONS: Suggestion[] = [
  {
    typeId: "google-news",
    title: "Global news · AI",
    config: { query: "AI", hl: "", gl: "" },
    hint: "Google News across all languages/countries",
  },
  {
    typeId: "reddit",
    title: "r/programming",
    config: { subreddit: "programming", sortBy: "hot" },
    hint: "Hot posts from r/programming",
  },
  {
    typeId: "x-trending",
    title: "X · Trending in AI",
    config: { topic: "AI" },
    hint: "Top posts on X from the last 24h",
  },
  {
    typeId: "x-search",
    title: "X · @vercel",
    config: { query: "from:vercel" },
    hint: "Vercel's latest posts (uses from: operator)",
  },
  {
    typeId: "x-search",
    title: "X · Claude Code",
    config: { query: "claude code" },
    hint: "X posts mentioning Claude Code",
  },
  {
    typeId: "news-search",
    title: "News · AI regulation",
    config: { query: "AI regulation" },
    hint: "Latest articles from major publications",
  },
];

export function Onboarding() {
  const addDeck = useDeckStore((s) => s.addDeck);
  const addColumn = useDeckStore((s) => s.addColumn);
  const autoFetchColumn = useDeckStore((s) => s.autoFetchColumn);
  const setActiveDeck = useDeckStore((s) => s.setActiveDeck);
  const importDeck = useDeckStore((s) => s.importDeck);

  const [deckName, setDeckName] = useState("Home");
  // Pre-select the first two suggestions — both are keyless so onboarding
  // works out of the box.
  const [picked, setPicked] = useState<Set<number>>(() => new Set([0, 1]));
  const [templateLoadingId, setTemplateLoadingId] = useState<string | null>(
    null,
  );

  const types = useMemo(() => {
    const m = new Map<string, AnyColumnUI>();
    for (const t of listColumnTypes()) m.set(t.id, t);
    return m;
  }, []);

  const canContinue = deckName.trim().length > 0 && picked.size > 0;

  function toggle(i: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function start() {
    if (!canContinue) return;
    const id = addDeck(deckName.trim());
    setActiveDeck(id);
    for (const idx of picked) {
      const s = SUGGESTIONS[idx];
      if (!s) continue;
      const type = getColumnType(s.typeId);
      if (!type) continue;
      const { id: colId, ready } = addColumn(id, s.typeId, s.title, s.config);
      void autoFetchColumn(colId, type, ready);
    }
  }

  async function applyTemplate(template: DeckTemplate) {
    if (templateLoadingId) return;
    setTemplateLoadingId(template.id);
    try {
      const result = await importDeck(templateAsImportJson(template));
      toast.success(`Imported "${result.deckName}"`, {
        description: `${result.columns.length} column${result.columns.length === 1 ? "" : "s"}`,
      });
      // importDeck sets activeDeckId to the new deck — the parent DeckView
      // flips off the onboarding screen automatically once deckOrder grows.
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Template failed";
      toast.error("Could not load template", { description: msg });
    } finally {
      setTemplateLoadingId(null);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <span
              className="font-serif text-[28px] leading-none italic text-foreground"
              style={{ letterSpacing: "-0.02em" }}
            >
              Minitor
            </span>
            <Image
              src="/logo.png"
              alt=""
              width={32}
              height={32}
              priority
              className="size-8 shrink-0"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span>by</span>
            <a
              href="https://x.com/aeonframework"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-foreground"
            >
              <Image
                src="/aeon.jpg"
                alt="aeon"
                width={14}
                height={14}
                className="size-3.5 rounded-full ring-1 ring-black/10"
              />
              <span>aeon</span>
            </a>
          </div>
        </div>

        <h1
          className="font-serif text-[32px] leading-tight text-foreground"
          style={{ letterSpacing: "-0.015em", fontFeatureSettings: '"cswh" 1' }}
        >
          Welcome. Let&apos;s set up your first deck.
        </h1>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted-foreground">
          Start from a template below, or build a deck manually by picking
          sources one by one.
        </p>

        <section className="mt-6 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="size-4 text-foreground/70" />
              <Label className="text-[13px] font-medium">
                Start from a template
              </Label>
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {TEMPLATES.length} templates
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            One click to import a pre-built deck. You can rename, edit, or
            delete it after.
          </p>
          <ul
            role="list"
            className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {TEMPLATES.map((template) => {
              const Icon = TEMPLATE_ICONS[template.iconName];
              const loading = templateLoadingId === template.id;
              const disabled =
                templateLoadingId !== null && templateLoadingId !== template.id;
              return (
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() => void applyTemplate(template)}
                    disabled={loading || disabled}
                    className={cn(
                      "group flex w-full items-stretch overflow-hidden rounded-md border bg-card text-left transition-all",
                      "border-border hover:border-[oklab(0.263084_-0.00230259_0.0124794_/_0.22)]",
                      (loading || disabled) && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <div
                      className="flex w-10 shrink-0 items-center justify-center"
                      style={{
                        backgroundColor: `${template.accent}33`,
                        color: template.accent,
                      }}
                    >
                      <Icon className="size-4" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0 flex-1 px-2.5 py-2">
                      <div
                        className="truncate text-[12.5px] font-medium text-foreground"
                        style={{ letterSpacing: "-0.005em" }}
                      >
                        {template.name}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {template.tagline}
                      </div>
                    </div>
                    <div className="flex w-12 shrink-0 items-center justify-center pr-1.5 text-[10px] text-muted-foreground">
                      {loading ? "…" : `${template.payload.columns.length} cols`}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            or build manually
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="mt-6 space-y-5">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-7 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-primary-foreground">
                1
              </div>
              <Label htmlFor="deck-name" className="text-[13px] font-medium">
                Name your deck
              </Label>
            </div>
            <div className="mt-3 pl-10">
              <Input
                id="deck-name"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Home, Research, Crypto…"
                autoFocus
              />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-7 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-primary-foreground">
                  2
                </div>
                <Label className="text-[13px] font-medium">
                  Pick a few columns
                </Label>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {picked.size} selected
              </span>
            </div>

            <ul role="list" className="mt-3 grid grid-cols-1 gap-2 pl-0 sm:grid-cols-2">
              {SUGGESTIONS.map((s, i) => {
                const type = types.get(s.typeId);
                if (!type) return null;
                const Icon = type.icon;
                const isPicked = picked.has(i);
                return (
                  <li key={`${s.typeId}-${i}`}>
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      className={cn(
                        "group flex w-full items-stretch overflow-hidden rounded-md border bg-card text-left transition-all",
                        isPicked
                          ? "border-foreground shadow-sm"
                          : "border-border hover:border-[oklab(0.263084_-0.00230259_0.0124794_/_0.22)]",
                      )}
                    >
                      <div
                        className="flex w-10 shrink-0 items-center justify-center"
                        style={{
                          backgroundColor: `${type.accent}33`,
                          color: type.accent,
                        }}
                      >
                        <Icon className="size-4" strokeWidth={2.25} />
                      </div>
                      <div className="min-w-0 flex-1 truncate px-2.5 py-2">
                        <div
                          className={cn(
                            "truncate text-[12.5px] font-medium",
                            isPicked ? "text-foreground" : "text-foreground/90",
                          )}
                          style={{ letterSpacing: "-0.005em" }}
                        >
                          {s.title}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {s.hint}
                        </div>
                      </div>
                      <div className="flex w-8 shrink-0 items-center justify-center">
                        <span
                          className={cn(
                            "flex size-4 items-center justify-center rounded-full border transition-colors",
                            isPicked
                              ? "border-foreground bg-foreground text-primary-foreground"
                              : "border-border bg-transparent",
                          )}
                        >
                          {isPicked && <Check className="size-2.5" strokeWidth={3} />}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 pl-10 text-[11px] text-muted-foreground">
              Don&apos;t worry — you can add, remove, and reorder columns any time
              after setup.
            </p>
          </section>

          <div className="flex justify-end">
            <Button
              onClick={start}
              disabled={!canContinue}
              className="gap-1.5"
            >
              Create deck
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
