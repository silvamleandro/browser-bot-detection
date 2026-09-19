/**
 * Layer D: behavioural event recorder.
 *
 * PRIVACY: key identities are never recorded, only a coarse category and timing.
 * Someone typing a password here must not leave it in the dataset, and keystroke
 * dynamics does not need to know which characters were pressed.
 */

const MAX_EVENTS = 12000;

/** Deliberately lossy: enough for dynamics, useless for recovery. */
function keyCategory(e) {
  const k = e.key;
  if (typeof k !== 'string') return 'other';
  if (k.length === 1) {
    if (/[a-zA-Z]/.test(k)) return 'alpha';
    if (/[0-9]/.test(k)) return 'digit';
    if (k === ' ') return 'space';
    return 'punct';
  }
  if (k === 'Backspace' || k === 'Delete') return 'erase';
  if (k === 'Enter' || k === 'Tab') return 'submit';
  if (k.startsWith('Arrow')) return 'arrow';
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(k)) return 'modifier';
  return 'other';
}

export function startRecorder(root = document) {
  const events = [];
  const t0 = performance.now();
  let truncated = false;

  const push = (rec) => {
    if (events.length >= MAX_EVENTS) { truncated = true; return; }
    events.push(rec);
  };

  /**
   * `t` is our clock at handler entry, `et` the event's own timestamp. Injected
   * events relate the two differently, and the quantisation of `et` is itself a
   * signal, so neither is rounded.
   */
  const base = (e, type) => ({
    e: type,
    t: performance.now() - t0,
    et: e.timeStamp,
    tr: e.isTrusted ? 1 : 0,
  });

  const handlers = [];
  const on = (target, type, fn, opts = { passive: true, capture: true }) => {
    target.addEventListener(type, fn, opts);
    handlers.push([target, type, fn, opts]);
  };

  // --- pointer ----------------------------------------------------------
  // A real pointer event carries a screen position offset by the window's position
  // on the desktop. Injected events often report screen == client.
  const pointerRec = (e, type) => ({
    ...base(e, type),
    x: e.clientX,
    y: e.clientY,
    sx: e.screenX,
    sy: e.screenY,
    mx: e.movementX,
    my: e.movementY,
    p: e.pressure,
    w: e.width,
    h: e.height,
    tx: e.tiltX,
    ty: e.tiltY,
    pt: e.pointerType,
    b: e.buttons,
  });

  on(root, 'pointermove', (e) => push(pointerRec(e, 'pm')));
  on(root, 'pointerdown', (e) => push(pointerRec(e, 'pd')));
  on(root, 'pointerup', (e) => push(pointerRec(e, 'pu')));
  on(root, 'click', (e) => push({
    ...base(e, 'cl'),
    x: e.clientX, y: e.clientY, sx: e.screenX, sy: e.screenY,
    d: e.detail,
    tag: (e.target?.tagName || '').toLowerCase(),
  }));

  // --- keyboard ---------------------------------------------------------
  on(root, 'keydown', (e) => push({
    ...base(e, 'kd'),
    c: keyCategory(e),
    rep: e.repeat ? 1 : 0,
    loc: e.location,
    mod: (e.shiftKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0),
  }));
  on(root, 'keyup', (e) => push({
    ...base(e, 'ku'),
    c: keyCategory(e),
    loc: e.location,
  }));

  // Programmatic filling produces input/change with no keystrokes behind them.
  on(root, 'input', (e) => push({
    ...base(e, 'ip'),
    it: e.inputType || '',
    len: (e.target?.value || '').length,
  }));
  on(root, 'change', (e) => push({ ...base(e, 'ch'), len: (e.target?.value || '').length }));
  on(root, 'paste', (e) => push({ ...base(e, 'pa') }));

  // --- scroll -----------------------------------------------------------
  // Wheel deltas are quantised by the physical device. scrollTo() produces a
  // scroll event with no wheel before it.
  on(root, 'wheel', (e) => push({
    ...base(e, 'wh'),
    dx: e.deltaX, dy: e.deltaY, dz: e.deltaZ, dm: e.deltaMode,
  }));
  // Capture also sees scrolls inside elements, which do not bubble to window.
  // Session-local target numbers keep separate scroll positions from being mixed.
  const scrollTargets = new WeakMap();
  let nextScrollTarget = 0;
  on(root, 'scroll', (e) => {
    const target = e.target === document ? document.scrollingElement : e.target;
    if (!target) return;
    if (!scrollTargets.has(target)) scrollTargets.set(target, nextScrollTarget++);
    push({
      ...base(e, 'sc'),
      sy: target.scrollTop, sx: target.scrollLeft,
      target: scrollTargets.get(target),
    });
  });

  // --- touch ------------------------------------------------------------
  on(root, 'touchstart', (e) => push({ ...base(e, 'ts'), n: e.touches.length }));
  on(root, 'touchend', (e) => push({ ...base(e, 'te'), n: e.touches.length }));

  // --- session / focus --------------------------------------------------
  on(window, 'focus', (e) => push(base(e, 'fo')));
  on(window, 'blur', (e) => push(base(e, 'bl')));
  on(root, 'visibilitychange', (e) => push({ ...base(e, 'vc'), v: document.visibilityState }));
  on(window, 'resize', (e) => push({ ...base(e, 'rs'), w: innerWidth, h: innerHeight }));
  on(root, 'selectstart', (e) => push(base(e, 'se')));
  on(root, 'contextmenu', (e) => push(base(e, 'cm')));

  return {
    get events() { return events; },
    get truncated() { return truncated; },
    elapsed() { return performance.now() - t0; },
    stop() {
      for (const [target, type, fn, opts] of handlers) target.removeEventListener(type, fn, opts);
      handlers.length = 0;
    },
  };
}
