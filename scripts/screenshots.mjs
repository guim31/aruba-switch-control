// Takes the README screenshots from the app running in demo mode.
//
//   DEMO_MODE=true python run.py          # in another terminal
//   node scripts/screenshots.mjs [http://localhost:8085]
//
// Needs the `playwright` npm package and a Chromium it can launch.
// PNGs go to docs/screenshots/; they are compressed with pngquant when it is installed.
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.argv[2] || process.env.BASE_URL || "http://localhost:8085";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "screenshots");
const VIEWPORT = { width: 1600, height: 1000 };

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();

async function openApp(theme) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale: "en-US" });
    await context.addInitScript(([th]) => {
        localStorage.setItem("lang", "en");
        localStorage.setItem("theme", th);
        localStorage.removeItem("filter_search");
        localStorage.removeItem("filter_status");
        localStorage.removeItem("filter_color");
    }, [theme]);
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForSelector(".port-unit");
    await page.evaluate(() => document.fonts.ready);
    // Cables are drawn 100 ms after each render; select port 1 so the detail panel is filled
    await page.hover('.port-unit[data-port-id="1"]');
    await page.mouse.move(5, 5);
    await page.waitForSelector(".patch-cable-path");
    await page.waitForTimeout(600);
    return { context, page };
}

const shots = [];

for (const theme of ["dark", "light"]) {
    const { context, page } = await openApp(theme);
    const file = join(OUT_DIR, `overview-${theme}.png`);
    await page.screenshot({ path: file, fullPage: true });
    shots.push(file);

    if (theme === "dark") {
        // Port editor, opened by clicking a switch port
        await page.click('.port-unit[data-port-id="3"]');
        await page.waitForSelector("#modal-edit-port:not(.hidden)");
        await page.waitForTimeout(300);
        const editFile = join(OUT_DIR, "port-editor.png");
        await page.screenshot({ path: editFile });
        shots.push(editFile);
    }
    await context.close();
}

await browser.close();

const pngquant = spawnSync("pngquant", ["--version"]);
if (pngquant.status === 0) {
    for (const file of shots) {
        spawnSync("pngquant", ["--force", "--skip-if-larger", "--quality=70-90", "--ext", ".png", file], { stdio: "inherit" });
    }
} else {
    console.log("pngquant not found: PNGs left uncompressed.");
}
console.log(shots.map(f => `wrote ${f}`).join("\n"));
