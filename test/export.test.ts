import { describe, expect, it } from "vitest";
import { renderTemplate } from "../src/core/export.ts";
import type { LessonBundle, LessonMeta } from "../src/core/schemas.ts";

// renderTemplate is pure string work, so the "lesson" only needs to be shaped
// enough to serialize — the real schema is exercised by the pipeline tests.
const lesson = (over: Record<string, unknown> = {}) =>
  ({ meta: { id: "l1", title: "T" }, ...over }) as unknown as LessonBundle;
const metas = [{ id: "l1", title: "T" }] as unknown as LessonMeta[];

const TEMPLATE =
  '<html><script>const a="__GANDALF_TPL_LESSON__";const b="__GANDALF_TPL_LESSONS__";</script></html>';

describe("renderTemplate", () => {
  it("substitutes both sentinels with serialized JSON", () => {
    const html = renderTemplate(TEMPLATE, lesson(), metas);
    expect(html).toContain('const a={"meta":{"id":"l1","title":"T"}};');
    expect(html).toContain('const b=[{"id":"l1","title":"T"}];');
    expect(html).not.toContain("__GANDALF_TPL_");
  });

  it("handles single-quoted sentinels (minifier quote choice)", () => {
    const single = TEMPLATE.replace(/"__GANDALF_TPL_(\w+)__"/g, "'__GANDALF_TPL_$1__'");
    const html = renderTemplate(single, lesson(), metas);
    expect(html).not.toContain("__GANDALF_TPL_");
  });

  it("does not interpret $ sequences in lesson content as replacement patterns", () => {
    const html = renderTemplate(TEMPLATE, lesson({ meta: { id: "l1", title: "costs $& and $' daily" } }), metas);
    expect(html).toContain("costs $& and $' daily");
  });

  it("escapes </script so lesson content cannot close the inline script", () => {
    const html = renderTemplate(TEMPLATE, lesson({ meta: { id: "l1", title: "x</script><b>y" } }), metas);
    expect(html).not.toMatch(/x<\/script>/);
    expect(html).toContain("x<\\/script>");
  });

  it("rejects a template without the sentinel", () => {
    expect(() => renderTemplate("<html></html>", lesson(), metas)).toThrow(/sentinel/);
  });
});
