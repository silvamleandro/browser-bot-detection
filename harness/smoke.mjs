/**
 * End-to-end smoke test: drive the page with a plain Playwright session and print
 * the verdict plus the signals that drove it. Not part of the dataset. This is
 * the check that the collection pipeline works at all.
 *
 *   node collector/server.js &
 *   node harness/smoke.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:8787/?research=1&label=bot&tool=playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// Naive journey: exactly what out-of-the-box automation does.
await page.fill('#field', 'teste automatizado');
await page.click('#btn');
await page.evaluate(() => document.getElementById('scrollbox').scrollTo(0, 400));
await page.waitForTimeout(1200);

const out = await page.evaluate(() => ({
  label: document.getElementById('label').textContent,
  sub: document.getElementById('sub').textContent,
  reasons: Array.from(document.querySelectorAll('.reason .txt')).map((e) => e.textContent),
  features: window.__getFeatures ? window.__getFeatures() : null,
}));

console.log('=== VEREDITO (Playwright headless, jornada ingenua) ===');
console.log('label:', out.label);
console.log('sub  :', out.sub);
console.log('\n=== reason codes ===');
out.reasons.slice(0, 8).forEach((r) => console.log('  -', r));
console.log('\n=== sinais-chave ===');
const keys = [
  'a_webdriver', 'a_known_globals_count', 'a_natives_patched_count', 'a_cdp_stack_getter',
  'a_chrome_absent', 'e_webgl_software', 'e_no_chrome_height', 'e_pointer_none', 'e_font_count',
  'e_h264_absent', 'e_media_device_count', 'e_voices_count', 't_raf_count', 't_raf_vsync_ratio',
  'b_pm_count', 'b_click_no_move_ratio', 'b_interkey_fast_ratio', 'b_input_without_keydown',
  'b_scroll_orphan_ratio', 'b_evidence_score', 'b_untrusted_ratio',
];
for (const k of keys) {
  const v = out.features?.[k];
  console.log(`  ${k.padEnd(30)} ${Number.isFinite(v) ? v : 'n/a'}`);
}
console.log('\nerros de console:', errors.length ? errors : 'nenhum');
await browser.close();
