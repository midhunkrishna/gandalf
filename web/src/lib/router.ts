import { useSyncExternalStore } from "react";

/**
 * Hash router: `#/lesson/<id>/<tab>[/<node>]`, `#/library`, `#/tokens`.
 * Hash-based so URLs work identically under `gandalf serve`, `npm run dev`,
 * and the single-file offline export opened via file:// — no server routing
 * required, and no router dependency for three flat routes.
 */

export const TABS = [
  "overview",
  "dependency",
  "walkthrough",
  "behavioral",
  "contract",
  "dataflow",
  "complexity",
  "patterns",
  "recall",
] as const;
export type Tab = (typeof TABS)[number];

export interface Route {
  view: "lesson" | "library" | "tokens";
  lessonId: string | null;
  tab: Tab;
  /** Selected module in the dependency lens (deep-links its sidebar). */
  node: string | null;
}

export const DEFAULT_ROUTE: Route = { view: "lesson", lessonId: null, tab: "overview", node: null };

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function parseHash(hash: string): Route {
  const [head, ...rest] = hash.replace(/^#\/?/, "").split("/");
  if (head === "library") return { ...DEFAULT_ROUTE, view: "library" };
  if (head === "tokens") return { ...DEFAULT_ROUTE, view: "tokens" };
  if (head === "lesson") {
    const lessonId = rest[0] ? safeDecode(rest[0]) : null;
    const tab = (TABS as readonly string[]).includes(rest[1] ?? "") ? (rest[1] as Tab) : "overview";
    // Tolerate hand-typed node ids containing raw slashes by re-joining the tail.
    const node = tab === "dependency" && rest.length > 2 ? safeDecode(rest.slice(2).join("/")) : null;
    return { view: "lesson", lessonId, tab, node: node || null };
  }
  return { ...DEFAULT_ROUTE };
}

export function buildHash(r: Route): string {
  if (r.view === "library") return "#/library";
  if (r.view === "tokens") return "#/tokens";
  if (!r.lessonId) return "#/";
  const base = `#/lesson/${encodeURIComponent(r.lessonId)}/${r.tab}`;
  return r.tab === "dependency" && r.node ? `${base}/${encodeURIComponent(r.node)}` : base;
}

// Cache the parsed route per hash string so useSyncExternalStore gets a stable
// snapshot reference (a fresh object every call would loop the render).
let cached: { hash: string; route: Route } | null = null;
function getRoute(): Route {
  const hash = typeof window === "undefined" ? "" : window.location.hash;
  if (!cached || cached.hash !== hash) cached = { hash, route: parseHash(hash) };
  return cached.route;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute, () => DEFAULT_ROUTE);
}

/**
 * Merge a patch into the current route and write the hash. Default is a push
 * (history entry — Back steps between tabs/views); `replace` is for
 * canonicalization and node selection, which shouldn't spam history.
 */
export function navigate(patch: Partial<Route>, opts: { replace?: boolean } = {}): void {
  const hash = buildHash({ ...getRoute(), ...patch });
  if (hash === window.location.hash) return;
  if (opts.replace) {
    history.replaceState(null, "", hash);
    // replaceState doesn't fire hashchange — notify subscribers ourselves.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = hash;
  }
}
