// Verify the 7 Phase-6 enhancements.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const URL = process.env.URL || "http://localhost:4310";
const OUT = process.env.OUT || "/tmp/gandalf-phase6";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
const r = {};
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

// #1/#4 file filter — header toggle + effect on Overview changed-files count
const filesToggle = page.getByRole("switch", { name: /config & generated/i });
r.filesTogglePresent = await filesToggle.count();
await page.getByRole("tab", { name: "Overview" }).click();
await page.waitForTimeout(600);
const changedRows = () => page.locator("[class*='divide-y'] li").count();
r.changedBefore = await changedRows();
if (r.filesTogglePresent) {
  await filesToggle.click();
  await page.waitForTimeout(500);
  r.changedAfterShowAll = await changedRows();
  await filesToggle.click(); // back to hidden
  await page.waitForTimeout(300);
}
await shot("p6-overview");

// #7 depth/quiz conditional
const depthName = /Explain for|ELI5/i;
await page.getByRole("tab", { name: "Overview" }).click();
await page.waitForTimeout(300);
r.depthOnOverview = await page.getByText("Explain for").count();
await page.getByRole("tab", { name: "Behavioral" }).click();
await page.waitForTimeout(300);
r.depthOnBehavioral = await page.getByText("Explain for").count();
r.quizOnBehavioral = await page.getByRole("switch", { name: /quiz mode/i }).count();
await page.getByRole("tab", { name: "Complexity" }).click();
await page.waitForTimeout(300);
r.quizOnComplexity = await page.getByRole("switch", { name: /quiz mode/i }).count();

// #5 hotspot tooltip (Complexity)
const tile = page.locator(".relative svg rect").first();
if (await tile.count()) {
  await tile.hover().catch(() => {});
  await page.waitForTimeout(400);
  r.hotspotTooltip = (await page.locator("body").innerText()).includes("hotspot score");
}
await shot("p6-complexity");

// #6 hero collapse
await page.getByRole("tab", { name: "Overview" }).click();
await page.waitForTimeout(200);
r.heroTitleBefore = await page.locator("h1").count();
await page.getByRole("button", { name: "Collapse header" }).click().catch((e) => errors.push("collapse: " + e.message));
await page.waitForTimeout(300);
r.heroTitleAfterCollapse = await page.locator("h1").count();
await shot("p6-hero-collapsed");
await page.getByRole("button", { name: "Expand header" }).click().catch(() => {});
await page.waitForTimeout(200);

// #2 dependency maximize + split
await page.getByRole("tab", { name: "Dependencies" }).click();
await page.waitForTimeout(1200);
await page.locator(".react-flow__node").first().click().catch(() => {});
await page.waitForTimeout(700);
r.splitBtn = await page.getByRole("button", { name: /split.*diff/i }).count();
await page.getByRole("button", { name: /Maximize diff/i }).click().catch((e) => errors.push("max: " + e.message));
await page.waitForTimeout(500);
r.graphHiddenWhenMax = await page.locator(".react-flow").count(); // expect 0
await shot("p6-dep-maximized");
await page.getByRole("button", { name: /Split.*diff/i }).click().catch(() => {});
await page.waitForTimeout(500);
r.sideBySideOnSplit = await page.locator('[data-diff-view="split"]').count(); // expect >0
await shot("p6-dep-split");
await page.keyboard.press("Escape"); // un-maximize
await page.waitForTimeout(400);
r.graphBackAfterEsc = await page.locator(".react-flow").count(); // expect >0

// #3 mermaid maximize + Esc
await page.getByRole("tab", { name: "Data flow" }).click();
await page.waitForTimeout(1400);
const maxBtn = page.getByRole("button", { name: "Maximize diagram" }).first();
r.mermaidMaxBtn = await maxBtn.count();
if (r.mermaidMaxBtn) {
  await maxBtn.click();
  await page.waitForTimeout(500);
  r.mermaidOverlayOpen = await page.getByText("scroll to zoom").count();
  await shot("p6-mermaid-zoom");
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, -300); // zoom in
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  r.mermaidOverlayClosedAfterEsc = await page.getByText("scroll to zoom").count(); // expect 0
}

console.log(JSON.stringify({ ...r, errors }, null, 2));
await browser.close();
