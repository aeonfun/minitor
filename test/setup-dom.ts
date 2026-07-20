// Setup for component tests. Registered globally in vitest.config.ts, but the
// node-environment suites load it too, so everything here is guarded on a DOM
// actually being present — importing jest-dom or RTL under `environment: node`
// would throw on `document`.
import { afterEach, expect } from "vitest";

if (typeof document !== "undefined") {
  const [matchers, { cleanup }] = await Promise.all([
    import("@testing-library/jest-dom/matchers"),
    import("@testing-library/react"),
  ]);

  expect.extend(matchers.default ?? matchers);

  // Unmount between tests so each case starts from a clean document. Without
  // this, `screen` queries would see components left over from earlier tests.
  afterEach(() => cleanup());

  // jsdom implements neither of these, and ColumnCard uses both: rAF to focus
  // the search input after the row commits, and matchMedia via next-themes in
  // some child components.
  globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame ??= ((id: number) =>
    clearTimeout(id)) as typeof cancelAnimationFrame;

  globalThis.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof matchMedia;
}
