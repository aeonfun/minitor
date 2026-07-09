import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image — copies only the traced
  // files + node_modules into `.next/standalone`, so the runtime image stays
  // small and needs no `npm install`. Harmless for `next start` / Vercel.
  output: "standalone",
  // PGlite ships a WASM binary that the server bundler must leave external.
  // pg uses native bindings the same way. `@neondatabase/serverless` is kept
  // external too so all three DB drivers land in `.next/standalone/node_modules`
  // — the standalone migration step (`scripts/db-migrate.mjs`) dynamically
  // imports whichever one `DATABASE_URL` selects, and can't if it was inlined.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pg",
    "pg-native",
    "@neondatabase/serverless",
  ],
};

export default nextConfig;
