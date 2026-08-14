import { describe, it, expect } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";
import { deriveGraphNodes, type GraphNodeSource } from "../src/core/evidence.ts";
import { repairGraph } from "../src/core/validate.ts";
import { graphPassSchema } from "../src/core/schemas.ts";
import type { ModuleGraphDelta } from "../src/core/schemas.ts";

/**
 * The graph's node set is deterministic: derived from the diff, pinned into the graph
 * pass's schema, and repaired at persist time. All three steps are pure: no claude.
 */

function src(over: Partial<GraphNodeSource> & { path: string }): GraphNodeSource {
  return { status: "modified", afterBlob: null, beforeBlob: null, ...over };
}

const PY_FACETS = `import json
from datasette.utils import escape_sqlite
from .plugins import pm
import os.path

class Facet:
    pass
`;

const TS_PIPELINE = `import { z } from "zod";
import { buildEvidence } from "./evidence.ts";
import { startServer } from "../server/serve.ts";
import "./styles.css";
const yaml = require("yaml");
`;

describe("deriveGraphNodes", () => {
  it("emits one node per changed module, with a rolled-up status", () => {
    const nodes = deriveGraphNodes([
      src({ path: "src/core/pipeline.ts" }),
      src({ path: "src/core/evidence.ts", status: "added" }),
      src({ path: "src/server/serve.ts", status: "added" }),
      src({ path: "web/src/App.tsx", status: "removed" }),
    ]);
    expect(nodes).toEqual([
      { id: "src/core", module: "src/core", status: "modified", kind: "module" },
      { id: "src/server", module: "src/server", status: "added", kind: "module" },
      { id: "web/src", module: "web/src", status: "removed", kind: "module" },
    ]);
  });

  it("adds in-repo python import neighbours as unchanged nodes", () => {
    const nodes = deriveGraphNodes([
      src({ path: "datasette/facets.py", afterBlob: PY_FACETS }),
    ]);
    expect(nodes[0]!.status).toBe("modified");
    const neighbours = nodes.filter((n) => n.status === "unchanged").map((n) => n.id);
    // absolute (datasette.utils) + relative (.plugins), both inside the repo taxonomy
    expect(neighbours).toEqual(["datasette/plugins", "datasette/utils"]);
  });

  it("adds in-repo TS/JS import neighbours and skips the file's own module", () => {
    const nodes = deriveGraphNodes([src({ path: "src/core/pipeline.ts", afterBlob: TS_PIPELINE })]);
    expect(nodes.map((n) => n.id)).toEqual(["src/core", "src/server"]);
    expect(nodes[1]!.status).toBe("unchanged");
  });

  it("excludes stdlib and external packages", () => {
    const nodes = deriveGraphNodes([
      src({ path: "datasette/facets.py", afterBlob: PY_FACETS }),
      src({ path: "src/core/pipeline.ts", afterBlob: TS_PIPELINE }),
    ]);
    const ids = nodes.map((n) => n.id);
    for (const external of ["json", "os", "os/path", "zod", "yaml"]) {
      expect(ids).not.toContain(external);
    }
  });

  it("does not duplicate a changed module whose id keeps its file extension", () => {
    // "datasette/database.py" changed; another changed file imports datasette.database,
    // whose specifier has no extension. One node, not two spellings of the same module.
    const nodes = deriveGraphNodes([
      src({ path: "datasette/database.py" }),
      src({ path: "datasette/app.py", afterBlob: "from datasette.database import Database\n" }),
    ]);
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain("datasette/database.py");
    expect(ids).not.toContain("datasette/database");
  });

  it("reads a removed file's imports from its before-blob", () => {
    const nodes = deriveGraphNodes([
      src({ path: "datasette/facets.py", status: "removed", beforeBlob: PY_FACETS }),
    ]);
    expect(nodes[0]!.status).toBe("removed");
    expect(nodes.map((n) => n.id)).toContain("datasette/utils");
  });
});

describe("graphPassSchema", () => {
  const schema = graphPassSchema(["src/core", "src/server"]);

  it("accepts edges between known nodes", () => {
    const parsed = schema.safeParse({
      edges: [{ from: "src/core", to: "src/server", kind: "imports", status: "added" }],
      rippleTargets: ["src/server"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an edge whose endpoint is not a node", () => {
    const bad = schema.safeParse({
      edges: [{ from: "src/core", to: "datasette/utils", kind: "imports", status: "added" }],
      rippleTargets: [],
    });
    expect(bad.success).toBe(false);
    const badRipple = schema.safeParse({ edges: [], rippleTargets: ["Nowhere"] });
    expect(badRipple.success).toBe(false);
  });

  it("carries the node enum into the JSON Schema handed to claude", () => {
    const json = JSON.stringify(zodToJsonSchema(schema, { $refStrategy: "none" }));
    expect(json).toContain(`"enum":["src/core","src/server"]`);
  });
});

describe("repairGraph", () => {
  const graph = (over: Partial<ModuleGraphDelta>): ModuleGraphDelta => ({
    nodes: [{ id: "datasette/facets.py", module: "datasette/facets.py", status: "modified", kind: "module" }],
    edges: [],
    rippleTargets: [],
    ...over,
  });

  it("creates the missing node for a dangling edge, as unchanged", () => {
    const repair = repairGraph(
      graph({ edges: [{ from: "datasette/facets.py", to: "datasette/utils", kind: "imports", status: "added" }] }),
    );
    expect(repair.graph.edges).toHaveLength(1);
    expect(repair.graph.nodes[1]).toEqual({
      id: "datasette/utils",
      module: "datasette/utils",
      status: "unchanged",
      kind: "module",
    });
    expect(repair.actions).toHaveLength(1);
    expect(repair.actions[0]).toContain(`added missing node "datasette/utils"`);
  });

  it("drops an edge whose endpoint is prose rather than a module id", () => {
    const repair = repairGraph(
      graph({
        edges: [{ from: "datasette/facets.py", to: "the utils module (probably)", kind: "uses", status: "added" }],
      }),
    );
    expect(repair.graph.edges).toEqual([]);
    expect(repair.graph.nodes).toHaveLength(1);
    expect(repair.actions[0]).toContain("dropped edge");
  });

  it("reduces prose ripple targets and drops the unmatchable ones", () => {
    const repair = repairGraph(
      graph({ rippleTargets: ["datasette/facets.py (because reasons)", "Nowhere/Ghost"] }),
    );
    expect(repair.graph.rippleTargets).toEqual(["datasette/facets.py"]);
    expect(repair.actions).toHaveLength(2);
    expect(repair.actions[1]).toContain("dropped rippleTarget");
  });

  it("leaves a consistent graph untouched", () => {
    const input = graph({
      nodes: [
        { id: "a", module: "a", status: "modified", kind: "module" },
        { id: "b", module: "b", status: "unchanged", kind: "module" },
      ],
      edges: [{ from: "a", to: "b", kind: "imports", status: "added" }],
      rippleTargets: ["b"],
    });
    const repair = repairGraph(input);
    expect(repair.actions).toEqual([]);
    expect(repair.graph).toEqual(input);
  });
});
