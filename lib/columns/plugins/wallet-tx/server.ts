import "server-only";

// Uses Blockscout REST v2 (keyless multi-chain) — see lib/integrations/blockscout.ts.
//
// Blockscout returns ~50 transactions per call. To match the rest of the app's
// 10-per-page pagination, we wrap their cursor with our own composite cursor:
//   { off: number, bs?: string }
// `off` is the offset into the current Blockscout batch; `bs` is Blockscout's
// next_page_params. We slice 10 at a time and only re-fetch a new batch when
// the current one is exhausted.

import { defineColumnServer, type ServerFetcher } from "@/lib/columns/types";
import { fetchAddressTransactions } from "@/lib/integrations/blockscout";
import { PAGE_SIZE } from "@/lib/columns/constants";
import { meta, type WalletTxConfig, type WalletTxMeta } from "./plugin";

interface WalletCursor {
  off: number;
  bs?: string;
}

function decode(cursor?: string): WalletCursor {
  if (!cursor) return { off: 0 };
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<WalletCursor>;
    const off = Number(parsed.off ?? 0);
    return {
      off: Number.isFinite(off) && off >= 0 ? off : 0,
      bs: typeof parsed.bs === "string" ? parsed.bs : undefined,
    };
  } catch {
    return { off: 0 };
  }
}

function encode(c: WalletCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

const fetch: ServerFetcher<WalletTxConfig, WalletTxMeta> = async (config, cursor) => {
  const address = config.address.trim();
  if (!address) return { items: [] };

  const { off, bs } = decode(cursor);
  const batch = await fetchAddressTransactions(config.chain, address, bs);
  const slice = batch.items.slice(off, off + PAGE_SIZE);

  let nextCursor: string | undefined;
  if (off + PAGE_SIZE < batch.items.length) {
    nextCursor = encode({ off: off + PAGE_SIZE, bs });
  } else if (batch.nextCursor) {
    nextCursor = encode({ off: 0, bs: batch.nextCursor });
  }

  return { items: slice, nextCursor };
};

export const server = defineColumnServer<WalletTxConfig, WalletTxMeta>({
  meta,
  fetch,
});
