// Thorough UI interaction sweep: drives every interactive surface, records console/page
// errors tagged by interaction phase, and screenshots multiple scroll positions for review.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.env.URL || "http://localhost:4310";
const OUT = process.env.OUT || "/tmp/gandalf-ui-sweep";
const CHROME =
  process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

let phase = "boot";
const events = []; // { phase, type, text }
const note = (type, text) => events.push({ phase, type, text });
page.on("console", (m) => m.type() === "error" && note("console", m.text()));
page.on("pageerror", (e) => note("pageerror", e.message));

const shots = [];
async function shot(name) {
  const p = `${OUT}/${name}.png`;
  await page.screenshot({ path: p });
  shots.push(name);
}

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const tabs = ["Overview", "Dependencies", "Walkthrough", "Behavioral", "Contracts", "Data flow", "Complexity", "Patterns"];

// 1) Walk every tab; for each, screenshot top then scroll its content in steps.
for (const tab of tabs) {
  phase = `tab:${tab}`;
  try {
    await page.getByRole("tab", { name: tab }).click({ timeout: 5000 });
    await page.waitForTimeout(900);
    await shot(`tab-${tab.replace(/\s+/g, "-")}-top`);
    // scroll the lens body: aim the wheel at the content area
    await page.mouse.move(900, 500);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(350);
    }
    await shot(`tab-${tab.replace(/\s+/g, "-")}-scrolled`);
  } catch (e) {
    note("interaction", `tab ${tab}: ${e.message}`);
  }
}

// 2) Depth selector across all tiers (on Behavioral).
phase = "depth";
await page.getByRole("tab", { name: "Behavioral" }).click().catch(() => {});
await page.waitForTimeout(500);
const tierText = {};
for (const tier of ["ELI5", "Junior", "Senior", "Architect"]) {
  try {
    await page.getByRole("radio", { name: tier }).click({ timeout: 4000 });
    await page.waitForTimeout(400);
    tierText[tier] = await page.locator("main p, [class*=max-w-prose]").first().innerText().catch(() => "");
  } catch (e) {
    note("interaction", `depth ${tier}: ${e.message}`);
  }
}
await shot("depth-architect");

// 3) Dependency lens: click a node, drag the resizer.
phase = "dependency";
await page.getByRole("tab", { name: "Dependencies" }).click().catch(() => {});
await page.waitForTimeout(1200);
const nodeCount = await page.locator(".react-flow__node").count();
await page.locator(".react-flow__node").first().click().catch((e) => note("interaction", "node click: " + e.message));
await page.waitForTimeout(800);
await shot("dep-node-selected");
const sep = page.locator('[role="separator"]');
if (await sep.count()) {
  const box = await sep.first().boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 320, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    await shot("dep-resized-wide");
  }
}

// 4) Walkthrough deep scroll (nested scroll + parallax + snap + sticky code).
phase = "walkthrough";
await page.getByRole("tab", { name: "Walkthrough" }).click().catch(() => {});
await page.waitForTimeout(1500);
await shot("walk-intro");
await page.mouse.move(720, 460);
for (let i = 0; i < 14; i++) {
  await page.mouse.wheel(0, 650);
  await page.waitForTimeout(380);
  if (i === 5) await shot("walk-mid");
}
await shot("walk-deep");
const focusLines = await page.locator(".gandalf-code .cl-focus").count();
const codeStages = await page.locator(".gandalf-code").count();

// 5) Dark mode + tokens.
phase = "chrome";
await page.getByRole("button", { name: /switch to (dark|light) mode/i }).first().click().catch((e) => note("interaction", "dark: " + e.message));
await page.waitForTimeout(500);
await shot("dark");
await page.getByRole("button", { name: "Lesson library" }).click().catch((e) => note("interaction", "library: " + e.message));
await page.waitForTimeout(400);
await shot("library-open");
await page.keyboard.press("Escape").catch(() => {});
await page.getByRole("button", { name: "tokens" }).click().catch(() => {});
await page.waitForTimeout(600);
await shot("tokens");

const byPhase = {};
for (const e of events) (byPhase[e.phase] ??= []).push(`[${e.type}] ${e.text}`);

console.log(JSON.stringify({
  url: URL,
  nodeCount,
  focusLines,
  codeStages,
  tierTextDistinct: new Set(Object.values(tierText)).size,
  errorCount: events.length,
  errorsByPhase: byPhase,
  shots,
}, null, 2));
await browser.close();
