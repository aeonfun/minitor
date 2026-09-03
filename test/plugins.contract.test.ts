import { describe, it, expect } from "vitest";
import { PLUGIN_METAS } from "@/lib/columns/plugins/manifest";
import type { PluginMeta } from "@/lib/columns/types";

// `PLUGIN_METAS` is a heterogeneous tuple — each entry has its own concrete
// TConfig, so the inferred union makes strongly-typed members like
// `defaultTitle(config)` collapse to a `never` parameter. Erase to the common
// config-agnostic shape for iteration; every field we touch (schema,
// defaultConfig, defaultTitle) is config-opaque at this altitude anyway.
const METAS = PLUGIN_METAS as unknown as ReadonlyArray<
  PluginMeta<Record<string, unknown>, unknown>
>;

// The plugin system's whole "copy `_template/` to add a source" promise rests on
// every registered plugin honouring the same declarative contract. The
// server-registry parity check guards *registration* (is the id wired into both
// registries) but nothing guards *behaviour* — that each schema is self-
// consistent and each title function is total. These tests are that guard: they
// fail loudly the moment a new (or edited) plugin ships a schema whose defaults
// don't validate, or a `defaultTitle` that throws.

const CATEGORIES = new Set(["ai", "social", "news", "video", "blockchain", "other"]);

describe("plugin contract", () => {
  it("registers at least the documented set of plugins", () => {
    // Sanity floor — catches an accidentally-empty manifest import.
    expect(METAS.length).toBeGreaterThanOrEqual(40);
  });

  it("has unique, non-empty, kebab-case ids", () => {
    const ids = METAS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id, "id must be non-empty").not.toBe("");
      expect(id, `id "${id}" must be kebab-case`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  for (const meta of METAS) {
    describe(`plugin: ${meta.id}`, () => {
      it("has coherent presentation metadata", () => {
        expect(meta.label.trim().length).toBeGreaterThan(0);
        expect(meta.description.trim().length).toBeGreaterThan(0);
        expect(CATEGORIES.has(meta.category)).toBe(true);
        expect(meta.accent, "accent must be a 6-digit hex color").toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(meta.icon, "icon must be defined").toBeTruthy();
      });

      it("declares a defaultConfig that satisfies its own schema", () => {
        const parsed = meta.schema.safeParse(meta.defaultConfig);
        if (!parsed.success) {
          throw new Error(`defaultConfig fails schema: ${JSON.stringify(parsed.error.issues)}`);
        }
        expect(parsed.success).toBe(true);
      });

      it("produces a full config from an empty object (every field defaulted)", () => {
        // README contract: "Give every field a .default() so schema.parse({})
        // produces the initial config."
        const parsed = meta.schema.safeParse({});
        if (!parsed.success) {
          throw new Error(
            `schema.parse({}) fails — a field is missing .default(): ${JSON.stringify(
              parsed.error.issues,
            )}`,
          );
        }
        expect(parsed.success).toBe(true);
      });

      it("has a total defaultTitle that returns a non-empty string", () => {
        const fromDefault = meta.defaultConfig;
        const fromEmpty = meta.schema.parse({});
        for (const cfg of [fromDefault, fromEmpty]) {
          const title = meta.defaultTitle(cfg);
          expect(typeof title).toBe("string");
          expect(title.length).toBeGreaterThan(0);
        }
      });
    });
  }
});
