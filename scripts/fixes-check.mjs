// Verify the 4 fixes: mermaid bombs, diff line-numbers, walkthrough hover-scroll + diff colours.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const URL = process.env.URL || "http://localhost:4310";
const OUT = process.env.OUT || "/tmp/gandalf-fixes";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
const r = {};

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// (1) Mermaid bombs — visit Data flow, then cycle tabs back and forth several times.
for (let k = 0; k < 4; k++) {
  await page.getByRole("tab", { name: "Data flow" }).click();
  await page.waitForTimeout(700);
  await page.getByRole("tab", { name: "Overview" }).click();
  await page.waitForTimeout(400);
}
r.mermaidErrorBombs = await page.getByText("Syntax error in text").count();
await page.getByRole("tab", { name: "Data flow" }).click();
await page.waitForTimeout(900);
r.mermaidRendered = await page.locator(".gandalf-mermaid svg").count();
r.mermaidFallbackPre = await page.locator(".gandalf-mermaid + *, pre").count();
await page.screenshot({ path: `${OUT}/fx-dataflow.png` });

// (2) Diff line numbers — Dependencies → click node.
await page.getByRole("tab", { name: "Dependencies" }).click();
await page.waitForTimeout(1200);
await page.locator(".react-flow__node").first().click().catch(() => {});
await page.waitForTimeout(900);
r.diffSideBySide = await page.locator('[data-diff-view="split"]').count(); // expect 0 (unified)
r.diffLineByLine = await page.locator('[data-diff-view="unified"]').count();
await page.screenshot({ path: `${OUT}/fx-diff.png` });

// (3)+(4) Walkthrough — scroll into a code scene, check diff colours + hover scroll.
await page.getByRole("tab", { name: "Walkthrough" }).click();
await page.waitForTimeout(1300);
await page.mouse.move(400, 460); // hover LEFT (cards) → page scrolls
for (let i = 0; i < 7; i++) { await page.mouse.wheel(0, 650); await page.waitForTimeout(300); }
await page.waitForTimeout(500);
r.codeHasLenisPrevent = await page.locator(".gandalf-code[data-lenis-prevent]").count();
r.diffAddLines = await page.locator(".gandalf-code .cl-add").count();
r.diffModLines = await page.locator(".gandalf-code .cl-mod").count();
r.diffRemovedMarkers = await page.locator(".gandalf-code .cl-removed-before").count();
await page.screenshot({ path: `${OUT}/fx-walk-colours.png` });

// hover RIGHT (code) and wheel → code panel scrolls natively
const codeScrollBefore = await page.locator(".gandalf-code").first().evaluate((el) => el.scrollTop).catch(() => 0);
await page.mouse.move(1120, 460);
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(200); }
const codeScrollAfter = await page.locator(".gandalf-code").first().evaluate((el) => el.scrollTop).catch(() => 0);
r.codeScrolledOnHover = codeScrollAfter - codeScrollBefore;
await page.screenshot({ path: `${OUT}/fx-walk-hover.png` });

console.log(JSON.stringify({ ...r, errors }, null, 2));
await browser.close();
