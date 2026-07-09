// Hosted-deployment flags. Two views of the same intent:
//
//   - `isHostedDeployment()` reads the server-only `MINITOR_HOSTED` env var and
//     is the AUTHORITATIVE gate — used by the `setEnvKeys` server action to
//     refuse runtime key writes on a hosted instance (where the filesystem is
//     often read-only and, more importantly, the UI must not double as a
//     "write arbitrary API keys" panel behind the password gate).
//
//   - `IS_HOSTED_CLIENT` is the client-visible mirror, inlined at build time
//     from `NEXT_PUBLIC_MINITOR_HOSTED`. The Docker image bakes this to `1`, so
//     the Settings dialog can render read-only and explain where keys live.
//     It's a UX hint only; security lives in the server gate above.
//
// Both default to false, so a normal `./minitor` dev run is unaffected.

export function isHostedDeployment(): boolean {
  const v = process.env.MINITOR_HOSTED;
  return v === "1" || v === "true";
}

export const IS_HOSTED_CLIENT =
  process.env.NEXT_PUBLIC_MINITOR_HOSTED === "1" ||
  process.env.NEXT_PUBLIC_MINITOR_HOSTED === "true";
