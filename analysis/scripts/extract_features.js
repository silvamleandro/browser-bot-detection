/**
 * Rebuild the feature matrix from stored raw sessions, running the same
 * web/src/features.js the browser runs. Sessions are stored as raw events, so
 * this can be re-run after any feature change without recollecting anything.
 *
 *   node analysis/scripts/extract_features.js
 *   node analysis/scripts/extract_features.js --in data/raw --out data/features/features.csv
 *   node analysis/scripts/extract_features.js --cuts 500,1000,5000 --out data/features/timeline.csv
 *
 * With --cuts, each session is emitted once per cut instead of once in total, with
 * only the events up to that instant. That is what lets the analysis ask what the
 * page would have answered a second into the visit, instead of only at the end.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFeatures } from '../../web/src/features.js';
import { scoreBaseline, RULES } from '../../web/src/baseline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const IN = path.resolve(ROOT, arg('in', 'data/raw'));
const OUT = path.resolve(ROOT, arg('out', 'data/features/features.csv'));

/** Milliseconds from session start at which to cut, or null for whole sessions. */
const CUTS = (arg('cuts', '') || '')
  .split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v) && v > 0);
const cutList = CUTS.length ? CUTS.sort((a, b) => a - b) : null;

// baseline_* come from the same rule engine the page runs. baseline_rules carries
// the ids so the analysis can audit rule by rule, not just count how many fired.
const META_COLS = ['session_id', 'label', 'tool', 'config', 'journey', 'evasion',
  'headless', 'participant', 'viewport', 'locale', 'timezone', 'n_events', 'elapsed_ms',
  'baseline_prob', 'baseline_score', 'baseline_rules_fired', 'baseline_rules'];
if (cutList) META_COLS.push('cut_ms');

function* readSessions(dir) {
  const files = fs.statSync(dir).isDirectory()
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(dir, f))
    : [dir];
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try { yield JSON.parse(line); } catch (_) { /* skip malformed line */ }
    }
  }
}

const rows = [];
let featureNames = null;
let skipped = 0;

/** Event `t` is milliseconds from session start, so a cut is just a filter. */
function truncate(s, ms) {
  return {
    ...s,
    events: (s.events || []).filter((e) => e.t <= ms),
    elapsed_ms: Math.min(s.elapsed_ms || 0, ms),
  };
}

for (const s of readSessions(IN)) {
  const m = s.meta || {};
  if (!m.label) { skipped++; continue; }
  for (const cut of cutList || [null]) {
    const view = cut === null ? s : truncate(s, cut);
    const f = extractFeatures(view);
    const b = scoreBaseline(f);
    if (!featureNames) featureNames = Object.keys(f).sort();
    rows.push({
      meta: {
        session_id: s.session_id,
        label: m.label,
        tool: m.tool || '',
        config: m.config || '',
        journey: m.journey || '',
        evasion: m.evasion || '',
        headless: m.headless === true ? 1 : (m.headless === false ? 0 : ''),
        participant: m.participant || '',
        viewport: m.viewport || '',
        locale: m.locale || '',
        timezone: m.timezone || '',
        n_events: (view.events || []).length,
        elapsed_ms: Math.round(view.elapsed_ms || 0),
        baseline_prob: b.probability.toFixed(6),
        baseline_score: b.raw_score.toFixed(3),
        baseline_rules_fired: b.fired.length,
        baseline_rules: b.fired.map((r) => r.id).join('|'),
        cut_ms: cut === null ? '' : cut,
      },
      features: f,
    });
  }
}

if (!rows.length) {
  console.error(`nenhuma sessão rotulada encontrada em ${IN}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const header = [...META_COLS, ...featureNames].join(',');
const lines = rows.map((r) => {
  const meta = META_COLS.map((c) => {
    const v = r.meta[c];
    return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
  });
  // Empty cell for NaN: pandas reads it as missing, which is what it means.
  const feats = featureNames.map((n) => {
    const v = r.features[n];
    return Number.isFinite(v) ? v : '';
  });
  return [...meta, ...feats].join(',');
});
fs.writeFileSync(OUT, header + '\n' + lines.join('\n') + '\n');

// The rule catalogue travels with the matrix: weights and groups live in
// baseline.js, and the analysis has no way to read JavaScript. Without this the
// audit would have to restate the weights, and the two copies would drift.
const RULES_OUT = path.join(path.dirname(OUT), 'rules.json');
fs.writeFileSync(RULES_OUT, JSON.stringify(
  RULES.map((r) => ({ id: r.id, layer: r.layer, group: r.group, w: r.w, why: r.why })),
  null, 2) + '\n');

const byLabel = {};
for (const r of rows) byLabel[r.meta.label] = (byLabel[r.meta.label] || 0) + 1;
console.log(`${rows.length} linhas -> ${OUT}`);
if (cutList) console.log(`cortes: ${cutList.join(', ')} ms`);
console.log(`${featureNames.length} features`);
console.log('rótulos:', JSON.stringify(byLabel));
if (skipped) console.log(`${skipped} sessões sem rótulo ignoradas`);
