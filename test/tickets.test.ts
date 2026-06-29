import { describe, it, expect } from "vitest";
import { parseTickets, matchTicket, ticketIntent } from "../src/core/tickets.ts";

const SAMPLE = `Intro line.

### Ticket MVP-004: Implement PhotosPicker selection
- Phase: MVP
- Area: Media Engine
- Purpose: Allow user to select multiple photos privately.
- Implementation: Use PhotosPicker for single and multi-select.
- Implementation: Allow 1-12 photos.
- Files: Features/PhotoImportFeature/PhotoPickerView.swift
- Files: Core/MediaEngine/PhotoImportService.swift
- Acceptance: User can select 1 photo.
- Acceptance: Canceling returns without a corrupt project.
- Do not: implement unrelated scope.
- Done means: code merged, tests passing.

### Ticket MVP-005: Implement bundled template loader
- Phase: MVP
- Area: Template Engine
- Purpose: Load template specs from JSON.
- Files: Core/TemplateEngine/TemplateRegistry.swift
- Do not: implement unrelated scope.
- Done means: code merged.
`;

describe("parseTickets", () => {
  it("parses ids, titles, and repeated fields", () => {
    const t = parseTickets(SAMPLE);
    expect(t).toHaveLength(2);
    expect(t[0]!.id).toBe("MVP-004");
    expect(t[0]!.title).toBe("Implement PhotosPicker selection");
    expect(t[0]!.area).toBe("Media Engine");
    expect(t[0]!.implementation).toHaveLength(2);
    expect(t[0]!.files).toContain("Core/MediaEngine/PhotoImportService.swift");
    expect(t[0]!.acceptance).toHaveLength(2);
    expect(t[0]!.doNot).toContain("unrelated scope");
  });
});

describe("matchTicket", () => {
  it("matches by overlapping file basenames", () => {
    const tickets = parseTickets(SAMPLE);
    const m = matchTicket(
      ["Core/MediaEngine/PhotoImportService.swift", "Features/PhotoImportFeature/PhotoPickerView.swift"],
      tickets,
    );
    expect(m?.id).toBe("MVP-004");
  });
  it("honors an explicit id", () => {
    const tickets = parseTickets(SAMPLE);
    expect(matchTicket([], tickets, "mvp-005")?.id).toBe("MVP-005");
  });
  it("returns null with no overlap", () => {
    const tickets = parseTickets(SAMPLE);
    expect(matchTicket(["unrelated/File.kt"], tickets)).toBeNull();
  });
});

describe("ticketIntent", () => {
  it("includes purpose, acceptance, and do-not", () => {
    const t = parseTickets(SAMPLE)[0]!;
    const intent = ticketIntent(t);
    expect(intent).toContain("Purpose:");
    expect(intent).toContain("Acceptance:");
    expect(intent).toContain("Do not:");
  });
});
