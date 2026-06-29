// Visual sanity check: drives the installed Chrome via Playwright and screenshots the viewer.
// Usage: node scripts/sanity-shot.mjs   (with a dev server running on $URL)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.env.URL || "http://localhost:5179";
const OUT = process.env.OUT || "/tmp/gandalf-shots";
const CHROME =
  process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("text=Hardened Financial Domain", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1800);

const nodeCount = await page.locator(".react-flow__node").count();
await page.screenshot({ path: `${OUT}/1-lesson.png` });

await page.locator(".react-flow__node").first().click().catch(() => {});
await page.waitForTimeout(900);
const hasDiff = (await page.locator(".gandalf-diff, .d2h-wrapper").count()) > 0;
await page.screenshot({ path: `${OUT}/2-node-selected.png` });

// drag the resizer left to widen the sidebar -> should switch to side-by-side
const sep = page.locator('[role="separator"][aria-label="Resize panel"]');
const box = await sep.boundingBox();
let sideBySide = null;
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 360, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  sideBySide = (await page.locator(".d2h-file-side-diff").count()) > 0;
  await page.screenshot({ path: `${OUT}/5-wide.png` });
}

const darkBtn = page.getByRole("button", { name: /switch to (dark|light) mode/i });
const darkBtnCount = await darkBtn.count();
await darkBtn.first().click().catch((e) => errors.push("dark click: " + e.message));
await page.waitForTimeout(500);
const darkState = await page.evaluate(() => ({
  htmlClass: document.documentElement.className,
  bodyBg: getComputedStyle(document.body).backgroundColor,
}));
await page.screenshot({ path: `${OUT}/3-dark.png` });

await page.getByRole("button", { name: "tokens" }).click().catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/4-tokens.png`, fullPage: true });

console.log(JSON.stringify({ nodeCount, hasDiff, sideBySide, darkBtnCount, darkState, errors }, null, 2));
await browser.close();
