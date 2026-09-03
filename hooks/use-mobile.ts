import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function getIsMobileSnapshot() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getIsMobileSnapshot, () => false);
}
