/**
 * Consolidate sessions stored by the Worker in KV into the local JSONL file that
 * the rest of the pipeline reads.
 *
 *   node analysis/scripts/fetch_sessions.js [--out data/raw/collected.jsonl]
 *
 * Requires wrangler to be authenticated (`npx wrangler login`).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const OUT = path.resolve(ROOT, arg('out', 'data/raw/collected.jsonl'));
const WORKER_DIR = path.join(ROOT, 'collector/worker');

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: WORKER_DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
}

console.log('listando sessões no KV (binding SESSIONS)...');
const listing = wrangler(['kv', 'key', 'list', '--binding', 'SESSIONS', '--remote', '--prefix', 'sessions/']);
const keys = JSON.parse(listing).map((entry) => entry.name);
console.log(`${keys.length} sessões encontradas`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const seen = new Set();
if (fs.existsSync(OUT)) {
  for (const l of fs.readFileSync(OUT, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try { seen.add(JSON.parse(l).session_id); } catch (_) { /* ignore */ }
  }
  console.log(`${seen.size} já presentes localmente`);
}

let added = 0;
let failed = 0;
for (const key of keys) {
  const id = path.basename(key, '.json');
  if (seen.has(id)) continue;
  try {
    const raw = wrangler(['kv', 'key', 'get', key, '--binding', 'SESSIONS', '--remote', '--text']);
    const rec = JSON.parse(raw);
    if (rec.session_id !== id || !Array.isArray(rec.events)) {
      throw new Error('sessão inválida ou identificador diferente da chave');
    }
    fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
    seen.add(id);
    added++;
  } catch (err) {
    failed++;
    console.error(`falhou: ${key}: ${err.message.split('\n')[0]}`);
  }
}
console.log(`${added} novas sessões -> ${OUT}`);
if (failed) process.exitCode = 1;
