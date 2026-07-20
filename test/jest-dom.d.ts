// Type-only registration of the jest-dom matchers (`toBeInTheDocument`,
// `toHaveValue`, `toHaveFocus`, …) onto vitest's `Assertion` interface.
//
// The matchers are wired up at runtime in `test/setup-dom.ts`, which has to
// import them dynamically behind a DOM check so the node-environment suites
// can share the same setup file. That dynamic import is invisible to
// TypeScript, so the augmentation is pulled in here instead.
import "@testing-library/jest-dom/vitest";
