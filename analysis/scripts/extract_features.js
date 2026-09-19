/**
 * Rebuild the feature matrix from stored raw sessions, running the same
 * web/src/features.js the browser runs. Sessions are stored as raw events, so
 * this can be re-run after any feature change without recollecting anything.
 *
 *   node analysis/scripts/extract_features.js
 *   node analysis/scripts/extract_features.js --in data/raw --out data/features/features.csv
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

const IN = path.resolve(ROOT, arg('in', 'data/raw'));
const OUT = path.resolve(ROOT, arg('out', 'data/features/features.csv'));

// baseline_* come from the same rule engine the page runs.
const META_COLS = ['session_id', 'label', 'tool', 'config', 'journey', 'evasion',
  'headless', 'participant', 'viewport', 'locale', 'timezone', 'n_events', 'elapsed_ms',
  'baseline_prob', 'baseline_score', 'baseline_rules_fired'];

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

for (const s of readSessions(IN)) {
  const m = s.meta || {};
  if (!m.label) { skipped++; continue; }
  const f = extractFeatures(s);
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
      n_events: (s.events || []).length,
      elapsed_ms: Math.round(s.elapsed_ms || 0),
      baseline_prob: b.probability.toFixed(6),
      baseline_score: b.raw_score.toFixed(3),
      baseline_rules_fired: b.fired.length,
    },
    features: f,
  });
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

const byLabel = {};
for (const r of rows) byLabel[r.meta.label] = (byLabel[r.meta.label] || 0) + 1;
console.log(`${rows.length} sessões -> ${OUT}`);
console.log(`${featureNames.length} features`);
console.log('rótulos:', JSON.stringify(byLabel));
if (skipped) console.log(`${skipped} sessões sem rótulo ignoradas`);
