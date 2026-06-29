import { describe, it, expect } from "vitest";
import { normalizeModule, languageOf, moduleKind } from "../src/core/modules.ts";

describe("normalizeModule", () => {
  it("repairs the generator's doubled Engine suffix", () => {
    expect(normalizeModule("Core/TemplateEngineEngine/FooService.swift")).toBe("Core/TemplateEngine");
    expect(normalizeModule("Core/FilterEngineEngine/BarService.swift")).toBe("Core/FilterEngine");
  });
  it("maps Core/UI to DesignSystem", () => {
    expect(normalizeModule("Core/UI/Thing.swift")).toBe("Core/DesignSystem");
  });
  it("strips the Feature suffix and keeps the feature name", () => {
    expect(normalizeModule("Features/HomescreenFeature/HomescreenView.swift")).toBe("Features/Homescreen");
    expect(normalizeModule("Features/EditorFeature/EditorView.swift")).toBe("Features/Editor");
  });
  it("collapses App/Assets/Tests to their top module", () => {
    expect(normalizeModule("App/Navigation/AppRouter.swift")).toBe("App");
    expect(normalizeModule("Assets/Templates/x.json")).toBe("Assets");
    expect(normalizeModule("Tests/RenderEngineTests/x.swift")).toBe("Tests");
  });
  it("falls back to src/<area> for generic repos (gandalf itself)", () => {
    expect(normalizeModule("src/core/pipeline.ts")).toBe("src/core");
    expect(normalizeModule("web/src/App.tsx")).toBe("web/src");
  });
});

describe("moduleKind", () => {
  it("classifies engines, features, models", () => {
    expect(moduleKind("Core/TemplateEngine")).toBe("engine");
    expect(moduleKind("Features/Editor")).toBe("feature");
    expect(moduleKind("Core/CoreModels")).toBe("model");
    expect(moduleKind("App")).toBe("app");
  });
});

describe("languageOf", () => {
  it("detects language by extension", () => {
    expect(languageOf("a/b/Thing.swift")).toBe("swift");
    expect(languageOf("src/core/x.ts")).toBe("typescript");
    expect(languageOf("README")).toBe("text");
  });
});
