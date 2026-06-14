"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/**
 * Inline percent-change pill used by the crypto/market renderers (coingecko,
 * dexscreener, defillama). A green up-arrow for non-negative change, a red
 * down-arrow otherwise, followed by the value to two decimals + "%".
 *
 * Excludes wallet-tx's ArrowUpRight, which is a tx-direction icon, not this
 * pill — don't reuse this there.
 */
export function PctChangePill({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 tabular-nums"
      style={{ color: up ? "#10b981" : "#ef4444" }}
    >
      {up ? (
        <ArrowUpRight className="size-3" />
      ) : (
        <ArrowDownRight className="size-3" />
      )}
      {value.toFixed(2)}%
    </span>
  );
}
