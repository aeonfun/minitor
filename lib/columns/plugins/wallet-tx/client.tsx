"use client";

import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
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
import { defineColumnUI, type ConfigFormProps, type ItemRendererProps } from "@/lib/columns/types";
import { meta, type WalletTxConfig, type WalletTxMeta } from "./plugin";

const CHAIN_OPTIONS: { value: WalletTxConfig["chain"]; label: string }[] = [
  { value: "ethereum", label: "Ethereum" },
  { value: "base", label: "Base" },
  { value: "optimism", label: "Optimism" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "polygon", label: "Polygon" },
  { value: "gnosis", label: "Gnosis" },
  { value: "scroll", label: "Scroll" },
  { value: "celo", label: "Celo" },
  { value: "zksync", label: "zkSync" },
];

function shortHash(h: string, head = 6, tail = 4): string {
  if (!h) return "";
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

function formatUsd(n: number): string {
  if (n < 0.01) return "<$0.01";
  if (n < 1000) return `$${n.toFixed(2)}`;
  if (n < 1_000_000) return `$${(n / 1000).toFixed(n < 10_000 ? 2 : 1)}k`;
  return `$${(n / 1_000_000).toFixed(2)}M`;
}

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function ConfigForm({ value, onChange }: ConfigFormProps<WalletTxConfig>) {
  const trimmed = value.address.trim();
  const showError = trimmed.length > 0 && !ADDR_RE.test(trimmed);

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>Chain</Label>
        <Select
          value={value.chain}
          onValueChange={(v) => onChange({ ...value, chain: v as WalletTxConfig["chain"] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHAIN_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="wallet-tx-addr">Wallet address</Label>
        <Input
          id="wallet-tx-addr"
          placeholder="0x…"
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-invalid={showError || undefined}
        />
        <p className="text-xs text-muted-foreground">
          {showError ? (
            <span className="text-[color:var(--destructive,#c0392b)]">
              EVM address must be <code>0x</code>-prefixed and 42 characters.
            </span>
          ) : (
            <>
              EVM address — 42 characters, starts with <code>0x</code>.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function ItemRenderer({ item }: ItemRendererProps<WalletTxMeta>) {
  const m = item.meta;
  if (!m) return null;
  const fromShort = shortHash(m.from);
  const toShort = m.to ? shortHash(m.to) : "—";
  const isFailed = m.status === "failed";
  const isOutgoing = item.author.handle?.toLowerCase() === m.from.toLowerCase();
  const DirectionIcon = isOutgoing ? ArrowUpRight : ArrowDownLeft;

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
          style={{ backgroundColor: "rgba(98, 126, 234, 0.18)" }}
        >
          <Wallet className="size-3" />
          {shortHash(m.hash, 6, 4)}
        </span>
        {m.method && (
          <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-foreground/80">
            {m.method}
          </span>
        )}
        {isFailed && (
          <span
            className="rounded-full px-1.5 py-0.5 font-medium text-foreground ring-1 ring-black/5"
            style={{ backgroundColor: "rgba(192, 57, 43, 0.18)" }}
          >
            failed
          </span>
        )}
        <span className="text-muted-foreground/50">·</span>
        <span className="tabular-nums">
          <RelativeTime date={item.createdAt} addSuffix />
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-foreground">
        <DirectionIcon className={`size-4 ${isOutgoing ? "text-rose-500" : "text-emerald-500"}`} />
        <span className="font-mono text-foreground/80">{fromShort}</span>
        <span className="text-muted-foreground/60">→</span>
        <span className="font-mono text-foreground/80">{toShort}</span>
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className={`font-serif text-[16px] leading-tight tabular-nums ${
            isFailed ? "text-muted-foreground line-through" : "text-foreground"
          }`}
          style={{ letterSpacing: "-0.005em" }}
        >
          {item.content}
        </span>
        {typeof m.valueUsd === "number" && m.valueUsd > 0 && (
          <span className="text-[11.5px] text-muted-foreground tabular-nums">
            ≈ {formatUsd(m.valueUsd)}
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground/70 tabular-nums">
          #{m.blockNumber.toLocaleString()}
        </span>
      </div>
    </a>
  );
}

export const column = defineColumnUI<WalletTxConfig, WalletTxMeta>({
  ...meta,
  ConfigForm,
  ItemRenderer,
});
