"use client";

import { Layers, ArrowDownRight, ArrowUpRight } from "lucide-react";
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
import { meta, type DefillamaConfig, type DefillamaMeta } from "./plugin";

function ConfigForm({ value, onChange }: ConfigFormProps<DefillamaConfig>) {
  const chainsMode = value.mode === "chains";
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Mode</Label>
        <Select
          value={value.mode}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as DefillamaConfig["mode"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Top protocols — by TVL</SelectItem>
            <SelectItem value="gainers">24h gainers — top % up</SelectItem>
            <SelectItem value="chains">Chains — by TVL</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          <strong>Top</strong> is the protocol leaderboard sorted by TVL.{" "}
          <strong>Gainers</strong> re-sorts by 24h TVL change with absolute
          TVL as tiebreaker. <strong>Chains</strong> aggregates TVL per chain
          instead of per protocol.
        </p>
      </div>
      {!chainsMode && (
        <div className="grid gap-1.5">
          <Label htmlFor="dl-category">Category filter (optional)</Label>
          <Input
            id="dl-category"
            placeholder="Dexs, Lending, Liquid Staking, Restaking, CDP, Yield…"
            value={value.category}
            onChange={(e) => onChange({ ...value, category: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Substring match against DeFiLlama&apos;s category names (e.g.{" "}
            <code>lending</code> matches both <code>Lending</code> and{" "}
            <code>Cross-Chain Lending</code>). Leave empty to see every
            category.
          </p>
        </div>
      )}
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<DefillamaMeta>) {
  const m = item.meta;
  const tvl = m?.tvlUsd ?? 0;
  const pct = m?.tvlChange24h ?? 0;
  const pct7d = m?.tvlChange7d;
  const cat = m?.category;
  const chains = m?.chains;
  const mcap = m?.marketCapUsd;
  const imageUrl = m?.imageUrl;
  const name = item.content;
  const up = pct >= 0;
  const isChain = m?.kind === "chain";

  return (
    <div className="group/item block border-b border-border px-3.5 py-3 transition-colors hover:bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
        <span
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
          style={{ backgroundColor: "rgba(68, 94, 208, 0.16)" }}
        >
          <span
            className="grid size-3.5 place-items-center rounded-[3px] text-white"
            style={{ backgroundColor: "#445ed0" }}
          >
            <Layers className="size-2.5" strokeWidth={3} />
          </span>
          DeFiLlama
        </span>
        {cat && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground/90">{cat}</span>
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
              alt={m?.symbol ?? name}
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
          TVL ${formatCompactCount(tvl)}
        </span>
        {!isChain && (
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
        )}
        {!isChain && typeof pct7d === "number" && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums">
              7d {pct7d >= 0 ? "+" : ""}
              {pct7d.toFixed(1)}%
            </span>
          </>
        )}
        {mcap && mcap > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span>
              MC{" "}
              <span className="tabular-nums">${formatCompactCount(mcap)}</span>
            </span>
          </>
        )}
        {!isChain && chains && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="line-clamp-1">{chains}</span>
          </>
        )}
      </div>
    </div>
  );
}

export const column = defineColumnUI<DefillamaConfig, DefillamaMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
