/**
 * The false positives this detector is not allowed to have.
 *
 * Every case here is a person doing something ordinary that an earlier version of
 * the rules read as automation. They are written as tests because "a human opens
 * the page" is the requirement that is easiest to break while chasing bots, and
 * the only one nobody notices in a headless run.
 *
 *   node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractFeatures } from '../web/src/features.js';
import { scoreBaseline } from '../web/src/baseline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const verdict = (features) => {
  const r = scoreBaseline(features);
  return { ...r, isBot: r.probability >= r.threshold };
};

/** A plausible desktop Chrome, untouched, as a starting point to vary from. */
function chromeSession(overrides = {}) {
  const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) '
    + 'Chrome/153.0.0.0 Safari/537.36';
  return {
    automation: {
      webdriver: false,
      known_globals_count: 0,
      doc_automation_keys_count: 0,
      exposed_binding_found: false,
      ua_headless_marker: false,
      chrome_present: true,
      chrome_has_csi: true,
      chrome_csi_native: true,
      natives_checked: 12,
      natives_patched_count: 0,
      webdriver_own_prop: false,
      webdriver_descriptor_kind: 'accessor',
      webdriver_getter_native: true,
      cdp_stack_getter: false,
      ...(overrides.automation || {}),
    },
    env: {
      user_agent: ua,
      platform: 'Linux x86_64',
      uach_platform: 'Linux',
      uach_brands: 'Chromium:153|Not_A Brand:8|Google Chrome:153',
      // The untouched state, spelled two different ways by two different APIs.
      notification_permission: 'default',
      perm_notifications: 'prompt',
      inner_w: 1280, inner_h: 720, outer_w: 1280, outer_h: 800,
      screen_w: 1920, screen_h: 1080, avail_h: 1050,
      webgl_supported: true,
      webgl_unmasked_renderer: 'NVIDIA GeForce RTX 3060/PCIe/SSE2',
      font_count: 24,
      media_device_count: 2,
      voices_count: 0,
      codec_h264: 'probably', codec_aac: 'probably',
      css_pointer_fine: true, css_pointer_none: false, css_any_pointer_none: false,
      max_touch_points: 0,
      tz_offset_minutes: 180, tz_offset_jan: 180, tz_offset_jul: 180,
      timezone: 'America/Sao_Paulo',
      ...(overrides.env || {}),
    },
    timing: {
      raf_frame_count: 45, raf_mean_ms: 16.6, raf_std_ms: 1.2,
      raf_vsync_band_ratio: 1, paint_entry_count: 2,
      ...(overrides.timing || {}),
    },
    events: overrides.events || [],
    elapsed_ms: overrides.elapsed_ms ?? 8000,
  };
}

/** Pointer path with the jitter a hand produces, ending on the target. */
function approach(toX, toY, t0 = 1000) {
  const moves = [];
  for (let i = 0; i < 40; i++) {
    const k = i / 39;
    moves.push({
      e: 'pm', t: t0 + i * 16, et: t0 + i * 16, tr: 1,
      x: toX - 300 * (1 - k) + (i % 3 - 1) * 2,
      y: toY - 160 * (1 - k) ** 1.7 + (i % 2 ? 1.5 : -1.5),
      sx: toX - 300 * (1 - k), sy: toY - 160 * (1 - k) ** 1.7 + 87,
      mx: 7, my: 4, p: 0, pt: 'mouse', b: 0,
    });
  }
  return moves;
}

test('a browser nobody has touched reads as human', () => {
  const v = verdict(extractFeatures(chromeSession()));
  assert.equal(v.isBot, false, `fired: ${v.fired.map((f) => f.id).join(',')}`);
});

test('an empty feature map is not evidence of automation', () => {
  // The bias has to carry this one: no signal at all must not land on the boundary.
  assert.equal(verdict({}).isBot, false);
});

test('Firefox and Safari are not bots for lacking window.chrome', () => {
  for (const [name, env] of [
    ['Firefox', {
      user_agent: 'Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0',
      uach_brands: '', uach_platform: '', codec_h264: '', codec_aac: '',
    }],
    ['Safari', {
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 '
        + '(KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      platform: 'MacIntel', uach_brands: '', uach_platform: '',
    }],
  ]) {
    const session = chromeSession({
      env,
      // Neither browser exposes window.chrome, and Safari may not expose
      // navigator.webdriver on the prototype either.
      automation: {
        chrome_present: false, chrome_has_csi: false, chrome_csi_native: undefined,
        webdriver_descriptor_kind: name === 'Safari' ? 'missing' : 'accessor',
      },
    });
    const v = verdict(extractFeatures(session));
    assert.equal(v.isBot, false, `${name} flagged: ${v.fired.map((f) => f.id).join(',')}`);
  }
});

test('opening DevTools does not flip the verdict', () => {
  const session = chromeSession({ automation: { cdp_stack_getter: true } });
  assert.equal(verdict(extractFeatures(session)).isBot, false);
});

test('a background tab renders no frames and that is not evidence', () => {
  const session = chromeSession({
    timing: { raf_hidden: true, raf_frame_count: 0, raf_vsync_band_ratio: -1 },
  });
  const f = extractFeatures(session);
  assert.ok(Number.isNaN(f.t_raf_absent), 't_raf_absent should be undecidable, not 1');
  assert.equal(verdict(f).isBot, false);
});

test('a high refresh rate display stays inside the vsync band', () => {
  const session = chromeSession({
    timing: { raf_frame_count: 45, raf_mean_ms: 4.2, raf_std_ms: .4, raf_vsync_band_ratio: 1 },
  });
  assert.equal(verdict(extractFeatures(session)).isBot, false);
});

test('a mouse reports one pressure value and that means nothing', () => {
  const f = extractFeatures(chromeSession({ events: approach(400, 300) }));
  assert.ok(Number.isNaN(f.b_pm_pressure_unique),
    'only a pen grades pressure, so it must be undecidable for a mouse');
});

test('a person who pauses before clicking still approached the target', () => {
  const moves = approach(400, 300, 1000);
  const session = chromeSession({
    events: [
      ...moves,
      // Four seconds of reading with the cursor resting on the button.
      { e: 'pd', t: 6000, et: 6000, tr: 1, x: 400, y: 300, sx: 400, sy: 387, p: .5, pt: 'mouse', b: 1 },
      { e: 'pu', t: 6090, et: 6090, tr: 1, x: 400, y: 300, sx: 400, sy: 387, p: 0, pt: 'mouse', b: 0 },
      { e: 'cl', t: 6091, et: 6091, tr: 1, x: 400, y: 300, sx: 400, sy: 387, d: 1, tag: 'button' },
    ],
  });
  const f = extractFeatures(session);
  assert.equal(f.b_click_no_move_ratio, 0, 'the approach happened, it was just not recent');
  assert.equal(verdict(f).isBot, false);
});

test('a tap and a keyboard activation are not pointerless clicks', () => {
  const session = chromeSession({
    env: {
      user_agent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) '
        + 'Chrome/153.0.0.0 Mobile Safari/537.36',
      uach_platform: 'Android', max_touch_points: 5,
      css_pointer_fine: false, css_pointer_none: false,
    },
    events: [
      { e: 'ts', t: 1200, et: 1200, tr: 1, n: 1 },
      { e: 'pd', t: 1205, et: 1205, tr: 1, x: 200, y: 400, sx: 200, sy: 487, p: .4, pt: 'touch', b: 1 },
      { e: 'pu', t: 1320, et: 1320, tr: 1, x: 200, y: 400, sx: 200, sy: 487, p: 0, pt: 'touch', b: 0 },
      { e: 'te', t: 1322, et: 1322, tr: 1, n: 0 },
      { e: 'cl', t: 1325, et: 1325, tr: 1, x: 200, y: 400, sx: 200, sy: 487, d: 1, tag: 'button' },
      // Scrolling a phone produces no wheel events at all.
      { e: 'ts', t: 2000, et: 2000, tr: 1, n: 1 },
      { e: 'sc', t: 2050, et: 2050, tr: 1, sy: 120, sx: 0 },
      { e: 'sc', t: 2100, et: 2100, tr: 1, sy: 260, sx: 0 },
      { e: 'te', t: 2150, et: 2150, tr: 1, n: 0 },
      // And a keyboard activation has no pointer behind it by definition.
      { e: 'cl', t: 3000, et: 3000, tr: 1, x: 0, y: 0, sx: 0, sy: 0, d: 0, tag: 'button' },
    ],
  });
  const f = extractFeatures(session);
  assert.ok(Number.isNaN(f.b_click_no_move_ratio), 'taps and key activations are excluded');
  assert.equal(f.b_scroll_no_input, 0, 'touch is an input device');
  assert.equal(verdict(f).isBot, false);
});

test('scrolling with the keyboard is not a scripted scroll', () => {
  const events = [
    { e: 'kd', t: 2000, et: 2000, tr: 1, c: 'space', rep: 0, loc: 0, mod: 0 },
  ];
  // Chrome animates keyboard scrolling, so one key press emits a burst of events.
  for (let i = 0; i < 9; i++) events.push({ e: 'sc', t: 2016 + i * 16, et: 2016 + i * 16, tr: 1, sy: 70 * i, sx: 0 });
  const f = extractFeatures(chromeSession({ events }));
  assert.equal(f.b_scroll_no_input, 0);
  assert.equal(f.b_scroll_orphan_ratio, 0);
  assert.equal(verdict(f).isBot, false);
});

test('dragging a scrollbar is not a scripted scroll', () => {
  // Recorded from a real drag in Chromium: pointerdown on the bar, scroll events
  // while the button is held, pointerup, and no pointermove in between.
  const press = (e, t, b) => ({ e, t, et: t, tr: 1, x: 812, y: 540, sx: 812, sy: 627, p: b * .5, pt: 'mouse', b });
  const scrolls = (t0) => Array.from({ length: 12 }, (_, i) =>
    ({ e: 'sc', t: t0 + i * 16, et: t0 + i * 16, tr: 1, sy: 20 * i, sx: 0, target: 1 }));
  const drag = [...approach(812, 540), press('pd', 2000, 1), ...scrolls(2100), press('pu', 2400, 0)];
  const f = extractFeatures(chromeSession({ events: drag }));
  assert.ok(Number.isNaN(f.b_scroll_no_input), 'scrolls inside the press are explained by it');
  assert.equal(verdict(f).fired.some((r) => r.id === 'scroll_programmatic'), false);

  // A click does not explain a scroll that starts after the button is released.
  const clickThenScript = [press('pd', 2000, 1), press('pu', 2080, 0), ...scrolls(2400)];
  assert.equal(extractFeatures(chromeSession({ events: clickThenScript })).b_scroll_no_input, 1);
});

test('pasting into the field is not a programmatic fill', () => {
  const session = chromeSession({
    events: [
      { e: 'kd', t: 3000, et: 3000, tr: 1, c: 'modifier', rep: 0, loc: 1, mod: 2 },
      { e: 'kd', t: 3080, et: 3080, tr: 1, c: 'alpha', rep: 0, loc: 0, mod: 2 },
      { e: 'pa', t: 3090, et: 3090, tr: 1 },
      { e: 'ip', t: 3095, et: 3095, tr: 1, it: 'insertFromPaste', len: 42 },
    ],
  });
  const f = extractFeatures(session);
  assert.equal(f.b_input_without_keydown, 0);
  assert.ok(Number.isNaN(f.b_input_len_jump_max), 'a paste is not a typing burst');
  assert.equal(verdict(f).isBot, false);
});

test('holding a key down is the keyboard repeating, not superhuman typing', () => {
  const events = [];
  for (let i = 0; i < 12; i++) {
    events.push({ e: 'kd', t: 3000 + i * 28, et: 3000 + i * 28, tr: 1, c: 'erase', rep: i > 0 ? 1 : 0, loc: 0, mod: 0 });
  }
  const f = extractFeatures(chromeSession({ events }));
  assert.ok(Number.isNaN(f.b_interkey_fast_ratio) || f.b_interkey_fast_ratio === 0,
    'autorepeat must not count as inter-key latency');
  assert.equal(verdict(f).isBot, false);
});

test('every recorded automated session without careful evasion is still caught', () => {
  // The launch flag and the public stealth plugin get past the rules when the journey
  // does not fill or click like a script. That is a measured limit, reported in
  // docs/03-resultados.md, not a regression this test should hide or demand.
  const knownEvasion = (m) => ['flag', 'stealth-plugin'].includes(m.evasion) && m.journey !== 'naive';
  const files = [
    path.join(ROOT, 'data/sample/sessions.sample.jsonl'),
    path.join(ROOT, 'data/raw/sessions.jsonl'),
    path.join(ROOT, 'data/quarantine/pre-ui-fix.jsonl'),
  ].filter((f) => fs.existsSync(f));

  let checked = 0;
  for (const file of files) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const session = JSON.parse(line);
      if ((session.meta || {}).label !== 'bot' || knownEvasion(session.meta)) continue;
      const v = verdict(extractFeatures(session));
      assert.equal(v.isBot, true,
        `${session.meta.config}/${session.meta.journey} escaped with p=${v.probability.toFixed(3)}`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'no recorded bot sessions found to check against');
});

test('a browser that reports two different GPUs was rewritten', () => {
  // The evasion layer patches WebGLRenderingContext.prototype.getParameter and
  // leaves WebGL2RenderingContext alone, so the lie covers one context only.
  const session = chromeSession({
    env: {
      webgl_unmasked_renderer: 'Intel Iris OpenGL Engine',
      webgl2_supported: true,
      webgl2_unmasked_renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)',
    },
  });
  const f = extractFeatures(session);
  assert.equal(f.e_webgl_renderer_mismatch, 1);
  assert.equal(verdict(f).fired.some((r) => r.id === 'webgl_context_mismatch'), true);
});

test('a browser that hides its renderer from both contexts is not accused', () => {
  // Safari removed WEBGL_debug_renderer_info: both probes come back as sentinels,
  // and "could not tell twice" is not a contradiction.
  const session = chromeSession({
    env: {
      webgl_unmasked_renderer: '__absent__', webgl_renderer: 'WebKit WebGL',
      webgl2_unmasked_renderer: '__absent__', webgl2_renderer: 'WebKit WebGL',
    },
  });
  const f = extractFeatures(session);
  assert.equal(f.e_webgl_renderer_mismatch, 0);
  assert.equal(verdict(f).isBot, false);
});

test('an iPhone is not a Mac that lies about its platform', () => {
  // iOS writes "like Mac OS X" into its User-Agent and reports "iPhone" as the
  // platform. Read as macOS, that was a contradiction on every iPhone, and one more
  // weak signal (here, no toolbar height) put the verdict exactly on the line.
  const session = chromeSession({
    env: {
      user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 '
        + '(KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      platform: 'iPhone', uach_platform: '', uach_brands: '', max_touch_points: 5,
      outer_h: 720,
    },
    automation: { chrome_present: false, chrome_has_csi: false, chrome_csi_native: undefined },
  });
  const f = extractFeatures(session);
  assert.equal(f.e_ua_platform_mismatch, 0);
  assert.equal(verdict(f).isBot, false);
});

test('pasting between keystrokes is not a programmatic fill', () => {
  const kd = (t) => ({ e: 'kd', t, et: t, tr: 1, c: 'alpha', rep: 0, loc: 0, mod: 0 });
  const ip = (t, len, it = 'insertText') => ({ e: 'ip', t, et: t, tr: 1, it, len });
  const session = chromeSession({
    events: [
      kd(1000), ip(1004, 1), kd(1150), ip(1154, 2), kd(1300), ip(1304, 3),
      { e: 'pa', t: 2000, et: 2000, tr: 1 }, ip(2004, 40, 'insertFromPaste'),
      kd(2600), ip(2604, 41),
    ],
  });
  const f = extractFeatures(session);
  assert.equal(f.b_input_len_jump_max, 1, 'the pasted text is not charged to the next keystroke');
  assert.equal(verdict(f).fired.some((r) => r.id === 'programmatic_fill'), false);
});

test('typing through a phone keyboard composition is not a programmatic fill', () => {
  // Android keyboards compose each word, commit the space as plain text, and report
  // every key as "Unidentified".
  const events = [];
  let t = 1000;
  let len = 0;
  for (const word of ['digitando', 'pelo', 'celular']) {
    for (let i = 0; i < word.length; i++) {
      events.push({ e: 'kd', t, et: t, tr: 1, c: 'other', rep: 0, loc: 0, mod: 0 });
      events.push({ e: 'ip', t: t + 3, et: t + 3, tr: 1, it: 'insertCompositionText', len: ++len });
      t += 180;
    }
    events.push({ e: 'kd', t, et: t, tr: 1, c: 'other', rep: 0, loc: 0, mod: 0 });
    events.push({ e: 'ip', t: t + 3, et: t + 3, tr: 1, it: 'insertText', len: ++len });
    t += 250;
  }
  const f = extractFeatures(chromeSession({ events }));
  assert.equal(verdict(f).fired.some((r) => r.id === 'programmatic_fill'), false);
});

test('swiping a phone screen is not a scripted pointer', () => {
  // A swipe is a straight line with no movement delta from a mouse driver. Read as
  // cursor kinematics, it looked like a script drawing the path.
  const events = [];
  for (let s = 0; s < 5; s++) {
    const t0 = 1000 + s * 900;
    events.push({ e: 'ts', t: t0, et: t0, tr: 1, n: 1 });
    for (let i = 0; i < 8; i++) {
      const t = t0 + 10 + i * 16;
      events.push({ e: 'pm', t, et: t, tr: 1, x: 200, y: 600 - i * 40, sx: 200, sy: 600 - i * 40,
        mx: 0, my: 0, p: 1, pt: 'touch', b: 1 });
    }
    events.push({ e: 'te', t: t0 + 200, et: t0 + 200, tr: 1, n: 0 });
  }
  const session = chromeSession({
    env: {
      user_agent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) '
        + 'Chrome/153.0.0.0 Mobile Safari/537.36',
      uach_platform: 'Android', max_touch_points: 5, css_pointer_fine: false,
    },
    events,
  });
  const f = extractFeatures(session);
  assert.ok(Number.isNaN(f.b_pm_count), 'touch moves are not cursor kinematics');
  assert.equal(verdict(f).isBot, false);
});
