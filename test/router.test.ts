import { describe, expect, it } from "vitest";
import {
  parseHash,
  buildHash,
  contractAnchor,
  resolveContractAnchor,
  DEFAULT_ROUTE,
  type Route,
} from "../web/src/lib/router.ts";

const lessonRoute = (over: Partial<Route>): Route => ({ ...DEFAULT_ROUTE, ...over });

describe("parseHash", () => {
  it("parses lesson routes with tab", () => {
    expect(parseHash("#/lesson/diff-a-b/contract")).toEqual(
      lessonRoute({ lessonId: "diff-a-b", tab: "contract" }),
    );
  });

  it("parses a dependency node, including hand-typed raw slashes", () => {
    expect(parseHash("#/lesson/x/dependency/ExportEngine")).toEqual(
      lessonRoute({ lessonId: "x", tab: "dependency", node: "ExportEngine" }),
    );
    expect(parseHash("#/lesson/x/dependency/App/AppShell")).toEqual(
      lessonRoute({ lessonId: "x", tab: "dependency", node: "App/AppShell" }),
    );
    expect(parseHash("#/lesson/x/dependency/Package.swift")).toEqual(
      lessonRoute({ lessonId: "x", tab: "dependency", node: "Package.swift" }),
    );
  });

  it("decodes encoded segments", () => {
    expect(parseHash("#/lesson/id%20with%20space/dependency/App%2FAppShell")).toEqual(
      lessonRoute({ lessonId: "id with space", tab: "dependency", node: "App/AppShell" }),
    );
  });

  it("ignores node segments on non-dependency tabs and falls back on unknown tabs", () => {
    expect(parseHash("#/lesson/x/contract/Whatever").node).toBeNull();
    expect(parseHash("#/lesson/x/nonsense")).toEqual(lessonRoute({ lessonId: "x" }));
  });

  it("parses library and tokens views", () => {
    expect(parseHash("#/library").view).toBe("library");
    expect(parseHash("#/tokens").view).toBe("tokens");
  });

  it("returns the default route for junk", () => {
    expect(parseHash("")).toEqual(DEFAULT_ROUTE);
    expect(parseHash("#/")).toEqual(DEFAULT_ROUTE);
    expect(parseHash("#/garbage/route")).toEqual(DEFAULT_ROUTE);
  });
});

describe("buildHash", () => {
  it("round-trips every view", () => {
    const routes: Route[] = [
      lessonRoute({ lessonId: "diff-a-b", tab: "complexity" }),
      lessonRoute({ lessonId: "id with space", tab: "dependency", node: "App/AppShell" }),
      lessonRoute({ view: "library" }),
      lessonRoute({ view: "tokens" }),
    ];
    for (const r of routes) {
      const parsed = parseHash(buildHash(r));
      // library/tokens hashes intentionally drop lesson state
      if (r.view === "lesson") expect(parsed).toEqual(r);
      else expect(parsed.view).toBe(r.view);
    }
  });

  it("drops the node outside the dependency tab and handles a missing lesson id", () => {
    expect(buildHash(lessonRoute({ lessonId: "x", tab: "contract", node: "E" }))).toBe("#/lesson/x/contract");
    expect(buildHash(lessonRoute({}))).toBe("#/");
  });
});

describe("cross-navigation params", () => {
  const SYMBOL = "ExportViewModel.export(project:preset:)";
  const ANCHOR = `Features/ExportFeature/ExportView.swift::${SYMBOL}`;

  it("round-trips line + from on the dependency tab", () => {
    const r = lessonRoute({
      lessonId: "diff-a-b",
      tab: "dependency",
      node: "Features/ExportFeature/ExportView.swift",
      line: 67,
      from: ANCHOR,
    });
    expect(parseHash(buildHash(r))).toEqual(r);
  });

  it("round-trips a contract anchor with parens, colons, and slashes", () => {
    const r = lessonRoute({ lessonId: "diff-a-b", tab: "contract", contract: ANCHOR });
    expect(parseHash(buildHash(r))).toEqual(r);
  });

  it("ignores line/from outside the dependency tab and junk line values", () => {
    expect(parseHash("#/lesson/x/contract/a::b?l=5&from=c").line).toBeNull();
    expect(parseHash("#/lesson/x/contract/a::b?l=5&from=c").from).toBeNull();
    expect(parseHash("#/lesson/x/dependency/N?l=abc").line).toBeNull();
    expect(parseHash("#/lesson/x/dependency/N?l=-4").line).toBeNull();
  });

  it("omits empty query params from built hashes", () => {
    expect(buildHash(lessonRoute({ lessonId: "x", tab: "dependency", node: "N" }))).toBe("#/lesson/x/dependency/N");
  });
});

describe("contract anchors", () => {
  const contracts = [
    { file: "A.swift", symbol: "f()" },
    { file: "B.swift", symbol: "f()" },
    { file: "B.swift", symbol: "g(x:)" },
  ];

  it("resolves by file AND symbol", () => {
    expect(resolveContractAnchor(contracts, contractAnchor(contracts[1]!))).toBe(contracts[1]);
    expect(resolveContractAnchor(contracts, "B.swift::g(x:)")).toBe(contracts[2]);
  });

  it("misses cleanly on stale or malformed anchors", () => {
    expect(resolveContractAnchor(contracts, "Gone.swift::f()")).toBeNull();
    expect(resolveContractAnchor(contracts, "no-separator")).toBeNull();
  });
});
