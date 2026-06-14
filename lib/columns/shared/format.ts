// Shared numeric formatters for crypto/market plugin renderers.

/**
 * Format a USD price for a market row. Five bands by magnitude:
 *   - non-finite / non-positive → "$0"
 *   - ≥ 1000 → no decimals (thousands grouping)
 *   - ≥ 1    → up to 2 decimals
 *   - ≥ 0.01 → fixed 4 decimals
 *   - sub-cent → 3 significant figures with trailing zeros dropped, so a
 *     micro-cap price like $0.0000234 doesn't render as $0.00002340.
 *
 * Used identically by the coingecko and dexscreener renderers. NOTE: this is
 * deliberately distinct from polymarket/wallet-tx `formatUsd`, which round
 * differently on purpose — don't fold those in here.
 */
export function formatPriceUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3).replace(/0+$/, "").replace(/\.$/, "")}`;
}
