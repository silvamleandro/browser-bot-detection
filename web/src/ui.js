/**
 * Page controller: live verdict, reason codes, research collection mode.
 *
 * Passive signals land within a second and give an immediate answer; behavioural
 * evidence then revises it. The stage pills show which evidence has arrived.
 */
import { createSession } from './session.js';
import { loadModel } from './infer.js';
import { scoreVisit } from './decision.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

/**
 * Hosted research collector, so the link shared with participants is a plain
 * `?research=1`. Collection needs that flag AND a click on submit.
 * `?endpoint=` overrides it, e.g. to send to the local collector.
 */
const RESEARCH_ENDPOINT = 'https://incognia-case-collector.incognia-bot-detection.workers.dev/collect';
const COLLECTOR_URL = params.get('endpoint') || RESEARCH_ENDPOINT;

let session = createSession();
let model = null;

/**
 * Groups one person's sessions during evaluation. Without it the same person lands
 * on both sides of a train/test split and the metric measures memorisation. The
 * invitation link carries the code (`?participant=P01`), the same on every device;
 * without one, a random code kept in this browser only groups this browser's
 * sessions. Research mode only.
 */
function participantId() {
  const key = 'incognia_case_participant';
  const fromLink = (params.get('participant') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  if (fromLink) {
    try { localStorage.setItem(key, fromLink); } catch (_) { /* private mode */ }
    return fromLink;
  }
  let v = null;
  try { v = localStorage.getItem(key); } catch (_) { /* private mode */ }
  if (!v) {
    v = 'p_' + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem(key, v); } catch (_) { /* fine, session-scoped instead */ }
  }
  return v;
}

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------

function renderVerdict(result) {
  const p = result.probability;
  const threshold = result.threshold ?? 0.5;
  const isBot = p >= threshold;
  const label = $('label');
  const sub = $('sub');

  if (!session.passiveReady) {
    if (lastLabelText !== 'Analysing') { lastLabelText = 'Analysing'; label.textContent = 'Analysing'; }
    label.className = 'label pending';
    if (lastSubText !== 'Collecting environment signals') {
      lastSubText = 'Collecting environment signals';
      sub.textContent = 'Collecting environment signals';
    }
    return;
  }

  const labelText = isBot ? 'Bot / Automation' : 'Human';
  if (labelText !== lastLabelText) { lastLabelText = labelText; label.textContent = labelText; }
  label.className = 'label ' + (isBot ? 'bot' : 'human');

  // Neither the rules nor the optional model have probability calibration.
  const score = (p * 100).toFixed(1);
  const source = result.source === 'model' ? `${result.model_kind} model` : 'rules';
  const subText = `Automation risk score: ${score}/100 (${source})`;
  if (subText !== lastSubText) { lastSubText = subText; sub.textContent = subText; }

  $('pin').style.left = `${Math.min(99, Math.max(1, p * 100))}%`;
}

function renderStages(featureMap) {
  $('st-passive').classList.toggle('on', session.passiveReady);
  $('st-pointer').classList.toggle('on', featureMap.b_has_pointer === 1);
  $('st-keys').classList.toggle('on', featureMap.b_has_keys === 1);
  $('st-scroll').classList.toggle('on', featureMap.b_has_scroll === 1);
}

function renderReasons(result) {
  const box = $('reasons');
  const items = result.fired ?? [];
  const modelNote = result.source === 'model'
    ? '<p class="empty">The score comes from the trained model. The signals below are separate rule checks.</p>'
    : '';
  const html = modelNote + (!items.length
    ? '<p class="empty">No rule-based automation signals found so far.</p>'
    : items.map((r) => `
    <div class="reason ${r.weight >= 0 ? 'pos' : 'neg'}">
      <span class="tag">${r.layer}</span>
      <span class="txt">${r.why}</span>
      <span class="w">${r.weight > 0 ? '+' : ''}${r.weight.toFixed(1)}</span>
    </div>`).join(''));
  if (html !== lastReasonHTML) {
    lastReasonHTML = html;
    box.innerHTML = html;
  }
}

/**
 * Redrawing perturbs what we are measuring.
 *
 * An earlier version rebuilt the whole signal table every tick. That shifted layout
 * and emitted scroll events at exactly the update period, which landed in the
 * recorded sessions as scrolling nobody did. So: nothing is written unless it
 * changed, and the table is only built while its panel is open.
 *
 * The same reasoning moved the reason-code card below the interaction area in
 * index.html: the list grows as rules fire, and anything that grows above a target
 * moves that target out from under the pointer while someone is reaching for it.
 */
let lastSignalHTML = '';
let lastReasonHTML = '';
let lastLabelText = '';
let lastSubText = '';

function renderSignals(featureMap) {
  const names = Object.keys(featureMap).sort();
  if ($('sigcount').textContent !== String(names.length)) {
    $('sigcount').textContent = names.length;
  }
  const panel = document.querySelector('details');
  if (!panel || !panel.open) return;

  const html = names.map((n) => {
    const v = featureMap[n];
    const na = !Number.isFinite(v);
    const shown = na ? 'n/a' : (Number.isInteger(v) ? v : v.toFixed(4));
    return `<tr><td>${n}</td><td class="${na ? 'na' : ''}">${shown}</td></tr>`;
  }).join('');
  if (html !== lastSignalHTML) {
    lastSignalHTML = html;
    $('sigtable').innerHTML = html;
  }
}

// ---------------------------------------------------------------------------
// update loop
// ---------------------------------------------------------------------------

function update() {
  const featureMap = session.features();
  const result = scoreVisit(featureMap, model);

  renderVerdict(result);
  renderStages(featureMap);
  renderReasons(result);
  renderSignals(featureMap);

  return result;
}

// ---------------------------------------------------------------------------
// research mode
// ---------------------------------------------------------------------------

function setupResearchMode() {
  if (params.get('research') !== '1') return;

  const panel = $('research');
  panel.classList.add('on');
  const label = params.get('label') || 'human';
  const tool = params.get('tool') || 'browser';
  const pid = participantId();

  $('research-desc').textContent =
    `Session labelled "${label}" (source: ${tool}). Participant: ${pid}. `
    + 'Nothing is sent until you click submit.';

  const meta = () => ({
    label,
    tool,
    participant: pid,
    config: params.get('config') || '',
    journey: params.get('journey') || '',
    note: params.get('note') || '',
  });

  $('submit').addEventListener('click', async () => {
    const status = $('research-status');
    status.textContent = 'Sending';
    try {
      const res = await fetch(COLLECTOR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session.record(meta())),
      });
      status.textContent = res.ok ? 'Sent. Thank you!' : `Failed (${res.status})`;
    } catch (err) {
      status.textContent = 'Network error. Try "Download JSON" instead.';
    }
  });

  $('download').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(session.record(meta()))], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `session_${label}_${session.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // The harness has nobody to click submit, so expose the record directly.
  window.__getSession = () => session.record(meta());
  window.__getFeatures = () => session.features(meta());
  window.__getVerdict = () => update();
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

function fillScrollbox() {
  const text = [
    'Scroll this block to generate scrolling signals.',
    'Automation tools usually scroll a page with a single scripted call,',
    'producing an instant jump with none of the wheel events a physical device emits.',
    'A person scrolls in short bursts, with acceleration and irregular pauses between them.',
    'The same holds for the pointer: a human hand corrects its trajectory several times before',
    'reaching the target, while a scripted path tends to be too smooth, or too straight.',
    'Typing follows the same principle. The interval between one person\'s keystrokes rarely',
    'falls below 50ms, and it varies considerably with the letter combination and how',
    'familiar the text is.',
  ].join(' ');
  $('scrollbox').textContent = text.repeat(3);
}

async function boot() {
  fillScrollbox();
  setupResearchMode();

  const modelReady = loadModel();

  $('btn').addEventListener('click', update);
  $('field').addEventListener('input', update);
  $('reset').addEventListener('click', () => {
    session.stop();
    // The field has to start empty, or the first keystroke of the new session
    // reports the old text as one programmatic jump in field length.
    $('field').value = '';
    session = createSession();
    session.ready.then(update);
    update();
  });

  update();
  // Passive rules can answer even while the model is still downloading.
  modelReady.then((loaded) => { model = loaded; update(); });
  await session.ready;
  update();
  setInterval(update, 500);
}

boot();
