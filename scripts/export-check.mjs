// Verifies a `gandalf build` single-file export renders with NO server (file://).
import { chromium } from "playwright";

const FILE = process.env.FILE;
const OUT = process.env.OUT || "/tmp/gandalf-export-shots";
const CHROME =
  process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
const requests = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
// flag any attempt to hit a server (the export must be fully self-contained)
page.on("request", (r) => {
  const u = r.url();
  if (u.startsWith("http://") || u.includes("/api/")) requests.push(u);
});

await page.goto("file://" + FILE, { waitUntil: "load" });
await page.waitForTimeout(2500);

const title = await page.locator("h1").first().innerText().catch(() => "(no h1)");
const tabCount = await page.getByRole("tab").count();
await page.screenshot({ path: `${OUT}/export-1-overview.png` });

const results = { tabs: {} };
for (const [tab, shot] of [
  ["Walkthrough", "export-2-walk"],
  ["Behavioral", "export-3-behavioral"],
  ["Complexity", "export-4-complexity"],
  ["Data flow", "export-5-dataflow"],
  ["Patterns", "export-6-patterns"],
]) {
  try {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(1200);
    results.tabs[tab] = "ok";
    await page.screenshot({ path: `${OUT}/${shot}.png` });
  } catch (e) {
    results.tabs[tab] = "FAIL: " + e.message;
  }
}

console.log(JSON.stringify({
  title,
  tabCount,
  apiOrHttpRequests: requests,   // expect [] — fully offline
  errors,
  ...results,
}, null, 2));
await browser.close();
