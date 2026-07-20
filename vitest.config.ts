import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const emptyModule = fileURLToPath(
  new URL("./test/stubs/empty-module.ts", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: [
      // Mirror the `@/*` path alias from tsconfig.json.
      { find: /^@\//, replacement: `${root}` },
      // Neutralize the RSC marker packages (see test/stubs/empty-module.ts).
      { find: /^server-only$/, replacement: emptyModule },
      { find: /^client-only$/, replacement: emptyModule },
    ],
  },
  test: {
    // Node stays the default so the existing suites keep their fast, DOM-free
    // environment. Component tests opt in per file with a
    // `@vitest-environment jsdom` docblock.
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    // Only loaded for jsdom runs — see the guard inside the file.
    setupFiles: ["./test/setup-dom.ts"],
    // The DB-backed round-trip test builds an isolated in-memory PGlite from
    // this URL. Every other test ignores it.
    env: { DATABASE_URL: "memory://" },
  },
});
