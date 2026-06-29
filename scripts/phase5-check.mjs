// Smoke-test Phase 5: predict-then-reveal, contract guess, Recall tab, quiz toggle, Review overlay.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const URL = process.env.URL || "http://localhost:4310";
const OUT = process.env.OUT || "/tmp/gandalf-phase5";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
const r = {};

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

r.quizToggleVisible = await page.getByRole("switch", { name: /quiz mode/i }).count();

// Behavioral: predict-then-reveal on trace cards
await page.getByRole("tab", { name: "Behavioral" }).click();
await page.waitForTimeout(900);
r.predictPromptsOnBehavioral = await page.getByText("Predict", { exact: false }).count();
await page.screenshot({ path: `${OUT}/p5-behavioral-gated.png` });
// reveal first trace card (free-text path → "Reveal answer", or MCQ option)
const revealBtn = page.getByRole("button", { name: /reveal answer/i }).first();
if (await revealBtn.count()) {
  await revealBtn.click();
  await page.waitForTimeout(700);
  r.afterRevealShowsAfter = await page.getByText("after", { exact: false }).count();
} else {
  // MCQ: click first option
  await page.locator("button:has-text('Reveal')").first().click().catch(() => {});
}
await page.screenshot({ path: `${OUT}/p5-behavioral-revealed.png` });

// Contracts: Safe/Breaking guess
await page.getByRole("tab", { name: "Contracts" }).click();
await page.waitForTimeout(900);
r.contractPredict = await page.getByText("Safe or Breaking", { exact: false }).count();
await page.screenshot({ path: `${OUT}/p5-contracts-gated.png` });
// click a guess option (safe/breaking/unknown buttons)
const guess = page.locator("button:has-text('breaking'), button:has-text('safe')").first();
await guess.click().catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/p5-contracts-revealed.png` });

// Recall tab
await page.getByRole("tab", { name: "Recall" }).click();
await page.waitForTimeout(800);
r.recallHeading = await page.getByRole("heading", { name: "Recall" }).count();
r.recallText = (await page.locator("body").innerText()).includes("Retrieving from memory") || (await page.locator("body").innerText()).includes("no recall questions");
await page.screenshot({ path: `${OUT}/p5-recall.png` });

// Quiz toggle off → predictions hidden (answers immediate)
await page.getByRole("tab", { name: "Behavioral" }).click();
await page.waitForTimeout(400);
await page.getByRole("switch", { name: /quiz mode/i }).click().catch(() => {});
await page.waitForTimeout(500);
r.predictAfterToggleOff = await page.getByText("Predict", { exact: false }).count();
await page.screenshot({ path: `${OUT}/p5-quiz-off.png` });

// Review overlay
await page.getByRole("button", { name: /spaced review/i }).click().catch((e) => errors.push("review btn: " + e.message));
await page.waitForTimeout(800);
r.reviewDialog = await page.getByRole("dialog", { name: /spaced review/i }).count();
r.reviewText = (await page.locator("body").innerText()).includes("Nothing due") || (await page.locator("body").innerText()).includes("Due questions");
await page.screenshot({ path: `${OUT}/p5-review.png` });

console.log(JSON.stringify({ ...r, errors }, null, 2));
await browser.close();
