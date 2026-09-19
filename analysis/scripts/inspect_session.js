/**
 * Inspect the most recent stored sessions: verdict, reason codes, key signals.
 * Debugging aid for understanding what a given configuration actually produces.
 *
 *   node analysis/scripts/inspect_session.js [--n 1] [--filter humanized]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFeatures } from '../../web/src/features.js';
import { scoreBaseline } from '../../web/src/baseline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const N = parseInt(arg('n', '1'), 10);
const FILTER = arg('filter', null);

const file = path.join(ROOT, 'data/raw/sessions.jsonl');
let sessions = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
if (FILTER) sessions = sessions.filter((s) => JSON.stringify(s.meta || {}).includes(FILTER));
sessions = sessions.slice(-N);

for (const s of sessions) {
  const f = extractFeatures(s);
  const r = scoreBaseline(f);
  const m = s.meta || {};
  console.log('='.repeat(72));
  console.log(`${m.config || '?'} / ${m.journey || '?'} / rótulo=${m.label}`);
  console.log(`eventos: ${(s.events || []).length}  duração: ${Math.round(s.elapsed_ms)}ms`);
  console.log(`\nVEREDITO: ${r.probability >= 0.5 ? 'BOT' : 'HUMANO'}  `
    + `p=${r.probability.toFixed(4)}  score=${r.raw_score.toFixed(1)}  `
    + `regras avaliadas=${r.rules_evaluated}/${r.rules_total}`);
  console.log('\nregras acionadas:');
  for (const x of r.fired) console.log(`  ${x.weight > 0 ? '+' : ''}${x.weight.toFixed(1)}  [${x.layer}] ${x.why}`);
  console.log('\nsinais comportamentais:');
  for (const k of ['b_pm_count', 'b_pm_straightness_p50', 'b_pm_submovement_rate', 'b_pm_reversal_rate',
    'b_pm_speed_cv', 'b_pm_turn_std', 'b_pm_screen_client_eq_ratio', 'b_pm_movement_zero_ratio',
    'b_pm_pressure_unique', 'b_click_no_move_ratio', 'b_click_dwell_mean', 'b_click_dwell_cv',
    'b_interkey_mean', 'b_interkey_cv', 'b_interkey_fast_ratio', 'b_hold_mean',
    'b_input_without_keydown', 'b_scroll_orphan_ratio', 'b_wheel_count', 'b_evidence_score']) {
    const v = f[k];
    console.log(`  ${k.padEnd(32)} ${Number.isFinite(v) ? (Number.isInteger(v) ? v : v.toFixed(4)) : 'n/a'}`);
  }
}
