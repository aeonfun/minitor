"use client";

import { Calendar, Droplets, TrendingUp } from "lucide-react";
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
import { meta, type PolymarketConfig, type PolymarketMeta } from "./plugin";

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n < 1000) return `$${Math.round(n)}`;
  if (n < 1_000_000) return `$${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  if (n < 1_000_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${(n / 1_000_000_000).toFixed(1)}B`;
}

function formatPct(p: number): string {
  // Gamma serves probabilities in 0–1 decimal form. Round to a whole percent
  // — Polymarket's own UI also rounds; keeping decimals here would create
  // false precision against a market that's actively trading.
  if (!Number.isFinite(p)) return "—";
  const v = Math.max(0, Math.min(1, p));
  return `${Math.round(v * 100)}%`;
}

function formatEndDate(iso?: string): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const now = Date.now();
  const diffDays = Math.round((t - now) / 86_400_000);
  if (diffDays < 0) return "ended";
  if (diffDays === 0) return "ends today";
  if (diffDays === 1) return "ends tomorrow";
  if (diffDays < 7) return `ends in ${diffDays}d`;
  if (diffDays < 30) return `ends in ${Math.round(diffDays / 7)}w`;
  if (diffDays < 365) return `ends in ${Math.round(diffDays / 30)}mo`;
  return `ends in ${Math.round(diffDays / 365)}y`;
}

function ConfigForm({ value, onChange }: ConfigFormProps<PolymarketConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Sort</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as PolymarketConfig["mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trending">Trending (24h volume)</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="ending-soon">Ending soon</SelectItem>
            <SelectItem value="tag">By tag…</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.mode === "tag" && (
        <div className="grid gap-1.5">
          <Label htmlFor="poly-tag">Tag slug</Label>
          <Input
            id="poly-tag"
            placeholder="politics, sports, crypto, world, entertainment…"
            value={value.tag}
            onChange={(e) => onChange({ ...value, tag: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Lowercase tag slug — see{" "}
            <a
              href="https://polymarket.com"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              polymarket.com
            </a>{" "}
            category pages for the canonical list. Empty falls back to
            Trending.
          </p>
        </div>
      )}
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<PolymarketMeta>) {
  const m = item.meta;
  const outcomes = m?.outcomes ?? [];
  const top = outcomes.slice(0, 2);
  const isBinary = outcomes.length === 2;
  const volume = m?.volume24hUsd ?? 0;
  const liquidity = m?.liquidityUsd ?? 0;
  const endsLabel = formatEndDate(m?.endDate);

  const [title, ...rest] = item.content.split("\n\n");
  const snippet = rest.join("\n\n").trim();

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(45, 156, 219, 0.16)" }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-[9px] font-bold leading-none text-white"
            style={{ backgroundColor: "#2D9CDB" }}
          >
            P
          </span>
          Polymarket
        </span>
        {m?.category && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-foreground/80">{m.category}</span>
          </>
        )}
        {endsLabel && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Calendar className="size-3" />
              {endsLabel}
            </span>
          </>
        )}
      </div>
      <h3
        className="mt-1 font-serif text-[16px] leading-[1.3] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand)]"
        style={{ letterSpacing: "-0.005em", fontFeatureSettings: '"cswh" 1' }}
      >
        {title}
      </h3>
      {snippet && (
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground break-words">
          {snippet}
        </p>
      )}
      {top.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {top.map((o, idx) => {
            const pct = formatPct(o.price);
            const leading = isBinary && idx === 0;
            return (
              <span
                key={`${o.label}-${idx}`}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] tabular-nums ring-1"
                style={{
                  backgroundColor: leading
                    ? "rgba(45, 156, 219, 0.18)"
                    : "rgba(148, 163, 184, 0.10)",
                  color: leading ? "#1a6fa3" : undefined,
                  borderColor: "transparent",
                }}
              >
                <span className="font-medium">{o.label}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold">{pct}</span>
              </span>
            );
          })}
          {outcomes.length > top.length && (
            <span className="self-center text-[11px] text-muted-foreground">
              +{outcomes.length - top.length} more
            </span>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <TrendingUp className="size-3.5" />
          <span className="tabular-nums">{formatUsd(volume)}</span>
          <span className="text-muted-foreground/70">24h</span>
        </span>
        <span className="flex items-center gap-1">
          <Droplets className="size-3.5" />
          <span className="tabular-nums">{formatUsd(liquidity)}</span>
          <span className="text-muted-foreground/70">liq</span>
        </span>
      </div>
    </a>
  );
}

export const column = defineColumnUI<PolymarketConfig, PolymarketMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
