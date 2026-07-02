import { describe, expect, it } from "vitest";
import { parseUnifiedDiff, pairRows } from "../web/src/lib/parseDiff.ts";

const DIFF = `diff --git a/x.swift b/x.swift
index 111..222 100644
--- a/x.swift
+++ b/x.swift
@@ -1,4 +1,4 @@
 struct A {
-  let old: Int
+  let new: Int
+  let extra: Bool
   func f() {}
@@ -10,2 +11,1 @@ struct A
 }
-// trailing
`;

describe("parseUnifiedDiff", () => {
  it("parses hunks with correct line numbers and kinds", () => {
    const hunks = parseUnifiedDiff(DIFF);
    expect(hunks).toHaveLength(2);
    const rows = hunks[0]!.rows;
    expect(rows.map((r) => r.kind)).toEqual(["context", "del", "add", "add", "context"]);
    expect(rows[0]).toMatchObject({ beforeNo: 1, afterNo: 1, text: "struct A {" });
    expect(rows[1]).toMatchObject({ kind: "del", beforeNo: 2, afterNo: null });
    expect(rows[2]).toMatchObject({ kind: "add", beforeNo: null, afterNo: 2, text: "  let new: Int" });
    expect(rows[3]).toMatchObject({ kind: "add", afterNo: 3 });
    expect(rows[4]).toMatchObject({ beforeNo: 3, afterNo: 4 });
  });

  it("ignores the trailing split artifact and headers", () => {
    const hunks = parseUnifiedDiff(DIFF);
    const last = hunks[1]!.rows;
    expect(last.map((r) => r.kind)).toEqual(["context", "del"]);
  });

  it("returns no hunks for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
    expect(parseUnifiedDiff("Binary files differ")).toEqual([]);
  });
});

describe("pairRows", () => {
  it("aligns del runs against add runs GitHub-style", () => {
    const hunks = parseUnifiedDiff(DIFF);
    const pairs = pairRows(hunks[0]!.rows);
    // context | del+add(2) run pairs as [del,add] + [null,add] | context
    expect(pairs).toHaveLength(4);
    expect(pairs[0]!.left).toBe(pairs[0]!.right); // context on both sides
    expect(pairs[1]!.left?.kind).toBe("del");
    expect(pairs[1]!.right?.kind).toBe("add");
    expect(pairs[2]!.left).toBeNull();
    expect(pairs[2]!.right?.kind).toBe("add");
    expect(pairs[3]!.left).toBe(pairs[3]!.right);
  });
});
