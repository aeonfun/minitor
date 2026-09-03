import { readFile, readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const rawUrl = (process.env.DATABASE_URL ?? "").trim();
const ROOT = join(__dirname, "..");
const MIGRATION_DIR = join(ROOT, "drizzle");
const LOCAL_PGLITE_DIR = join(ROOT, ".minitor", "pgdata");

function resolveKind(url) {
  // `memory:` is an ephemeral in-memory database — kept distinct from the
  // file-backed pglite branch below so migrations don't silently write to disk.
  if (url.startsWith("memory:")) return "memory";
  if (!url || url.startsWith("pglite:") || url.startsWith("file:")) {
    return "pglite";
  }
  try {
    const host = new URL(url).hostname;
    if (host.endsWith("neon.tech") || host.endsWith("neon.build")) return "neon";
  } catch {}
  return "postgres";
}

const kind = resolveKind(rawUrl);

// An in-memory database evaporates when this process exits, so migrating it from
// a standalone script would persist nothing — the app that later opens `memory:`
// gets a fresh, empty database. The schema is instead created in-process by
// whatever opens the DB (e.g. the test suite migrates its own in-memory
// instance). Skip cleanly rather than writing tables to `.minitor/pgdata`, which
// the in-memory runtime would never read.
if (kind === "memory") {
  console.log(
    "DATABASE_URL is memory:// (ephemeral in-memory) — nothing to migrate; skipping.\n" +
      "Unset DATABASE_URL, or use pglite:/file:, for a persistent local database.",
  );
  process.exit(0);
}

const files = (await readdir(MIGRATION_DIR)).filter((f) => f.endsWith(".sql")).sort();

if (files.length === 0) {
  console.log("No migration files found in ./drizzle");
  process.exit(0);
}

let runStatement;
let cleanup = async () => {};

if (kind === "pglite") {
  const { PGlite } = await import("@electric-sql/pglite");
  await mkdir(LOCAL_PGLITE_DIR, { recursive: true });
  const client = new PGlite(LOCAL_PGLITE_DIR);
  runStatement = (stmt) => client.exec(stmt);
  cleanup = () => client.close();
  console.log(`Using PGlite at ${LOCAL_PGLITE_DIR}`);
} else if (kind === "neon") {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(rawUrl);
  runStatement = (stmt) => sql.query(stmt);
  console.log(`Using Neon HTTP driver`);
} else {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: rawUrl });
  await client.connect();
  runStatement = (stmt) => client.query(stmt);
  cleanup = () => client.end();
  console.log(`Using node-postgres`);
}

try {
  for (const file of files) {
    const full = join(MIGRATION_DIR, file);
    const contents = await readFile(full, "utf8");
    console.log(`\n--- Applying ${file} ---`);
    const statements = contents
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      process.stdout.write(`  • ${stmt.split("\n")[0].slice(0, 80)}... `);
      try {
        await runStatement(stmt);
        console.log("ok");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already exists")) {
          console.log("already exists");
        } else {
          console.log("FAILED");
          console.error(msg);
          process.exitCode = 1;
          break;
        }
      }
    }
    if (process.exitCode) break;
  }
  if (!process.exitCode) console.log("\nDone.");
} finally {
  await cleanup();
}
