/**
 * Layer C: runtime and timing.
 *
 * These probe the machinery underneath JavaScript, which is why they are awkward
 * to fake. A browser without a real compositor cannot easily manufacture the
 * vsync-locked jitter that painting to a display produces as a side effect.
 */
import { safe } from '../util.js';

/**
 * rAF cadence. Vsync clusters intervals near the refresh period with irregular
 * jitter. Headless drives frames from a timer, runs them flat out, or never fires
 * them. All three are informative, so this resolves on a timeout rather than
 * waiting for frames that may never come.
 */
function rafCadence(maxFrames = 45, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const intervals = [];
    let last = performance.now();
    let done = false;
    let rafId = null;

    // A background tab renders nothing. Recording that as "no compositor" would
    // describe the tab, not the visitor, so the measurement declares itself void.
    let hidden = document.hidden === true;
    const onVisibility = () => { if (document.hidden) hidden = true; };
    document.addEventListener('visibilitychange', onVisibility);

    const finish = () => {
      if (done) return;
      done = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
      resolve({ intervals, hidden });
    };
    const timer = setTimeout(finish, timeoutMs);

    const tick = () => {
      const now = performance.now();
      intervals.push(now - last);
      last = now;
      if (intervals.length >= maxFrames) {
        clearTimeout(timer);
        finish();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    if (typeof requestAnimationFrame !== 'function') {
      clearTimeout(timer);
      finish();
      return;
    }
    rafId = requestAnimationFrame(tick);
  });
}

/**
 * Browsers coarsen performance.now() as a Spectre mitigation. The exact quantum
 * differs across builds and flags.
 */
function clockResolution(samples = 6000) {
  return safe(() => {
    let minDelta = Infinity;
    let zeroDeltas = 0;
    let prev = performance.now();
    for (let i = 0; i < samples; i++) {
      const now = performance.now();
      const d = now - prev;
      if (d === 0) zeroDeltas++;
      else if (d < minDelta) minDelta = d;
      prev = now;
    }
    return {
      min_delta: minDelta === Infinity ? -1 : minDelta,
      zero_delta_ratio: zeroDeltas / samples,
    };
  }, {});
}

/** Event loop responsiveness under a trivial scheduling load. */
function eventLoopLag(rounds = 25) {
  return new Promise((resolve) => {
    const lags = [];
    let i = 0;
    const step = () => {
      const t0 = performance.now();
      setTimeout(() => {
        lags.push(performance.now() - t0);
        if (++i >= rounds) resolve(lags);
        else step();
      }, 0);
    };
    step();
  });
}

function stats(arr) {
  if (!arr || arr.length === 0) return { n: 0 };
  const s = arr.slice().sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const variance = s.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const q = (p) => s[Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))];
  return {
    n,
    mean: Math.round(mean * 1000) / 1000,
    std: Math.round(Math.sqrt(variance) * 1000) / 1000,
    min: Math.round(s[0] * 1000) / 1000,
    p50: Math.round(q(0.5) * 1000) / 1000,
    p95: Math.round(q(0.95) * 1000) / 1000,
    max: Math.round(s[n - 1] * 1000) / 1000,
  };
}

export async function collectTiming() {
  const out = {};

  const [rafRun, lag] = await Promise.all([rafCadence(), eventLoopLag()]);

  const raf = rafRun.intervals;
  out.raf_hidden = rafRun.hidden;
  const rafStats = stats(raf);
  out.raf_frame_count = rafStats.n;
  out.raf_mean_ms = rafStats.mean ?? -1;
  out.raf_std_ms = rafStats.std ?? -1;
  out.raf_min_ms = rafStats.min ?? -1;
  out.raf_p50_ms = rafStats.p50 ?? -1;
  out.raf_p95_ms = rafStats.p95 ?? -1;
  out.raf_max_ms = rafStats.max ?? -1;
  // Fraction of frames in a vsync-plausible band. The lower edge has to admit
  // high-refresh displays: 240Hz is 4.2ms per frame and 360Hz is 2.8ms.
  out.raf_vsync_band_ratio = rafStats.n
    ? raf.filter((d) => d >= 2 && d <= 45).length / raf.length
    : -1;

  const lagStats = stats(lag);
  out.loop_lag_mean_ms = lagStats.mean ?? -1;
  out.loop_lag_std_ms = lagStats.std ?? -1;
  out.loop_lag_p95_ms = lagStats.p95 ?? -1;

  const clock = clockResolution();
  out.clock_min_delta_ms = clock.min_delta ?? -1;
  out.clock_zero_delta_ratio = clock.zero_delta_ratio ?? -1;

  const nav = safe(() => performance.getEntriesByType('navigation')[0], null);
  if (nav) {
    out.nav_dom_interactive = Math.round(nav.domInteractive);
    out.nav_dom_content_loaded = Math.round(nav.domContentLoadedEventEnd);
    out.nav_response_time = Math.round(nav.responseEnd - nav.requestStart);
    out.nav_type = nav.type;
  }
  const paints = safe(() => performance.getEntriesByType('paint'), []);
  out.paint_entry_count = Array.isArray(paints) ? paints.length : -1;
  out.first_paint_ms = Array.isArray(paints) && paints.length
    ? Math.round(paints[0].startTime)
    : -1;

  return out;
}
