import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Layers, Rocket, Sparkles, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { DECK_TEMPLATE_VERSION, TEMPLATES, type DeckTemplate } from "@/lib/deck-templates";
import { DECK_SHARE_HASH_KEY, encodeDeckShareHash } from "@/lib/deck-share";
import { getColumnType } from "@/lib/columns/registry";

// SEO surface — public, no auth required. Canonical is the same path because
// /gallery is the only place this deck-template catalog lives.
export const metadata: Metadata = {
  title: "Deck Gallery · Minitor",
  description:
    "Browse Minitor starter deck templates. One-click import to start monitoring HN, arXiv, GitHub, Hugging Face, X, DeFiLlama, CoinGecko, Polymarket, Product Hunt, DEV.to, and more.",
  alternates: { canonical: "/gallery" },
  openGraph: {
    title: "Minitor Deck Gallery",
    description:
      "Curated starter decks for AI research, the Base ecosystem, DeFi, and startup tracking — one-click import.",
    type: "website",
  },
};

const ICONS: Record<DeckTemplate["iconName"], LucideIcon> = {
  Sparkles,
  Layers,
  TrendingUp,
  Rocket,
};

// Build the share fragment server-side so each card renders as a plain anchor.
// The exported payload is deterministic (no timestamp) — we deliberately don't
// add `exportedAt` here so the same template generates the same URL across
// requests, which keeps the page cache-friendly and the links stable for
// people who share the URL of an individual template card.
function templateShareHref(template: DeckTemplate): string {
  const json = JSON.stringify({
    version: DECK_TEMPLATE_VERSION,
    deckName: template.payload.deckName,
    columns: template.payload.columns,
  });
  return `/#${DECK_SHARE_HASH_KEY}=${encodeDeckShareHash(json)}`;
}

export default function GalleryPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Minitor</p>
        <h1
          className="font-serif text-4xl italic text-foreground sm:text-5xl"
          style={{ letterSpacing: "-0.015em" }}
        >
          Deck Gallery
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          One-click starter decks. Pick a template — Minitor imports it as a new deck the moment you
          land on the dashboard. Your existing decks aren&apos;t touched.
        </p>
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-foreground transition-colors hover:bg-accent"
          >
            Open dashboard
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <section
        aria-label="Starter deck templates"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {TEMPLATES.map((template) => (
          <GalleryCard key={template.id} template={template} />
        ))}
      </section>

      <footer className="mt-auto border-t border-border pt-6 text-xs text-muted-foreground">
        <p>
          Templates use the same import path as JSON-paste and share-link imports. Each one lands as
          a brand-new deck with <span className="font-mono">(imported)</span> appended to the name.
        </p>
      </footer>
    </main>
  );
}

function GalleryCard({ template }: { template: DeckTemplate }) {
  const Icon = ICONS[template.iconName];
  const href = templateShareHref(template);
  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/40">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-md"
          style={{
            backgroundColor: `${template.accent}26`,
            color: template.accent,
          }}
        >
          <Icon className="size-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-sm font-medium text-foreground"
            style={{ letterSpacing: "-0.005em" }}
          >
            {template.name}
          </h2>
          <p className="truncate text-xs text-muted-foreground">{template.tagline}</p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{template.description}</p>

      <GalleryColumnPills template={template} />

      <div className="mt-auto flex justify-end pt-1">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          Import deck
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

function GalleryColumnPills({ template }: { template: DeckTemplate }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {template.payload.columns.map((col, i) => {
        const type = getColumnType(col.typeId);
        const accent = type?.accent ?? "#999";
        const PillIcon = type?.icon;
        return (
          <span
            key={`${col.typeId}-${i}`}
            className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: `${accent}20`,
              color: accent,
            }}
            title={col.title}
          >
            {PillIcon ? <PillIcon className="size-3" strokeWidth={2.5} /> : null}
            <span className="max-w-[12rem] truncate">{type?.label ?? col.typeId}</span>
          </span>
        );
      })}
    </div>
  );
}
