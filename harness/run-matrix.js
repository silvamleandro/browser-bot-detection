/**
 * Bot session generator: tool x mode x evasion x journey.
 *
 * The axes are what the evaluation needs. Leave-one-tool-out needs several tools,
 * and stratified reporting needs evasion and journey to vary independently.
 *
 *   node harness/run-matrix.js --runs 5
 *   node harness/run-matrix.js --tool playwright-chromium --journey humanized --runs 3
 *   node harness/run-matrix.js --list
 */
import { chromium, firefox } from 'playwright';
import playwrightExtra from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { evasionFor } from './evasion.js';
import * as naive from './journeys/naive.js';
import * as humanized from './journeys/humanized.js';

const JOURNEYS = {
  naive,
  humanized,
  // Control: behavioural evidence genuinely absent. The model must not read that
  // absence as proof of automation.
  idle: { run: async (page) => { await page.waitForTimeout(6000); } },
};

// The public stealth plugin, unmodified, so the evasion strata are not only the
// ones written in this repository.
const stealthChromium = playwrightExtra.addExtra(chromium);
stealthChromium.use(StealthPlugin());

const LAUNCHERS = {
  'playwright-chromium': chromium,
  'playwright-firefox': firefox,
  'playwright-stealth': stealthChromium,
};

/**
 * The configuration matrix. Without a channel, Playwright's headless Chromium is the
 * old headless shell; the 'chromium' channel runs the new headless mode.
 */
const CONFIGS = [
  { name: 'pw-chromium-headless',          tool: 'playwright-chromium', headless: true,  evasion: 'none', channel: 'chromium' },
  { name: 'pw-chromium-headful',           tool: 'playwright-chromium', headless: false, evasion: 'none' },
  { name: 'pw-chromium-headless-evasion',  tool: 'playwright-chromium', headless: true,  evasion: 'basic', channel: 'chromium' },
  { name: 'pw-chromium-headful-evasion',   tool: 'playwright-chromium', headless: false, evasion: 'basic' },
  { name: 'pw-chromium-shell',             tool: 'playwright-chromium', headless: true,  evasion: 'none', channel: 'chromium-headless-shell' },
  { name: 'pw-firefox-headless',           tool: 'playwright-firefox',  headless: true,  evasion: 'none' },
  { name: 'pw-firefox-headful',            tool: 'playwright-firefox',  headless: false, evasion: 'none' },
  { name: 'pw-chromium-headful-flag',      tool: 'playwright-chromium', headless: false, evasion: 'flag' },
  { name: 'pw-stealth-headless',           tool: 'playwright-stealth',  headless: true,  evasion: 'stealth-plugin', channel: 'chromium' },
  { name: 'pw-stealth-headful',            tool: 'playwright-stealth',  headless: false, evasion: 'stealth-plugin' },
];

const VIEWPORTS = [
  { width: 1280, height: 720 }, { width: 1440, height: 900 },
  { width: 1920, height: 1080 }, { width: 1366, height: 768 },
];
const LOCALES = ['pt-BR', 'en-US', 'es-ES'];
const TIMEZONES = ['America/Sao_Paulo', 'America/New_York', 'UTC', 'Europe/Lisbon'];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const BASE_URL = arg('url', 'http://localhost:8787');
const COLLECT = arg('collect', 'http://localhost:8787/collect');
const RUNS = parseInt(arg('runs', '3'), 10);
const FILTER_TOOL = arg('tool', null);
const FILTER_JOURNEY = arg('journey', null);
const FILTER_CONFIG = arg('config', null);
const FILTER_EVASION = arg('evasion', null);

if (has('list')) {
  console.log('configurações:');
  for (const c of CONFIGS) console.log(`  ${c.name.padEnd(32)} ${c.tool} headless=${c.headless} evasion=${c.evasion}`);
  console.log('jornadas:', Object.keys(JOURNEYS).join(', '));
  process.exit(0);
}

async function runOne(config, journeyName, index) {
  const launcher = LAUNCHERS[config.tool];
  const ev = evasionFor(config.evasion);
  const viewport = pick(VIEWPORTS);
  const locale = pick(LOCALES);
  const timezoneId = pick(TIMEZONES);

  const launchOpts = { headless: config.headless };
  if (config.channel) launchOpts.channel = config.channel;
  // Launch args are Chromium-only; Firefox rejects them.
  if (ev.args.length && config.tool.includes('chromium')) launchOpts.args = ev.args;

  const browser = await launcher.launch(launchOpts);
  try {
    const context = await browser.newContext({ viewport, locale, timezoneId });
    if (ev.initScript) await context.addInitScript(ev.initScript);
    const page = await context.newPage();

    const url = `${BASE_URL}/?research=1&label=bot&tool=${encodeURIComponent(config.tool)}`
      + `&config=${encodeURIComponent(config.name)}&journey=${encodeURIComponent(journeyName)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Let passive collection finish, so every session has a full snapshot.
    await page.waitForTimeout(2200);

    await JOURNEYS[journeyName].run(page, { log: () => {} });
    await page.waitForTimeout(500);

    // A journey that half-completed produces a session labelled as something it is
    // not, and a mislabelled session is worse than a missing one.
    await JOURNEYS[journeyName].verify?.(page);

    const record = await page.evaluate(() => (window.__getSession ? window.__getSession() : null));
    if (!record) throw new Error('página não expôs __getSession (modo research ativo?)');

    record.meta = {
      ...record.meta,
      label: 'bot',
      tool: config.tool,
      config: config.name,
      journey: journeyName,
      headless: config.headless,
      evasion: config.evasion,
      channel: config.channel || '',
      viewport: `${viewport.width}x${viewport.height}`,
      locale,
      timezone: timezoneId,
      // Each run is its own group, so grouped CV treats bots like humans.
      participant: `bot_${config.name}_${journeyName}_${index}`,
    };

    const res = await fetch(COLLECT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    const ok = res.ok;
    const evCount = (record.events || []).length;
    console.log(`  ${ok ? 'ok ' : 'ERR'} ${config.name}/${journeyName} #${index}: ${evCount} eventos`);
    await context.close();
    return ok;
  } finally {
    await browser.close();
  }
}

const configs = CONFIGS.filter((c) =>
  (!FILTER_TOOL || c.tool === FILTER_TOOL)
  && (!FILTER_CONFIG || c.name === FILTER_CONFIG)
  && (!FILTER_EVASION || c.evasion === FILTER_EVASION));
const journeys = Object.keys(JOURNEYS).filter((j) => !FILTER_JOURNEY || j === FILTER_JOURNEY);

console.log(`matriz: ${configs.length} configs x ${journeys.length} jornadas x ${RUNS} execuções `
  + `= ${configs.length * journeys.length * RUNS} sessões\n`);

let ok = 0; let fail = 0;
for (const config of configs) {
  for (const journey of journeys) {
    for (let i = 0; i < RUNS; i++) {
      try {
        (await runOne(config, journey, i)) ? ok++ : fail++;
      } catch (err) {
        fail++;
        console.log(`  ERR ${config.name}/${journey} #${i}: ${err.message.split('\n')[0]}`);
      }
    }
  }
}
console.log(`\nconcluído: ${ok} sessões gravadas, ${fail} falhas`);
