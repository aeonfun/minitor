"use client";

import { useState } from "react";
import { ArrowRight, Layers, Rocket, Sparkles, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getColumnType } from "@/lib/columns/registry";
import {
  TEMPLATES,
  templateAsImportJson,
  type DeckTemplate,
} from "@/lib/deck-templates";
import { useDeckStore } from "@/lib/store/use-deck-store";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Resolved here (not inside deck-templates.ts) so the templates module stays
// data-only and doesn't pull lucide into bundles that never render the gallery.
const ICONS: Record<DeckTemplate["iconName"], LucideIcon> = {
  Sparkles,
  Layers,
  TrendingUp,
  Rocket,
};

export function TemplatesDialog({ open, onOpenChange }: Props) {
  const importDeck = useDeckStore((s) => s.importDeck);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  async function applyTemplate(template: DeckTemplate) {
    if (submittingId) return;
    setSubmittingId(template.id);
    try {
      const json = templateAsImportJson(template);
      const result = await importDeck(json);
      toast.success(`Imported "${result.deckName}"`, {
        description: `${result.columns.length} column${result.columns.length === 1 ? "" : "s"}`,
      });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Template failed";
      toast.error("Could not load template", { description: msg });
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Each template imports as a new deck. Your existing decks aren&apos;t
          touched — feel free to try several.
        </p>
        <ul role="list" className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TEMPLATES.map((template) => {
            const Icon = ICONS[template.iconName];
            const submitting = submittingId === template.id;
            return (
              <li key={template.id}>
                <TemplateCard
                  template={template}
                  Icon={Icon}
                  submitting={submitting}
                  disabled={submittingId !== null && !submitting}
                  onPick={() => void applyTemplate(template)}
                />
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

interface CardProps {
  template: DeckTemplate;
  Icon: LucideIcon;
  submitting: boolean;
  disabled: boolean;
  onPick: () => void;
}

function TemplateCard({ template, Icon, submitting, disabled, onPick }: CardProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-md border border-border bg-card p-3 transition-colors",
        disabled ? "opacity-60" : "hover:border-foreground/40",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 items-center justify-center rounded-sm"
          style={{
            backgroundColor: `${template.accent}33`,
            color: template.accent,
          }}
        >
          <Icon className="size-4" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[13px] font-medium text-foreground"
            style={{ letterSpacing: "-0.005em" }}
          >
            {template.name}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {template.tagline}
          </div>
        </div>
      </div>
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        {template.description}
      </p>
      <TemplateColumnPills template={template} />
      <div className="mt-auto flex justify-end pt-1">
        <Button
          size="sm"
          onClick={onPick}
          disabled={submitting || disabled}
          className="gap-1.5"
        >
          {submitting ? "Importing…" : "Use this deck"}
          {!submitting && <ArrowRight className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function TemplateColumnPills({ template }: { template: DeckTemplate }) {
  // Show one pill per column with the registered plugin's brand colour so the
  // operator can preview what they'll get without clicking. We tolerate
  // unknown typeIds (renders the typeId itself) so a template that ships ahead
  // of a plugin doesn't crash the gallery.
  return (
    <div className="flex flex-wrap gap-1">
      {template.payload.columns.map((col, i) => {
        const type = getColumnType(col.typeId);
        const accent = type?.accent ?? "#999";
        const Icon = type?.icon;
        return (
          <span
            key={`${col.typeId}-${i}`}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${accent}20`,
              color: accent,
            }}
            title={col.title}
          >
            {Icon ? <Icon className="size-2.5" strokeWidth={2.5} /> : null}
            <span className="max-w-[10rem] truncate">{type?.label ?? col.typeId}</span>
          </span>
        );
      })}
    </div>
  );
}
