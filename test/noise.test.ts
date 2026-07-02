import { describe, it, expect } from "vitest";
import { classifyPath, isFormattingOnly, isPermanentIgnore } from "../src/core/noise.ts";

describe("isPermanentIgnore", () => {
  it("ignores gandalf's own artifacts anywhere in the tree", () => {
    expect(isPermanentIgnore(".gandalf/lessons/diff-a-b/lesson.json")).toBe(true);
    expect(isPermanentIgnore("sub/repo/.gandalf/lessons/x/lesson.json")).toBe(true);
    expect(isPermanentIgnore(".gandalf")).toBe(true);
  });
  it("does not ignore look-alikes", () => {
    expect(isPermanentIgnore("src/gandalf.ts")).toBe(false);
    expect(isPermanentIgnore("docs/.gandalf.md")).toBe(false);
    expect(isPermanentIgnore("a/gandalf/lesson.json")).toBe(false);
  });
});

describe("classifyPath", () => {
  it("skips generated / lock / binary files", () => {
    expect(classifyPath("package-lock.json").skip).toBe(true);
    expect(classifyPath("a/b/Podfile.lock").skip).toBe(true);
    expect(classifyPath("assets/logo.png").skip).toBe(true);
    expect(classifyPath("dist/bundle.js").skip).toBe(true);
  });
  it("keeps normal source files", () => {
    expect(classifyPath("src/core/pipeline.ts").skip).toBe(false);
    expect(classifyPath("Core/RenderEngine/LayoutResolver.swift").skip).toBe(false);
  });
});

describe("isFormattingOnly", () => {
  it("flags whitespace-only diffs", () => {
    const diff = [
      "@@ -1,2 +1,2 @@",
      "-func  foo() {",
      "+func foo() {",
      "-  return  1",
      "+    return 1",
    ].join("\n");
    expect(isFormattingOnly(diff)).toBe(true);
  });
  it("does not flag semantic diffs", () => {
    const diff = ["@@ -1 +1 @@", "-return 1", "+return 2"].join("\n");
    expect(isFormattingOnly(diff)).toBe(false);
  });
  it("returns false when there are no +/- lines", () => {
    expect(isFormattingOnly("@@ -1 +1 @@\n context only")).toBe(false);
  });
});
