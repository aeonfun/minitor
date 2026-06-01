"use client";

import { Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";
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
import { meta, type CoingeckoConfig, type CoingeckoMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<CoingeckoConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as CoingeckoConfig["mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trending">
              Trending — top searches (24h)
            </SelectItem>
            <SelectItem value="top">Top by market cap</SelectItem>
            <SelectItem value="watchlist">Watchlist — custom ids</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          <strong>Trending</strong> reads CoinGecko&apos;s 24h search-volume
          leaderboard (fixed 7-coin window).{" "}
          <strong>Top</strong> reads the market-cap leaderboard with full
          pagination. <strong>Watchlist</strong> shows the coins you list below.
        </p>
      </div>
      {value.mode === "watchlist" && (
        <div className="grid gap-1.5">
          <Label htmlFor="cg-watchlist">CoinGecko ids</Label>
          <Input
            id="cg-watchlist"
            placeholder="bitcoin, ethereum, solana, aeon-2…"
            value={value.watchlist}
            onChange={(e) => onChange({ ...value, watchlist: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Comma-, semicolon-, or space-separated. Use CoinGecko ids (lowercase
            slugs), not tickers — e.g. <code>bitcoin</code> not{" "}
            <code>BTC</code>. Find the id in the URL on coingecko.com.
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Keyless by default. For higher rate limits, set{" "}
        <code>COINGECKO_DEMO_API_KEY</code> in Settings · API keys (the free
        Demo plan is fine).
      </p>
    </div>
  );
}

function formatPriceUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  // Sub-cent prices need more precision — drop trailing zeros so a $0.0010
  // doesn't render as `$0.001000`.
  return `$${n.toPrecision(3).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  // Degenerate cases (all-equal prices over the window) draw a flat line
  // through the vertical centre instead of dividing by zero.
  if (range === 0) {
    return (
      <svg
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        className="h-4 w-20 text-muted-foreground/60"
        aria-hidden="true"
      >
        <line x1="0" y1="12" x2="100" y2="12" stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 24 - ((v - min) / range) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const trendingUp = values[values.length - 1] >= values[0];
  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className="h-4 w-20"
      aria-hidden="true"
      style={{ color: trendingUp ? "#10b981" : "#ef4444" }}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ItemRenderer({ item }: ItemRendererProps<CoingeckoMeta>) {
  const m = item.meta;
  const symbol = m?.symbol ?? "";
  const priceUsd = m?.priceUsd ?? 0;
  const pct = m?.priceChange24h ?? 0;
  const marketCap = m?.marketCapUsd ?? 0;
  const volume = m?.volume24hUsd ?? 0;
  const rank = m?.marketCapRank;
  const sparkline = m?.sparkline7d ?? [];
  const imageUrl = m?.imageUrl;
  const name = item.content;
  const up = pct >= 0;

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(141, 198, 71, 0.18)" }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-white"
            style={{ backgroundColor: "#8DC647" }}
          >
            <Activity className="size-2.5" strokeWidth={3} />
          </span>
          CoinGecko
        </span>
        {typeof rank === "number" && rank > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums text-muted-foreground/90">
              #{rank}
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
        className="mt-1 flex items-center gap-2"
      >
        {imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={symbol}
              width={20}
              height={20}
              className="size-5 rounded-full ring-1 ring-border/60"
              loading="lazy"
            />
          </>
        )}
        <h3
          className="font-mono text-[14px] leading-[1.25] text-foreground break-words transition-colors group-hover/item:text-[color:var(--brand)]"
          style={{ letterSpacing: "-0.005em" }}
        >
          {name}
        </h3>
      </a>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="tabular-nums text-foreground/90">
          {formatPriceUsd(priceUsd)}
        </span>
        <span
          className="inline-flex items-center gap-0.5 tabular-nums"
          style={{ color: up ? "#10b981" : "#ef4444" }}
        >
          {up ? (
            <ArrowUpRight className="size-3" />
          ) : (
            <ArrowDownRight className="size-3" />
          )}
          {pct.toFixed(2)}%
        </span>
        {sparkline.length > 1 && <Sparkline values={sparkline} />}
        {marketCap > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span>
              MC <span className="tabular-nums">${formatCompactCount(marketCap)}</span>
            </span>
          </>
        )}
        {volume > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span>
              Vol{" "}
              <span className="tabular-nums">${formatCompactCount(volume)}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export const column = defineColumnUI<CoingeckoConfig, CoingeckoMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
