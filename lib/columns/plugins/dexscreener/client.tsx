"use client";

import { CandlestickChart } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { formatPriceUsd } from "@/lib/columns/shared/format";
import { PctChangePill } from "@/lib/columns/shared/pct-change-pill";
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
import { meta, type DexscreenerConfig, type DexscreenerMeta } from "./plugin";

const ACCENT = "#a45cff";

function ConfigForm({ value, onChange }: ConfigFormProps<DexscreenerConfig>) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as DexscreenerConfig["mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="search">Search — symbol, name, or address</SelectItem>
            <SelectItem value="watchlist">Watchlist — contract addresses</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          <strong>Search</strong> queries every chain at once and shows the most
          active matching pairs. <strong>Watchlist</strong> tracks specific token
          contracts and lists every pair they trade in.
        </p>
      </div>
      {value.mode === "search" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="dex-query">Query</Label>
          <Input
            id="dex-query"
            placeholder="AEON, wif, 0xbf8e…"
            value={value.query}
            onChange={(e) => onChange({ ...value, query: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            A ticker (<code>AEON</code>), a token name, or a contract address.
            Pairs are ranked by 24h volume.
          </p>
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="dex-watchlist">Contract addresses</Label>
          <Input
            id="dex-watchlist"
            placeholder="0xbf8e…, 0x4200…"
            value={value.watchlist}
            onChange={(e) => onChange({ ...value, watchlist: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Comma-, semicolon-, or space-separated token contract addresses (up
            to 30). Every pair across every chain those tokens trade in is shown.
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Keyless — no API key required.
      </p>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<DexscreenerMeta>) {
  const m = item.meta;
  const pair = item.content;
  const priceUsd = m?.priceUsd ?? 0;
  const pct = m?.priceChange24h ?? 0;
  const volume = m?.volume24hUsd ?? 0;
  const liquidity = m?.liquidityUsd ?? 0;
  const chainId = m?.chainId ?? "";
  const dexId = m?.dexId ?? "";
  const baseName = m?.baseName;
  const imageUrl = m?.imageUrl;
  const txns = m?.txns24h;

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(164, 92, 255, 0.18)" }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-white"
            style={{ backgroundColor: ACCENT }}
          >
            <CandlestickChart className="size-2.5" strokeWidth={3} />
          </span>
          Dexscreener
        </span>
        {chainId && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="capitalize text-muted-foreground/90">{chainId}</span>
          </>
        )}
        {dexId && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="capitalize text-muted-foreground/90">{dexId}</span>
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
              alt={m?.baseSymbol ?? pair}
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
          {pair}
        </h3>
        {baseName && (
          <span className="truncate text-[11px] text-muted-foreground">
            {baseName}
          </span>
        )}
      </a>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="tabular-nums text-foreground/90">
          {formatPriceUsd(priceUsd)}
        </span>
        <PctChangePill value={pct} />
        {liquidity > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span>
              Liq{" "}
              <span className="tabular-nums">${formatCompactCount(liquidity)}</span>
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
        {txns && txns.buys + txns.sells > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums">
              <span style={{ color: "#10b981" }}>{formatCompactCount(txns.buys)}</span>
              <span className="text-muted-foreground/50">/</span>
              <span style={{ color: "#ef4444" }}>{formatCompactCount(txns.sells)}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export const column = defineColumnUI<DexscreenerConfig, DexscreenerMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
