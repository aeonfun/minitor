"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, KeyRound, Search, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listColumnTypes } from "@/lib/columns/registry";
import { useDeckStore } from "@/lib/store/use-deck-store";
import type { AnyColumnUI } from "@/lib/columns/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getKeyAvailability } from "@/app/actions";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
}

export function AddColumnDialog({ open, onOpenChange, deckId }: Props) {
  const addColumn = useDeckStore((s) => s.addColumn);
  const autoFetchColumn = useDeckStore((s) => s.autoFetchColumn);
  // Surface keyless plugins first; preserve manifest order within each group.
  const types = useMemo(() => {
    const all = listColumnTypes();
    return [...all].sort((a, b) => {
      const aGated = (a.capabilities?.requiresEnv?.length ?? 0) > 0 ? 1 : 0;
      const bGated = (b.capabilities?.requiresEnv?.length ?? 0) > 0 ? 1 : 0;
      if (aGated !== bGated) return aGated - bGated;
      return all.indexOf(a) - all.indexOf(b);
    });
  }, []);

  const [selectedType, setSelectedType] = useState<AnyColumnUI | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState("");
  const [keyAvailability, setKeyAvailability] = useState<Record<string, boolean>>({});

  // Distinct env keys across all plugins, computed once.
  const allRequiredKeys = useMemo(() => {
    const set = new Set<string>();
    for (const t of types) {
      for (const k of t.capabilities?.requiresEnv ?? []) set.add(k);
    }
    return [...set];
  }, [types]);

  // Load key presence from the server when the dialog opens. Booleans only —
  // values never leave the server.
  useEffect(() => {
    if (!open) return;
    if (allRequiredKeys.length === 0) return;
    let cancelled = false;
    getKeyAvailability(allRequiredKeys).then((avail) => {
      if (!cancelled) setKeyAvailability(avail);
    });
    return () => {
      cancelled = true;
    };
  }, [open, allRequiredKeys]);

  function isMissingKeys(t: AnyColumnUI): string[] {
    const required = t.capabilities?.requiresEnv ?? [];
    return required.filter((k) => !keyAvailability[k]);
  }

  const filteredTypes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return types;
    return types.filter((t) => {
      const haystack = `${t.label} ${t.description ?? ""} ${t.id}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [types, filter]);

  function reset() {
    setSelectedType(null);
    setConfig({});
    setTitle("");
    setFilter("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function pickType(type: AnyColumnUI) {
    setSelectedType(type);
    setConfig({ ...(type.defaultConfig as Record<string, unknown>) });
    setTitle(type.defaultTitle(type.defaultConfig as never));
  }

  function commit() {
    if (!selectedType) return;
    const finalTitle = title.trim() || selectedType.defaultTitle(config as never);
    const { id, ready } = addColumn(deckId, selectedType.id, finalTitle, config);
    handleOpenChange(false);
    void autoFetchColumn(id, selectedType, ready);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-4xl">
        <DialogHeader className="text-center">
          <DialogTitle className="text-center">
            {selectedType ? `New ${selectedType.label} column` : "Add a column"}
          </DialogTitle>
        </DialogHeader>

        {!selectedType && (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter sources…"
                className="pl-9"
                autoFocus
              />
            </div>
            {filteredTypes.length === 0 ? (
              <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">
                {filter ? `No sources match “${filter}”.` : "No sources match the current filter."}
              </p>
            ) : (
              <ul
                role="list"
                className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              >
                {filteredTypes.map((t) => {
                  const Icon = t.icon;
                  const missing = isMissingKeys(t);
                  const required = t.capabilities?.requiresEnv ?? [];
                  const rateLimitHint = t.capabilities?.rateLimitHint;
                  const hasMissing = missing.length > 0;
                  return (
                    <li key={t.id} className="col-span-1">
                      <Tooltip>
                        <TooltipTrigger
                          onClick={() => pickType(t)}
                          className={cn(
                            "group flex w-full overflow-hidden rounded-md border border-border bg-card shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-all hover:border-[oklab(0.263084_-0.00230259_0.0124794_/_0.22)] hover:shadow-sm",
                            hasMissing && "opacity-60",
                          )}
                        >
                          <div
                            className="flex w-11 shrink-0 items-center justify-center self-stretch"
                            style={{ backgroundColor: `${t.accent}33`, color: t.accent }}
                          >
                            <Icon className="size-4.5" strokeWidth={2.25} />
                          </div>
                          <div className="min-w-0 flex-1 truncate px-2.5 py-2.5 text-left">
                            <div
                              className="truncate text-[12.5px] font-medium text-foreground group-hover:text-[color:var(--brand-hover)]"
                              style={{ letterSpacing: "-0.005em" }}
                            >
                              {t.label}
                            </div>
                          </div>
                          {hasMissing && (
                            <div className="flex shrink-0 items-center pr-2 text-muted-foreground">
                              <KeyRound className="size-3.5" />
                            </div>
                          )}
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="flex w-max max-w-[min(440px,calc(100vw-2rem))] flex-col items-stretch gap-1"
                        >
                          <p className="whitespace-normal">{t.description}</p>
                          {required.length > 0 && (
                            <ul className="flex flex-col gap-0.5">
                              {required.map((k) => {
                                const have = keyAvailability[k];
                                return (
                                  <li key={k} className="flex items-center gap-1.5">
                                    {have ? (
                                      <Check className="size-3 shrink-0 text-[color:var(--brand)]" />
                                    ) : (
                                      <X className="size-3 shrink-0 text-background/60" />
                                    )}
                                    <code className="rounded bg-background/15 px-1 py-px text-[11px]">
                                      {k}
                                    </code>
                                    <span className="text-[11px] text-background/70">
                                      {have ? "set" : "not set"}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          {rateLimitHint && (
                            <p className="text-[11px] text-background/70">{rateLimitHint}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {selectedType && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commit();
            }}
            className="contents"
          >
            <div className="grid gap-4">
              <selectedType.ConfigForm
                value={config as never}
                onChange={(next) => {
                  setConfig(next as Record<string, unknown>);
                  setTitle(selectedType.defaultTitle(next as never));
                }}
              />
              <CapabilitiesNote type={selectedType} />
              <div className="grid gap-1.5">
                <Label htmlFor="col-title">Column title</Label>
                <Input id="col-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => setSelectedType(null)}>
                <ArrowLeft className="mr-1 size-4" />
                Back
              </Button>
              <div className="flex-1" />
              <Button type="submit">Add column</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CapabilitiesNote({ type }: { type: AnyColumnUI }) {
  const caps = type.capabilities;
  if (!caps) return null;
  const requiresEnv = caps.requiresEnv ?? [];
  const rateLimitHint = caps.rateLimitHint;
  if (requiresEnv.length === 0 && !rateLimitHint) return null;
  return (
    <div className="rounded-md border border-border bg-surface/40 px-3 py-2 text-[11.5px] text-muted-foreground">
      {requiresEnv.length > 0 && (
        <div>
          Requires:{" "}
          {requiresEnv.map((v, i) => (
            <span key={v}>
              <code className="rounded bg-foreground/[0.06] px-1 py-px text-foreground/90">
                {v}
              </code>
              {i < requiresEnv.length - 1 ? ", " : ""}
            </span>
          ))}
          <span className="text-muted-foreground/70"> in your env.</span>
        </div>
      )}
      {rateLimitHint && (
        <div className={requiresEnv.length > 0 ? "mt-1" : undefined}>
          Rate limit: {rateLimitHint}
        </div>
      )}
    </div>
  );
}
