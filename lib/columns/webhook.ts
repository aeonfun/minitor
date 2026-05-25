// Column alert webhooks: validate an operator-supplied URL and POST a payload
// when alert keywords match newly-fetched items.
//
// This module is environment-agnostic (uses only the global URL / fetch /
// AbortController) so the same validator runs on the server (before persisting
// and before sending) and on the client (live form feedback in the Configure
// dialog). No node-only imports — keep it that way.

export const WEBHOOK_URL_MAX = 2048;
export const WEBHOOK_TIMEOUT_MS = 5000;

export interface WebhookMatch {
  id: string;
  url?: string;
  text: string;
  matchedKeywords: string[];
}

export interface WebhookPayload {
  columnId: string;
  columnTitle: string;
  typeId: string;
  matches: WebhookMatch[];
  timestamp: string;
}

export type WebhookValidation =
  | { ok: true; url: string }
  | { ok: false; reason: string };

// Parse a dotted-quad IPv4 literal into its four octets, or null if `host`
// isn't an IPv4 literal. (A hostname like "example.com" returns null and is
// treated as a public host — DNS-rebinding is a documented limitation below.)
function parseIPv4(host: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const octets = m.slice(1, 5).map((s) => Number(s));
  if (octets.some((o) => o < 0 || o > 255)) return null;
  return octets as [number, number, number, number];
}

function isPrivateIPv4(host: string): boolean {
  const ip = parseIPv4(host);
  if (!ip) return false;
  const [a, b] = ip;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback 127.0.0.0/8
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 169 && b === 254) return true; // link-local 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast / reserved 224.0.0.0+
  return false;
}

// Block obviously-internal IPv6 literals. `URL.hostname` strips the surrounding
// brackets, so we match on the bare address. Conservative: anything we can't
// confidently classify as a public address is rejected.
function isPrivateIPv6(host: string): boolean {
  if (!host.includes(":")) return false;
  const h = host.toLowerCase();
  if (h === "::1" || h === "::") return true; // loopback / unspecified
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique-local fc00::/7
  if (h.startsWith("fe80")) return true; // link-local fe80::/10
  // IPv4-mapped (::ffff:10.0.0.1) — extract the trailing v4 and re-check.
  const mapped = /::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (mapped && isPrivateIPv4(mapped[1])) return true;
  return false;
}

/**
 * Validate an operator-supplied alert-webhook URL. Returns the normalised URL
 * on success, or a human-readable reason on failure.
 *
 * Guards (SSRF): https only; reject localhost and raw IP literals in
 * private/reserved ranges (RFC-1918, loopback, link-local, CGNAT, multicast,
 * and the IPv6 equivalents).
 *
 * Limitation: this blocks IP-literal and localhost targets but does not resolve
 * hostnames, so a public hostname that resolves to an internal address (DNS
 * rebinding) is not caught here. The sender mitigates the redirect vector by
 * refusing to follow redirects (`redirect: "error"`).
 */
export function validateWebhookUrl(raw: string): WebhookValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "URL is empty" };
  if (trimmed.length > WEBHOOK_URL_MAX) {
    return { ok: false, reason: `URL exceeds ${WEBHOOK_URL_MAX} characters` };
  }
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }
  if (u.protocol !== "https:") {
    return { ok: false, reason: "Webhook URL must use https://" };
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "ip6-localhost"
  ) {
    return { ok: false, reason: "localhost is not allowed" };
  }
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) {
    return {
      ok: false,
      reason: "Private / internal network addresses are not allowed",
    };
  }
  return { ok: true, url: u.toString() };
}

/**
 * POST `payload` to `url`. Fire-and-forget semantics: never throws, bounded by
 * WEBHOOK_TIMEOUT_MS, refuses redirects (so an allowed external host can't
 * 30x-bounce into an internal one), and logs success/failure to the server
 * console only — no value is returned, so a caller can't probe endpoints by
 * inspecting responses. Re-validates the URL defensively before sending.
 */
export async function sendColumnWebhook(
  url: string,
  payload: WebhookPayload,
): Promise<void> {
  const check = validateWebhookUrl(url);
  if (!check.ok) {
    console.error(
      `[minitor] webhook skipped for column ${payload.columnId}: ${check.reason}`,
    );
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(check.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "minitor-webhook/1",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "error",
      cache: "no-store",
    });
    if (res.ok) {
      console.log(
        `[minitor] webhook delivered for column ${payload.columnId} (${payload.matches.length} match${payload.matches.length === 1 ? "" : "es"})`,
      );
    } else {
      console.error(
        `[minitor] webhook for column ${payload.columnId} returned ${res.status}`,
      );
    }
  } catch (err) {
    console.error(
      `[minitor] webhook POST failed for column ${payload.columnId}:`,
      err instanceof Error ? err.message : err,
    );
  } finally {
    clearTimeout(timer);
  }
}
