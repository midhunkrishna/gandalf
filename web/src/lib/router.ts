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
  /** Selected module (or file path) in the dependency lens — deep-links its sidebar. */
  node: string | null;
  /** Focused after-file line in the dependency diff (`?l=`). */
  line: number | null;
  /** Content-addressed contract anchor (`file::symbol`) on the contract tab. */
  contract: string | null;
  /** Contract anchor a dependency jump came from (`?from=`) — powers the back chip. */
  from: string | null;
}

export const DEFAULT_ROUTE: Route = {
  view: "lesson",
  lessonId: null,
  tab: "overview",
  node: null,
  line: null,
  contract: null,
  from: null,
};

/** Detail fields that must never leak across tab or lesson switches. */
export const NO_DETAIL = { node: null, line: null, contract: null, from: null } as const;

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, "");
  const qIdx = cleaned.indexOf("?");
  const path = qIdx === -1 ? cleaned : cleaned.slice(0, qIdx);
  const params = new URLSearchParams(qIdx === -1 ? "" : cleaned.slice(qIdx + 1));
  const [head, ...rest] = path.split("/");
  if (head === "library") return { ...DEFAULT_ROUTE, view: "library" };
  if (head === "tokens") return { ...DEFAULT_ROUTE, view: "tokens" };
  if (head === "lesson") {
    const lessonId = rest[0] ? safeDecode(rest[0]) : null;
    const tab = (TABS as readonly string[]).includes(rest[1] ?? "") ? (rest[1] as Tab) : "overview";
    // Tolerate hand-typed detail segments containing raw slashes by re-joining the tail.
    const detail = rest.length > 2 ? safeDecode(rest.slice(2).join("/")) : "";
    const lRaw = params.get("l") ?? "";
    return {
      view: "lesson",
      lessonId,
      tab,
      node: tab === "dependency" && detail ? detail : null,
      line: tab === "dependency" && /^\d+$/.test(lRaw) ? parseInt(lRaw, 10) : null,
      contract: tab === "contract" && detail ? detail : null,
      from: (tab === "dependency" && params.get("from")) || null,
    };
  }
  return { ...DEFAULT_ROUTE };
}

export function buildHash(r: Route): string {
  if (r.view === "library") return "#/library";
  if (r.view === "tokens") return "#/tokens";
  if (!r.lessonId) return "#/";
  let hash = `#/lesson/${encodeURIComponent(r.lessonId)}/${r.tab}`;
  if (r.tab === "dependency") {
    if (r.node) hash += `/${encodeURIComponent(r.node)}`;
    const q = new URLSearchParams();
    if (r.line != null) q.set("l", String(r.line));
    if (r.from) q.set("from", r.from);
    const qs = q.toString();
    if (qs) hash += `?${qs}`;
  } else if (r.tab === "contract" && r.contract) {
    hash += `/${encodeURIComponent(r.contract)}`;
  }
  return hash;
}

/** Content-addressed contract anchor: survives regeneration reordering; a miss is a clean miss. */
export function contractAnchor(c: { file: string; symbol: string }): string {
  return `${c.file}::${c.symbol}`;
}

/** Resolve an anchor against a lesson's contracts; null when the link outlived its target. */
export function resolveContractAnchor<T extends { file: string; symbol: string }>(
  contracts: T[],
  anchor: string,
): T | null {
  const idx = anchor.indexOf("::");
  if (idx === -1) return null;
  const file = anchor.slice(0, idx);
  const symbol = anchor.slice(idx + 2);
  return contracts.find((c) => c.file === file && c.symbol === symbol) ?? null;
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
