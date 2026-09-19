/**
 * Static server for web/ plus research session collector, appending to JSONL.
 *
 * Same server for both, so automated and human sessions take an identical path
 * and no difference in collection can leak into the labels.
 *
 *   node collector/server.js [--port 8787] [--out data/raw/sessions.jsonl]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PORT = parseInt(arg('port', '8787'), 10);
const OUT = path.resolve(ROOT, arg('out', 'data/raw/sessions.jsonl'));
const WEB = path.join(ROOT, 'web');

fs.mkdirSync(path.dirname(OUT), { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

let written = 0;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && req.url.startsWith('/collect')) {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      // A record is a few hundred KB at most. Drop rather than buffer.
      if (size > 8 * 1024 * 1024) { req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf8');
        const rec = JSON.parse(body);
        rec.received_at = new Date().toISOString();
        fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
        written++;
        const m = rec.meta || {};
        console.log(`[${written}] ${m.label || '?'} / ${m.tool || '?'} / ${m.config || '-'} `
          + `| ${(rec.events || []).length} eventos, ${Math.round(rec.elapsed_ms || 0)}ms`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, stored: written }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(err.message) }));
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/stats')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ stored: written, out: OUT }));
    return;
  }

  // --- static ---
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let filePath = path.join(WEB, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(WEB)) { res.writeHead(403); res.end('forbidden'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`página:   http://localhost:${PORT}/`);
  console.log(`coleta:   POST http://localhost:${PORT}/collect`);
  console.log(`gravando: ${OUT}`);
});
