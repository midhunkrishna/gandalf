// Focused regression check: dark-mode re-renders Shiki code + Mermaid.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const URL = process.env.URL || "http://localhost:4310";
const OUT = process.env.OUT || "/tmp/gandalf-dark-retest";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Walkthrough: scroll into a code scene (light), then toggle dark.
await page.getByRole("tab", { name: "Walkthrough" }).click();
await page.waitForTimeout(1200);
await page.mouse.move(720, 460);
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 650); await page.waitForTimeout(300); }
await page.screenshot({ path: `${OUT}/walk-light.png` });
await page.getByRole("button", { name: /switch to dark mode/i }).first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/walk-dark.png` });

// Count visible code tokens in the sticky panel (non-empty highlight => fix works).
const codeText = await page.locator(".gandalf-code").first().innerText().catch(() => "");
const codeTokens = await page.locator(".gandalf-code span").count();

// Data flow: mermaid should be dark-themed now.
await page.getByRole("tab", { name: "Data flow" }).click();
await page.waitForTimeout(1500);
const mermaidSvgs = await page.locator(".gandalf-mermaid svg").count();
await page.screenshot({ path: `${OUT}/dataflow-dark.png` });

console.log(JSON.stringify({
  codeTokens, codeTextLen: codeText.length, mermaidSvgs, errors,
}, null, 2));
await browser.close();
