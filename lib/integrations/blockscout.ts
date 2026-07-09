import { fetchUpstream } from "@/lib/integrations/fetch";
import type { FeedItem } from "@/lib/columns/types";
import type { WalletTxMeta } from "@/lib/columns/plugins/wallet-tx/plugin";
import { identiconUrl } from "@/lib/utils";

// `WalletTxMeta` is the plugin/renderer contract; the fetcher here produces
// `FeedItem<WalletTxMeta>` so its meta lines up with what the wallet-tx
// renderer reads. Re-exported here so call sites that grab WalletTxMeta from
// the integration keep working.
export type { WalletTxMeta };

// Multi-chain Blockscout REST v2 client. Keyless by default. If
// `BLOCKSCOUT_API_KEY` is set, it's appended as `?apikey=` to every request
// (Blockscout's Pro tier accepts the same param across all instances), which
// raises rate limits without changing call sites.

export const SUPPORTED_CHAINS = [
  "ethereum",
  "base",
  "optimism",
  "arbitrum",
  "polygon",
  "gnosis",
  "scroll",
  "celo",
  "zksync",
] as const;

export type Chain = (typeof SUPPORTED_CHAINS)[number];

interface ChainInfo {
  chainId: number;
  host: string;
  nativeSymbol: string;
  label: string;
}

const CHAINS: Record<Chain, ChainInfo> = {
  ethereum: { chainId: 1, host: "eth.blockscout.com", nativeSymbol: "ETH", label: "Ethereum" },
  base: { chainId: 8453, host: "base.blockscout.com", nativeSymbol: "ETH", label: "Base" },
  optimism: { chainId: 10, host: "optimism.blockscout.com", nativeSymbol: "ETH", label: "Optimism" },
  arbitrum: { chainId: 42161, host: "arbitrum.blockscout.com", nativeSymbol: "ETH", label: "Arbitrum" },
  polygon: { chainId: 137, host: "polygon.blockscout.com", nativeSymbol: "POL", label: "Polygon" },
  gnosis: { chainId: 100, host: "gnosis.blockscout.com", nativeSymbol: "xDAI", label: "Gnosis" },
  scroll: { chainId: 534352, host: "scroll.blockscout.com", nativeSymbol: "ETH", label: "Scroll" },
  celo: { chainId: 42220, host: "celo.blockscout.com", nativeSymbol: "CELO", label: "Celo" },
  zksync: { chainId: 324, host: "zksync.blockscout.com", nativeSymbol: "ETH", label: "zkSync" },
};

export function explorerTxUrl(chain: Chain, hash: string): string {
  return `https://${CHAINS[chain].host}/tx/${hash}`;
}

interface BSAddressRef {
  hash?: string;
  name?: string | null;
  is_contract?: boolean;
}

interface BSTokenInfo {
  symbol?: string | null;
  decimals?: string | null;
  exchange_rate?: string | null;
}

interface BSTokenTransfer {
  from?: BSAddressRef;
  to?: BSAddressRef;
  total?: { value?: string | null; decimals?: string | null };
  token?: BSTokenInfo;
}

interface BSTransaction {
  hash: string;
  from?: BSAddressRef;
  to?: BSAddressRef | null;
  value?: string | null;
  fee?: { value?: string | null } | null;
  gas_used?: string | null;
  block_number?: number | null;
  block?: number | null;
  status?: string | null;
  result?: string | null;
  method?: string | null;
  timestamp?: string | null;
  tx_types?: string[];
  transaction_types?: string[];
  exchange_rate?: string | null;
  token_transfers?: BSTokenTransfer[];
}

interface BSResponse<T> {
  items?: T[];
  next_page_params?: Record<string, unknown> | null;
  message?: string;
}

const EVM_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

export function isValidEvmAddress(addr: string): boolean {
  return EVM_ADDR_RE.test(addr.trim());
}

function buildUrl(
  chain: Chain,
  path: string,
  params?: Record<string, string>,
): string {
  const url = new URL(`https://${CHAINS[chain].host}/api/v2${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const key = process.env.BLOCKSCOUT_API_KEY;
  if (key) url.searchParams.set("apikey", key);
  return url.toString();
}

export function encodeCursor(next: Record<string, unknown> | null | undefined): string | undefined {
  if (!next || Object.keys(next).length === 0) return undefined;
  const json = JSON.stringify(next);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor(cursor?: string): Record<string, string> | undefined {
  if (!cursor) return undefined;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === null || v === undefined) continue;
      out[k] = String(v);
    }
    return out;
  } catch {
    return undefined;
  }
}

function formatUnits(raw: string, decimals: number): string {
  const negative = raw.startsWith("-");
  const digits = (negative ? raw.slice(1) : raw).replace(/^0+/, "") || "0";
  if (decimals === 0) return (negative ? "-" : "") + digits;
  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, "");
  const sign = negative ? "-" : "";
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

function trimDecimals(value: string, maxFrac = 6): string {
  const [whole, frac] = value.split(".");
  if (!frac) return whole;
  const trimmed = frac.slice(0, maxFrac).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

function pickValueDisplay(
  tx: BSTransaction,
  nativeSymbol: string,
): { display: string; symbol: string; rawWei: string; rate?: number } {
  const valueWei = tx.value && tx.value !== "0" ? tx.value : null;
  if (valueWei) {
    const human = formatUnits(valueWei, 18);
    const rate = parseFloatOrUndef(tx.exchange_rate);
    return {
      display: trimDecimals(human, 6),
      symbol: nativeSymbol,
      rawWei: valueWei,
      rate,
    };
  }

  const transfer = tx.token_transfers?.[0];
  if (transfer?.total?.value && transfer.token) {
    const decimals = Number(transfer.total.decimals ?? transfer.token.decimals ?? "18") || 0;
    const symbol = transfer.token.symbol ?? "TOKEN";
    const display = trimDecimals(formatUnits(transfer.total.value, decimals), 6);
    const rate = parseFloatOrUndef(transfer.token.exchange_rate);
    return { display, symbol, rawWei: transfer.total.value, rate };
  }

  return { display: "0", symbol: nativeSymbol, rawWei: "0" };
}

function parseFloatOrUndef(s?: string | null): number | undefined {
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function statusFrom(tx: BSTransaction): "success" | "failed" {
  const s = (tx.status ?? tx.result ?? "").toString().toLowerCase();
  if (s === "ok" || s === "success") return "success";
  if (s === "error" || s === "failed" || s === "fail") return "failed";
  return "success";
}

export async function fetchAddressTransactions(
  chain: Chain,
  address: string,
  cursor?: string,
): Promise<{ items: FeedItem<WalletTxMeta>[]; nextCursor?: string }> {
  if (!isValidEvmAddress(address)) {
    throw new Error(
      `Invalid address "${address}". Expected a 0x-prefixed 42-character EVM address.`,
    );
  }
  const info = CHAINS[chain];
  const params = decodeCursor(cursor);
  const url = buildUrl(chain, `/addresses/${address}/transactions`, params);

  const res = await fetchUpstream(url, {
    headers: { accept: "application/json", "user-agent": "minitor/0.1" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Blockscout ${info.host} ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as BSResponse<BSTransaction>;
  if (json.message && !json.items) {
    throw new Error(`Blockscout ${info.host}: ${json.message}`);
  }

  const items = (json.items ?? []).map((tx): FeedItem<WalletTxMeta> => {
    const value = pickValueDisplay(tx, info.nativeSymbol);
    const valueNum = Number(value.display);
    const valueUsd =
      value.rate !== undefined && Number.isFinite(valueNum) && valueNum > 0
        ? valueNum * value.rate
        : undefined;
    const status = statusFrom(tx);
    const blockNumber = tx.block_number ?? tx.block ?? 0;
    const fromAddr = tx.from?.hash ?? "";
    const toAddr = tx.to?.hash ?? "";
    const methodRaw = tx.method?.trim() || undefined;
    const method = methodRaw ?? inferMethodLabel(tx, address, fromAddr);

    return {
      id: `${info.chainId}-${tx.hash}`,
      author: {
        name: shortAddress(fromAddr || address),
        handle: fromAddr || address,
        avatarUrl: identiconUrl(fromAddr || address),
      },
      content: `${value.display} ${value.symbol}`,
      url: explorerTxUrl(chain, tx.hash),
      createdAt: tx.timestamp ?? new Date().toISOString(),
      meta: {
        chainId: info.chainId,
        hash: tx.hash,
        from: fromAddr,
        to: toAddr,
        value: `${value.display} ${value.symbol}`,
        valueUsd,
        method,
        status,
        blockNumber,
        gasUsed: tx.gas_used ?? undefined,
      },
    };
  });

  return {
    items,
    nextCursor: encodeCursor(json.next_page_params ?? undefined),
  };
}

function shortAddress(addr: string): string {
  if (!addr) return "unknown";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function inferMethodLabel(
  tx: BSTransaction,
  watched: string,
  from: string,
): string | undefined {
  const types = tx.tx_types ?? tx.transaction_types ?? [];
  if (types.includes("token_transfer")) return "Token transfer";
  if (types.includes("coin_transfer")) {
    return from.toLowerCase() === watched.toLowerCase() ? "Send" : "Receive";
  }
  if (types.includes("contract_call")) return "Contract call";
  if (types.includes("contract_creation")) return "Contract creation";
  return undefined;
}
