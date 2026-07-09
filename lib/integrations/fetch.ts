// Shared upstream fetch helper for every integration in this folder.
//
// Wraps the global `fetch` with three things every plugin needs but none
// implemented on its own:
//   1. A per-request timeout (AbortSignal) so one hung upstream can't pin an
//      API route open for the full `maxDuration` (60s).
//   2. Bounded retries with jittered exponential backoff on transient
//      failures — HTTP 429 / 408 / 5xx, plus network errors.
//   3. Honouring `Retry-After` on 429, and surfacing an exhausted rate-limit
//      as a clear "rate-limited — retry in Ns" error instead of a generic
//      "<Source> 429".
//
// It is a near drop-in for `fetch`: same (input, init) call shape, returns the
// real `Response`. Behaviour only diverges from raw `fetch` for the two cases
// worth diverging on — it THROWS an `UpstreamError` on a timeout/network
// failure that outlives the retries, and on a terminal 429. Every other
// response (including a non-retryable 4xx and a 5xx that survived its retries)
// is returned unchanged, so each integration keeps its own source-specific
// `!res.ok` error message.
//
// Pure ESM + web APIs only (fetch / AbortSignal) — no node-only imports and no
// "server-only" marker, so the retry/backoff logic stays unit-testable.

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_RETRIES = 2;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;
// Longest we'll actually sleep-then-retry on a `Retry-After`. A server asking
// us to wait longer than this is surfaced to the operator immediately ("retry
// in Ns") rather than blocking the request — a 120s wait would just time the
// whole route out anyway.
const MAX_RETRY_AFTER_SLEEP_MS = 15_000;

export interface FetchUpstreamOptions {
  /** Per-attempt timeout in ms. Default {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Extra attempts after the first. Default {@link DEFAULT_RETRIES}. */
  retries?: number;
  /** Label used in error messages. Defaults to the request URL's hostname. */
  label?: string;
}

/**
 * Thrown when a request outlives its retries on a transient failure — a
 * timeout, a network error, or a terminal 429. Non-retryable and
 * retries-exhausted-5xx responses are returned to the caller instead, so a
 * `catch` for this type only ever sees the "give up and tell the operator"
 * cases.
 */
export class UpstreamError extends Error {
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly isTimeout: boolean;
  constructor(
    message: string,
    opts: { status?: number; retryAfterMs?: number; isTimeout?: boolean } = {},
  ) {
    super(message);
    this.name = "UpstreamError";
    this.status = opts.status;
    this.retryAfterMs = opts.retryAfterMs;
    this.isTimeout = opts.isTimeout ?? false;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

/**
 * Parse an HTTP `Retry-After` header into milliseconds. Accepts either a
 * delta-seconds integer ("120") or an HTTP-date. Returns `undefined` when the
 * header is absent or unparseable. `now` is injectable for deterministic tests.
 */
export function parseRetryAfterMs(
  header: string | null,
  now: number = Date.now(),
): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - now);
  }
  return undefined;
}

function backoffMs(attempt: number): number {
  const ceiling = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  // Full jitter over [ceiling/2, ceiling] — spreads a thundering herd without
  // ever waiting less than half the nominal backoff.
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

function labelFor(input: string | URL, explicit?: string): string {
  if (explicit) return explicit;
  try {
    return new URL(typeof input === "string" ? input : input.toString())
      .hostname;
  } catch {
    return "upstream";
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("Aborted"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Drop-in-ish replacement for `fetch` used by every integration. See the file
 * header for the full contract. Returns the raw `Response` for the caller's own
 * `!res.ok` handling; throws {@link UpstreamError} on a timeout / network
 * failure that survives the retries, and on a terminal 429.
 */
export async function fetchUpstream(
  input: string | URL,
  init?: RequestInit,
  opts: FetchUpstreamOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const label = labelFor(input, opts.label);
  const callerSignal = init?.signal ?? undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // A fresh timeout per attempt so a retry gets its own full budget.
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, timeoutSignal])
      : timeoutSignal;

    let res: Response;
    try {
      res = await fetch(input, { ...init, signal });
    } catch (err) {
      // Caller cancelled — propagate their intent as-is, never retry it away.
      if (callerSignal?.aborted) throw err;
      const timedOut = timeoutSignal.aborted;
      if (attempt < retries) {
        await sleep(backoffMs(attempt), callerSignal);
        continue;
      }
      throw new UpstreamError(
        timedOut
          ? `${label} timed out after ${timeoutMs}ms`
          : `${label} request failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
        { isTimeout: timedOut },
      );
    }

    if (res.ok) return res;

    if (isRetryableStatus(res.status)) {
      const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
      const canRetry =
        attempt < retries &&
        (retryAfterMs === undefined ||
          retryAfterMs <= MAX_RETRY_AFTER_SLEEP_MS);
      if (canRetry) {
        // Discard the unconsumed body so the connection can be reused.
        await res.body?.cancel().catch(() => {});
        await sleep(retryAfterMs ?? backoffMs(attempt), callerSignal);
        continue;
      }
      if (res.status === 429) {
        const secs = Math.ceil(
          (retryAfterMs ?? backoffMs(attempt)) / 1000,
        );
        await res.body?.cancel().catch(() => {});
        throw new UpstreamError(
          `${label} is rate-limited — retry in ${secs}s`,
          { status: 429, retryAfterMs },
        );
      }
    }

    // Non-retryable status, or a 5xx that exhausted its retries. Hand the
    // Response back so the integration surfaces its own error message.
    return res;
  }

  // Unreachable — the loop always returns or throws — but keeps the type honest.
  throw new UpstreamError(`${label} request failed`);
}
