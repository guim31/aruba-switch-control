// Walks through the app in demo mode and checks the translations.
//
//   DEMO_MODE=true python run.py          # in another terminal
//   node scripts/check-i18n.mjs [http://localhost:8085]
//
// English: no French text may remain anywhere visible (page, modals, filters,
// tooltips, placeholders, dialogs, toasts). French: a lighter reverse check.
// Port names and notes come from the database and are user data: they are not
// translated and are ignored. Elements with their own `lang` attribute (the
// language names in the switcher) are ignored too.
// Also fails on any browser console error or missing translation key.
// Exits with status 1 on failure. Note: it changes the demo database
// (cable color, bulk PoE action), never a real switch.
import { chromium } from "playwright";

const BASE_URL = process.argv[2] || process.env.BASE_URL || "http://localhost:8085";

const FRENCH_ACCENTS = /[àâäçéèêëîïôöûùüÿœæ]/i;
const FRENCH_WORDS = /\b(le|la|les|des|du|une|et|sur|pour|avec|sans|aucune?|tous|toutes|afficher|masquer|annuler|enregistrer|libérer|désactiver|activer|câble|couleur|rechercher|prise|panneau|baie|connect[ée]|aliment[ée]|modifier|choisissez|voulez|vraiment|mot de passe|sombre|clair|affich[ée]s)\b/i;
const ENGLISH_WORDS = /\b(settings|cancel|save|show cables|hide cables|search|shown|select a port|edit this port|light mode|dark mode|free this port|selected|connected to|pick a new color|really)\b/i;

const failures = [];
const consoleErrors = [];
const dialogs = [];
let userStrings = [];

function fail(msg) {
    failures.push(msg);
    console.log(`  ✗ ${msg}`);
}

function stripUserData(text) {
    let out = text;
    for (const s of userStrings) out = out.split(s).join(" ");
    return out;
}

// Every piece of text a user can see: visible text nodes, tooltips, placeholders,
// aria-labels, <option> labels, the document title.
async function collectTexts(page) {
    return page.evaluate(() => {
        const out = [];
        const skip = el => el.closest("[lang]:not(html), script, style, svg defs");
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const el = node.parentElement;
            const text = node.textContent.trim();
            if (!text || !el || skip(el)) continue;
            const visible = el.tagName === "OPTION" || el.checkVisibility({ visibilityProperty: true, opacityProperty: false });
            if (visible) out.push({ where: `<${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}>`, text });
        }
        document.querySelectorAll("[title], [placeholder], [aria-label]").forEach(el => {
            if (skip(el)) return;
            for (const attr of ["title", "placeholder", "aria-label"]) {
                const v = el.getAttribute(attr);
                if (v) out.push({ where: `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}[${attr}]`, text: v });
            }
        });
        out.push({ where: "<title>", text: document.title });
        return out;
    });
}

async function checkState(page, label, lang) {
    const texts = await collectTexts(page);
    let bad = 0;
    for (const { where, text } of texts) {
        const cleaned = stripUserData(text);
        const wrong = lang === "en"
            ? (FRENCH_ACCENTS.test(cleaned) || FRENCH_WORDS.test(cleaned))
            : ENGLISH_WORDS.test(cleaned);
        if (wrong) {
            bad++;
            fail(`[${lang}] ${label}: ${where} "${text.replace(/\s+/g, " ").slice(0, 120)}"`);
        }
    }
    console.log(`  ${bad ? "✗" : "✓"} [${lang}] ${label} (${texts.length} strings)`);
}

function checkDialogs(lang) {
    for (const msg of dialogs.splice(0)) {
        const cleaned = stripUserData(msg);
        const wrong = lang === "en"
            ? (FRENCH_ACCENTS.test(cleaned) || FRENCH_WORDS.test(cleaned))
            : ENGLISH_WORDS.test(cleaned);
        if (wrong) fail(`[${lang}] dialog: "${msg.slice(0, 120)}"`);
        else console.log(`  ✓ [${lang}] dialog: "${msg.split("\n")[0].slice(0, 80)}"`);
    }
}

async function closeIfOpen(page, modalId, closeBtn) {
    if (await page.isVisible(`#${modalId}`)) await page.click(closeBtn);
}

async function walkApp(page, lang) {
    await checkState(page, "main page", lang);

    // Detail panel filled by hovering a port with PoE
    await page.hover('.port-unit[data-port-id="1"]');
    await checkState(page, "detail panel (hover)", lang);

    // Filters and search
    for (const value of ["up", "down", "poe", "disabled", "all"]) {
        await page.selectOption("#filter-status", value);
        await checkState(page, `status filter = ${value}`, lang);
    }
    const colorValues = await page.$$eval("#filter-color option", opts => opts.map(o => o.value));
    await page.selectOption("#filter-color", colorValues[1]);
    await checkState(page, "color filter", lang);
    await page.fill("#input-search", "zzz-no-match");
    await checkState(page, "search with no match", lang);
    await page.click("#btn-reset-filters");

    // Rack toggles
    await page.click("#btn-toggle-cables");
    await checkState(page, "cables toggled", lang);
    await page.click("#btn-toggle-cables");
    await page.click("#btn-toggle-patchpanel");
    await checkState(page, "patch panel hidden", lang);
    await page.click("#btn-toggle-patchpanel");
    await page.waitForTimeout(200);

    // Theme toggle label
    await page.click("#btn-theme-toggle");
    await checkState(page, "other theme", lang);
    await page.click("#btn-theme-toggle");

    // Port editor + its confirmations (all dismissed)
    await page.click('.port-unit[data-port-id="5"]');
    await page.waitForSelector("#modal-edit-port:not(.hidden)");
    await checkState(page, "port editor (PoE port)", lang);
    await page.click("#btn-toggle-poe");       // confirm: turn PoE off
    await page.click("#btn-toggle-port");      // confirm: disable port
    await page.click("#btn-bounce-poe");       // confirm: power-cycle
    await page.click("#btn-free-port");        // confirm: free port
    checkDialogs(lang);
    await page.click("#btn-cancel-edit");

    // A port without PoE opens the PoE safety modal
    await page.click('.sfp-unit[data-port-id="50"]');
    await page.waitForSelector("#modal-edit-port:not(.hidden)");
    await page.click("#btn-toggle-poe");
    await page.waitForSelector("#modal-poe-warning:not(.hidden)");
    await checkState(page, "PoE safety modal", lang);
    await page.check("#chk-confirm-poe");
    await checkState(page, "PoE safety modal (checked)", lang);
    await page.click("#btn-cancel-poe-warning");
    await page.click("#btn-cancel-edit");

    // Quick cable color modal (click on a drawn cable), then apply a color -> toast
    await page.waitForSelector(".patch-cable-path");
    await page.$eval('.patch-cable-path', el => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await page.waitForSelector("#modal-cable-color:not(.hidden)");
    await checkState(page, "cable color modal", lang);
    await page.click('.quick-swatch-btn[data-color="#22c55e"]');
    await page.waitForSelector("#app-toast:not(.opacity-0)");
    await checkState(page, "toast after color change", lang);

    // Settings modal
    await page.click("#btn-settings");
    await page.waitForSelector("#modal-settings:not(.hidden)");
    await checkState(page, "settings modal", lang);
    await page.click("#btn-cancel-settings");

    // Multi-select bar (Ctrl+click), then a harmless bulk action in demo mode
    await page.click('.port-unit[data-port-id="5"]', { modifiers: ["Control"] });
    await checkState(page, "bulk bar, 1 port", lang);
    await page.click('.port-unit[data-port-id="6"]', { modifiers: ["Control"] });
    await checkState(page, "bulk bar, 2 ports", lang);
    await page.click("#btn-bulk-poe-enable");
    await page.waitForSelector("#bulk-actions-bar.hidden", { state: "attached" });
    await page.waitForSelector("#app-toast:not(.opacity-0)");
    await checkState(page, "toast after bulk action", lang);

    // "Free all ports" confirmation (dismissed)
    await page.click("#btn-reset-all-ports");
    checkDialogs(lang);

    await closeIfOpen(page, "modal-edit-port", "#btn-cancel-edit");
}

async function newPage(browser, locale, storage) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale });
    await context.addInitScript(s => {
        if (!sessionStorage.getItem("__seeded")) {
            localStorage.clear();
            for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
            sessionStorage.setItem("__seeded", "1");
        }
    }, storage);
    const page = await context.newPage();
    page.on("console", msg => {
        if (msg.type() === "error" || (msg.type() === "warning" && msg.text().includes("[i18n]"))) {
            consoleErrors.push(`${msg.type()}: ${msg.text()}`);
        }
    });
    page.on("pageerror", err => consoleErrors.push(`pageerror: ${err.message}`));
    page.on("dialog", async dialog => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
    });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForSelector(".port-unit");
    await page.waitForTimeout(300);
    return { context, page };
}

const browser = await chromium.launch();

// User data from the demo database, ignored by the checks
const status = await (await fetch(`${BASE_URL}/api/status`)).json();
userStrings = [...new Set(status.ports.flatMap(p => [p.custom_name, p.notes, p.patch_panel_port, p.cable_type]).filter(Boolean))]
    .sort((a, b) => b.length - a.length);

console.log("Language detection");
{
    const { context, page } = await newPage(browser, "en-US", {});
    const lang = await page.getAttribute("html", "lang");
    lang === "en" ? console.log("  ✓ browser in en-US -> English") : fail(`browser in en-US -> lang=${lang}`);
    await context.close();
}
{
    const { context, page } = await newPage(browser, "fr-FR", {});
    const lang = await page.getAttribute("html", "lang");
    lang === "fr" ? console.log("  ✓ browser in fr-FR -> French") : fail(`browser in fr-FR -> lang=${lang}`);
    await context.close();
}
{
    const { context, page } = await newPage(browser, "de-DE", {});
    const lang = await page.getAttribute("html", "lang");
    lang === "en" ? console.log("  ✓ browser in de-DE -> English") : fail(`browser in de-DE -> lang=${lang}`);
    await context.close();
}
{
    const { context, page } = await newPage(browser, "fr-FR", { lang: "en" });
    const lang = await page.getAttribute("html", "lang");
    lang === "en" ? console.log("  ✓ saved preference wins over the browser") : fail(`saved "en" ignored, lang=${lang}`);
    await context.close();
}

console.log("English walk-through");
const { context, page } = await newPage(browser, "en-US", { lang: "en" });
const watts = await page.textContent("#stat-poe-watts");
/^\d+\.\d W$/.test(watts) ? console.log(`  ✓ number format en: ${watts}`) : fail(`number format en: "${watts}"`);
await walkApp(page, "en");

console.log("Switch to French without reloading");
await page.evaluate(() => { window.__noReload = true; });
await page.click('[data-lang-option="fr"]');
const kept = await page.evaluate(() => window.__noReload === true);
kept ? console.log("  ✓ no page reload") : fail("page reloaded on language switch");
const htmlLang = await page.getAttribute("html", "lang");
htmlLang === "fr" ? console.log("  ✓ <html lang> = fr") : fail(`<html lang> = ${htmlLang}`);
const settingsLabel = (await page.textContent("#btn-settings")).trim();
settingsLabel === "Configuration" ? console.log("  ✓ header translated") : fail(`settings button: "${settingsLabel}"`);
const wattsFr = await page.textContent("#stat-poe-watts");
/^\d+,\d W$/.test(wattsFr) ? console.log(`  ✓ number format fr: ${wattsFr}`) : fail(`number format fr: "${wattsFr}"`);
await walkApp(page, "fr");

console.log("Preference kept after reload");
await page.reload({ waitUntil: "networkidle" });
const afterReload = await page.getAttribute("html", "lang");
afterReload === "fr" ? console.log("  ✓ still French") : fail(`after reload lang=${afterReload}`);
await context.close();
await browser.close();

console.log("Browser console");
if (consoleErrors.length) consoleErrors.forEach(e => fail(e));
else console.log("  ✓ no errors");

console.log(failures.length ? `\nFAILED: ${failures.length} problem(s)` : "\nAll checks passed.");
process.exit(failures.length ? 1 : 0);
