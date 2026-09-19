/**
 * Session record -> flat map of numeric features.
 *
 * No DOM, no globals: this runs in the browser and under Node over stored
 * sessions, so training and inference share one implementation.
 *
 * Behavioural features are NaN, not 0, when there is too little interaction to
 * compute them. 0 would claim the mouse did not move.
 *
 * Rationale in docs/02-metodologia.md.
 */

const NA = NaN;

// ---------------------------------------------------------------------------
// numeric helpers
// ---------------------------------------------------------------------------

/** Probe sentinels and non-numerics become NaN. */
function num(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return NA;
}

/** 0/1 flag. Unknown stays NaN: "could not tell" is not "no". */
function flag(v) {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === 'true') return 1;
  if (v === 'false') return 0;
  return NA;
}

/**
 * `Notification.permission` and `permissions.query()` spell the untouched state
 * differently: 'default' and 'prompt' are the same fact. Comparing the raw strings
 * would report a contradiction for every browser nobody has touched.
 */
function normPerm(v) {
  if (typeof v !== 'string') return null;
  if (v === '__error__' || v === '__absent__' || v === '__timeout__' || v === '') return null;
  return v === 'default' ? 'prompt' : v;
}

function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NA; }

function std(a) {
  if (a.length < 2) return NA;
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
}

function quantile(sorted, p) {
  if (!sorted.length) return NA;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Summary stats for a distribution, under a common prefix. */
function dist(out, prefix, arr) {
  const a = arr.filter(Number.isFinite);
  if (!a.length) {
    for (const s of ['mean', 'std', 'p50', 'p95', 'max', 'min', 'cv']) out[`${prefix}_${s}`] = NA;
    return;
  }
  const sorted = a.slice().sort((x, y) => x - y);
  const m = mean(a);
  const sd = std(a);
  out[`${prefix}_mean`] = m;
  out[`${prefix}_std`] = Number.isFinite(sd) ? sd : NA;
  out[`${prefix}_p50`] = quantile(sorted, 0.5);
  out[`${prefix}_p95`] = quantile(sorted, 0.95);
  out[`${prefix}_max`] = sorted[sorted.length - 1];
  out[`${prefix}_min`] = sorted[0];
  // CV is scale-free, so it catches scripted regularity without unit dependence.
  out[`${prefix}_cv`] = Number.isFinite(sd) && m !== 0 ? sd / Math.abs(m) : NA;
}

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|mesa offscreen|microsoft basic render/i;

// ---------------------------------------------------------------------------
// Layer A: automation artifacts
// ---------------------------------------------------------------------------

function automationFeatures(a = {}, out) {
  out.a_webdriver = flag(a.webdriver);
  out.a_known_globals_count = num(a.known_globals_count);
  out.a_doc_keys_count = num(a.doc_automation_keys_count);
  out.a_exposed_binding = flag(a.exposed_binding_found);
  out.a_ua_headless = flag(a.ua_headless_marker);

  out.a_chrome_absent = flag(a.chrome_present) === 1 ? 0 : 1;
  out.a_chrome_csi_absent = flag(a.chrome_has_csi) === 1 ? 0 : 1;
  out.a_chrome_loadtimes_absent = flag(a.chrome_has_load_times) === 1 ? 0 : 1;
  out.a_chrome_csi_not_native = flag(a.chrome_csi_native) === 0 ? 1 : 0;

  // Survives flag removal, because removing the flags is itself the rewriting.
  out.a_natives_patched_count = num(a.natives_patched_count);
  out.a_natives_patched_ratio = Number.isFinite(num(a.natives_checked)) && num(a.natives_checked) > 0
    ? num(a.natives_patched_count) / num(a.natives_checked)
    : NA;

  out.a_webdriver_own_prop = flag(a.webdriver_own_prop);
  out.a_webdriver_desc_missing = a.webdriver_descriptor_kind === 'missing' ? 1 : 0;
  out.a_webdriver_getter_not_native = flag(a.webdriver_getter_native) === 0 ? 1 : 0;

  let nonNative = 0;
  let checked = 0;
  for (const k of ['languages', 'plugins', 'hardware_concurrency', 'platform', 'user_agent']) {
    const v = a[`${k}_getter_native`];
    if (v === true || v === false) { checked++; if (v === false) nonNative++; }
    if (a[`${k}_own_prop`] === true) nonNative++;
  }
  out.a_nav_accessors_nonnative = checked ? nonNative : NA;

  out.a_proxy_anomaly = flag(a.proxy_toString_anomaly);
  out.a_error_stack_depth = num(a.error_stack_depth);
  out.a_capture_stack_trace = flag(a.has_capture_stack_trace);

  out.a_cdp_stack_getter = flag(a.cdp_stack_getter);
  return out;
}

// ---------------------------------------------------------------------------
// Layer B: environment coherence
// ---------------------------------------------------------------------------

function environmentFeatures(e = {}, out) {
  // A real window draws chrome around the viewport, so outer > inner.
  const ow = num(e.outer_w); const iw = num(e.inner_w);
  const oh = num(e.outer_h); const ih = num(e.inner_h);
  out.e_outer_inner_w_diff = Number.isFinite(ow) && Number.isFinite(iw) ? ow - iw : NA;
  out.e_outer_inner_h_diff = Number.isFinite(oh) && Number.isFinite(ih) ? oh - ih : NA;
  out.e_outer_zero = ow === 0 || oh === 0 ? 1 : 0;
  out.e_no_chrome_height = Number.isFinite(oh) && Number.isFinite(ih) && oh - ih <= 0 ? 1 : 0;
  out.e_screen_smaller_than_window = Number.isFinite(num(e.screen_w)) && Number.isFinite(iw)
    ? (num(e.screen_w) < iw ? 1 : 0) : NA;
  out.e_dpr = num(e.device_pixel_ratio);
  out.e_color_depth = num(e.color_depth);
  out.e_screen_w = num(e.screen_w);
  out.e_screen_h = num(e.screen_h);
  out.e_avail_h_diff = Number.isFinite(num(e.screen_h)) && Number.isFinite(num(e.avail_h))
    ? num(e.screen_h) - num(e.avail_h) : NA;

  // The renderer string is cheap to spoof; the capability surface behind it is not.
  // A probe sentinel is not a renderer name, so it falls through to the masked
  // string rather than being compared as if it were one.
  const rendererOf = (...candidates) => {
    for (const v of candidates) {
      const str = typeof v === 'string' ? v : '';
      if (str && !str.startsWith('__')) return str;
    }
    return '';
  };
  const renderer = rendererOf(e.webgl_unmasked_renderer, e.webgl_renderer);
  out.e_webgl_absent = flag(e.webgl_supported) === 1 ? 0 : 1;
  out.e_webgl_software = SOFTWARE_RENDERER.test(renderer) ? 1 : 0;
  out.e_webgl_ext_count = num(e.webgl_extension_count);
  out.e_webgl2_ext_count = num(e.webgl2_extension_count);
  out.e_webgl_max_texture = num(e.webgl_max_texture_size);
  out.e_webgl_max_anisotropy = num(e.webgl_max_anisotropy);
  out.e_webgl_max_vertex_attribs = num(e.webgl_max_vertex_attribs);
  out.e_webgl2_absent = flag(e.webgl2_supported) === 1 ? 0 : 1;

  // The same question, asked of the other context. Naive evasion patches
  // WebGLRenderingContext.prototype.getParameter and forgets WebGL2RenderingContext,
  // which is a separate prototype: the lie covers one context and not the other, and
  // the two then disagree about which GPU is drawing this page. The public stealth
  // plugin patches both.
  const renderer2 = rendererOf(e.webgl2_unmasked_renderer, e.webgl2_renderer);
  out.e_webgl2_software = SOFTWARE_RENDERER.test(renderer2) ? 1 : 0;
  out.e_webgl_renderer_mismatch = (renderer && renderer2)
    ? (renderer === renderer2 ? 0 : 1)
    : NA;

  out.e_canvas_text_width = num(e.canvas_text_width);
  out.e_canvas_emoji_width = num(e.canvas_emoji_width);
  out.e_canvas_ascent = num(e.canvas_actual_ascent);
  out.e_canvas_len = num(e.canvas_len);

  // Container images ship a handful of fonts; a desktop install has dozens.
  out.e_font_count = num(e.font_count);

  out.e_hardware_concurrency = num(e.hardware_concurrency);
  out.e_device_memory = num(e.device_memory);
  out.e_max_touch_points = num(e.max_touch_points);
  out.e_plugins_count = num(e.plugins_count);
  out.e_mime_types_count = num(e.mime_types_count);
  out.e_pdf_viewer = flag(e.pdf_viewer_enabled);

  out.e_media_device_count = num(e.media_device_count);
  out.e_media_device_labelled = num(e.media_device_labelled);
  out.e_voices_count = num(e.voices_count);

  // Bundled Chromium cannot decode H.264/AAC; shipping Chrome can. Separates a real
  // install from an automation build without relying on a spoofable string.
  out.e_h264_absent = e.codec_h264 === 'no' || e.codec_h264 === '' ? 1 : 0;
  out.e_aac_absent = e.codec_aac === 'no' || e.codec_aac === '' ? 1 : 0;
  out.e_vp9_absent = e.codec_vp9 === 'no' || e.codec_vp9 === '' ? 1 : 0;

  // Headless often reports no pointer and no hover, contradicting a desktop UA.
  out.e_pointer_none = flag(e.css_pointer_none);
  out.e_pointer_fine = flag(e.css_pointer_fine);
  out.e_hover_none = flag(e.css_hover_none);
  out.e_any_pointer_none = flag(e.css_any_pointer_none);
  out.e_prefers_reduced_motion = flag(e.css_prefers_reduced_motion_reduce);
  out.e_color_gamut_p3 = flag(e.css_color_gamut_p3);

  // These two APIs must agree in an untouched browser, once the two spellings of
  // the untouched state are reconciled. The headless signature is Notification
  // saying 'denied' while permissions.query() still says 'prompt'.
  out.e_notif_denied = e.notification_permission === 'denied' ? 1 : 0;
  out.e_perm_notif_denied = e.perm_notifications === 'denied' ? 1 : 0;
  const notifState = normPerm(e.notification_permission);
  const queryState = normPerm(e.perm_notifications);
  out.e_perm_mismatch = (notifState && queryState) ? (notifState !== queryState ? 1 : 0) : NA;

  // Older sessions stored charge level and state as an object; presence is the same fact.
  out.e_battery_absent = (e.battery_present === true
    || (e.battery_present && typeof e.battery_present === 'object')) ? 0 : 1;
  out.e_connection_absent = Number.isFinite(num(e.conn_rtt)) ? 0 : 1;
  out.e_conn_rtt = num(e.conn_rtt);
  out.e_webrtc_absent = flag(e.has_webrtc) === 1 ? 0 : 1;

  // A container pinned to UTC shows no seasonal DST shift.
  out.e_tz_is_utc = (e.timezone === 'UTC' || num(e.tz_offset_minutes) === 0) ? 1 : 0;
  out.e_tz_no_dst = Number.isFinite(num(e.tz_offset_jan)) && Number.isFinite(num(e.tz_offset_jul))
    ? (num(e.tz_offset_jan) === num(e.tz_offset_jul) ? 1 : 0) : NA;
  out.e_lang_count = typeof e.languages === 'string' ? e.languages.split(',').filter(Boolean).length : NA;

  // --- cross-consistency ------------------------------------------------
  // Two independent declarations of the same fact. Each is cheap to fake alone.
  const ua = String(e.user_agent ?? '');
  const platform = String(e.platform ?? '');
  const uachPlatform = String(e.uach_platform ?? '');

  const uaSaysWindows = /Windows/i.test(ua);
  // iOS writes "like Mac OS X" into its UA while its platform says "iPhone" or
  // "iPad". Reading that as macOS reported a contradiction for every iPhone.
  const uaSaysIOS = /iPhone|iPad|iPod/i.test(ua);
  const uaSaysMac = /Macintosh|Mac OS X/i.test(ua) && !uaSaysIOS;
  // ChromeOS also carries "X11" in the UA, and UA-CH calls it "Chrome OS". Folding
  // it into Linux would report a contradiction for every Chromebook.
  const uaSaysChromeOS = /CrOS/i.test(ua);
  const uaSaysLinux = /Linux|X11/i.test(ua) && !/Android/i.test(ua) && !uaSaysChromeOS;
  const uaSaysAndroid = /Android/i.test(ua);
  const uaSaysMobile = /Mobile|Android|iPhone|iPad/i.test(ua);

  const platSaysWindows = /Win/i.test(platform);
  const platSaysMac = /Mac/i.test(platform);
  const platSaysLinux = /Linux|X11/i.test(platform);
  // An iPhone asking for the desktop site sends a Mac UA from an iOS platform.
  const platSaysIOS = /iPhone|iPad|iPod/i.test(platform);

  out.e_ua_platform_mismatch = (ua && platform)
    ? (((uaSaysWindows && !platSaysWindows) || (uaSaysMac && !platSaysMac && !platSaysIOS)
        || ((uaSaysLinux || uaSaysChromeOS) && !platSaysLinux)) ? 1 : 0)
    : NA;

  out.e_uach_ua_mismatch = uachPlatform
    ? (((uaSaysWindows && uachPlatform !== 'Windows')
        || (uaSaysMac && uachPlatform !== 'macOS')
        || (uaSaysLinux && uachPlatform !== 'Linux')
        || (uaSaysChromeOS && uachPlatform !== 'Chrome OS')
        || (uaSaysAndroid && uachPlatform !== 'Android')) ? 1 : 0)
    : NA;

  out.e_mobile_touch_mismatch = ua
    ? ((uaSaysMobile && num(e.max_touch_points) === 0) ? 1 : 0)
    : NA;

  // Desktop UA plus software rasteriser is the cleanest container tell. Either
  // context counts: a patched WebGL 1 renderer does not make the machine real.
  out.e_desktop_ua_software_gpu =
    (ua && !uaSaysMobile && (out.e_webgl_software === 1 || out.e_webgl2_software === 1)) ? 1 : 0;

  out.e_uach_absent = e.uach_present === false ? 1 : 0;
  out.e_referrer_present = flag(e.referrer_present);
  out.e_history_length = num(e.history_length);
  out.e_has_focus = flag(e.doc_has_focus);
  out.e_hidden = flag(e.doc_hidden);
  return out;
}

// ---------------------------------------------------------------------------
// Cross-layer gates
// ---------------------------------------------------------------------------

/**
 * Two Layer A signals only carry meaning inside a browser family.
 *
 * `window.chrome` is absent in every Firefox and Safari, and `navigator.webdriver`
 * is only guaranteed to exist in Chromium and Gecko. Reading either as evidence
 * without checking the family marks every non-Chromium person as automated.
 */
function crossLayerFeatures(e = {}, out) {
  const ua = String(e.user_agent ?? '');
  const brands = String(e.uach_brands ?? '');
  // The iOS browsers carry a Chrome-like token but run on WebKit, so they have no
  // window.chrome either.
  const iosSkin = /CriOS|EdgiOS|FxiOS|OPiOS/i.test(ua);
  const isChromium = !iosSkin
    && (/Chrome\/|Chromium\/|HeadlessChrome/i.test(ua) || /Chromium|Google Chrome/i.test(brands));
  const isGecko = !isChromium && /Gecko\/|Firefox\//i.test(ua);

  out.e_chromium_ua = isChromium ? 1 : 0;
  out.a_chrome_absent_in_chromium = isChromium && out.a_chrome_absent === 1 ? 1 : 0;
  out.a_chrome_stub_in_chromium = isChromium && out.a_chrome_csi_not_native === 1 ? 1 : 0;

  if (!isChromium && !isGecko) {
    out.a_webdriver_desc_missing = NA;
    out.a_webdriver_own_prop = NA;
    out.a_webdriver_getter_not_native = NA;
  }
}

// ---------------------------------------------------------------------------
// Layer C: timing
// ---------------------------------------------------------------------------

function timingFeatures(t = {}, out) {
  // A backgrounded tab renders no frames, which says nothing about who is driving
  // it. Measuring that as "no compositor" would flag anyone who opens the page in
  // a background tab, so the whole family goes to NA instead.
  const rafHidden = flag(t.raf_hidden) === 1;
  out.t_raf_hidden = flag(t.raf_hidden);
  out.t_raf_count = rafHidden ? NA : num(t.raf_frame_count);
  out.t_raf_absent = rafHidden ? NA : (num(t.raf_frame_count) === 0 ? 1 : 0);
  out.t_raf_mean = num(t.raf_mean_ms);
  out.t_raf_std = num(t.raf_std_ms);
  out.t_raf_p50 = num(t.raf_p50_ms);
  out.t_raf_p95 = num(t.raf_p95_ms);
  out.t_raf_min = num(t.raf_min_ms);
  out.t_raf_vsync_ratio = rafHidden ? NA : num(t.raf_vsync_band_ratio);
  // A display-driven compositor jitters a little; a timer loop is too clean or too noisy.
  out.t_raf_cv = Number.isFinite(num(t.raf_mean_ms)) && num(t.raf_mean_ms) > 0
    ? num(t.raf_std_ms) / num(t.raf_mean_ms) : NA;

  out.t_loop_lag_mean = num(t.loop_lag_mean_ms);
  out.t_loop_lag_std = num(t.loop_lag_std_ms);
  out.t_loop_lag_p95 = num(t.loop_lag_p95_ms);
  out.t_clock_min_delta = num(t.clock_min_delta_ms);
  out.t_clock_zero_ratio = num(t.clock_zero_delta_ratio);

  out.t_nav_dom_interactive = num(t.nav_dom_interactive);
  out.t_nav_response = num(t.nav_response_time);
  out.t_paint_count = num(t.paint_entry_count);
  out.t_first_paint = num(t.first_paint_ms);
  out.t_paint_absent = num(t.paint_entry_count) === 0 ? 1 : 0;
  return out;
}


// ---------------------------------------------------------------------------
// Layer D: behaviour
// ---------------------------------------------------------------------------

/** Minimum evidence before a family of behavioural features means anything. */
const MIN_MOVES = 15;
const MIN_KEYS = 4;
const MIN_SCROLLS = 3;

/** Keys that produce a character, which is what keystroke dynamics describes. */
const TYPING_KEYS = new Set(['alpha', 'digit', 'punct', 'space']);

/** Input events people produce without a keystroke behind them. */
const NON_KEY_INPUT_TYPES = new Set([
  'insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYank',
  'insertReplacementText', 'insertCompositionText', 'insertFromComposition',
  'insertTranspose', 'deleteByCut', 'historyUndo', 'historyRedo', 'insertLink',
]);

/** Inputs that can move the page without a scripted call behind them. */
const SCROLL_INPUT_EVENTS = new Set(['wh', 'kd', 'ku', 'ts', 'te', 'pd', 'pu']);

/** Split at pauses, so straightness is measured per gesture. */
function splitStrokes(moves, gapMs = 120) {
  const strokes = [];
  let cur = [];
  for (let i = 0; i < moves.length; i++) {
    if (i > 0 && moves[i].t - moves[i - 1].t > gapMs) {
      if (cur.length) strokes.push(cur);
      cur = [];
    }
    cur.push(moves[i]);
  }
  if (cur.length) strokes.push(cur);
  return strokes;
}

function pointerFeatures(moves, out) {
  if (moves.length < MIN_MOVES) {
    for (const k of [
      'b_pm_speed_mean', 'b_pm_speed_std', 'b_pm_speed_p50', 'b_pm_speed_p95', 'b_pm_speed_max',
      'b_pm_speed_min', 'b_pm_speed_cv', 'b_pm_accel_mean', 'b_pm_accel_std', 'b_pm_accel_p50',
      'b_pm_accel_p95', 'b_pm_accel_max', 'b_pm_accel_min', 'b_pm_accel_cv',
      'b_pm_jerk_mean', 'b_pm_jerk_std', 'b_pm_jerk_p50', 'b_pm_jerk_p95', 'b_pm_jerk_max',
      'b_pm_jerk_min', 'b_pm_jerk_cv', 'b_pm_step_mean', 'b_pm_step_std', 'b_pm_step_p50',
      'b_pm_step_p95', 'b_pm_step_max', 'b_pm_step_min', 'b_pm_step_cv',
      'b_pm_dt_mean', 'b_pm_dt_std', 'b_pm_dt_p50', 'b_pm_dt_p95', 'b_pm_dt_max', 'b_pm_dt_min', 'b_pm_dt_cv',
      'b_pm_turn_mean', 'b_pm_turn_std', 'b_pm_turn_p50', 'b_pm_turn_p95', 'b_pm_turn_max',
      'b_pm_turn_min', 'b_pm_turn_cv', 'b_pm_straightness_mean', 'b_pm_straightness_std',
      'b_pm_straightness_p50', 'b_pm_straightness_p95', 'b_pm_straightness_max',
      'b_pm_straightness_min', 'b_pm_straightness_cv',
      'b_pm_screen_client_eq_ratio', 'b_pm_movement_zero_ratio', 'b_pm_movement_mismatch_ratio',
      'b_pm_pressure_unique', 'b_pm_pressure_mean', 'b_pm_int_et_ratio', 'b_pm_dt_zero_ratio',
      'b_pm_teleport_count', 'b_pm_teleport_ratio', 'b_pm_reversal_rate', 'b_pm_submovement_rate',
      'b_pm_unique_pos_ratio', 'b_pm_stroke_count', 'b_pm_count', 'b_pm_rate',
    ]) out[k] = NA;
    return;
  }

  const dts = [], steps = [], speeds = [], turns = [];
  let screenClientEq = 0, movementZero = 0, movementMismatch = 0, intEt = 0, dtZero = 0, teleports = 0;
  const pressures = new Set();
  const pressureVals = [];
  const positions = new Set();
  let angPrev = null;

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    positions.add(`${m.x},${m.y}`);
    // Only a pen reports graded pressure here. A mouse reports 0 with no button and
    // 0.5 with one, and most touchscreens report a constant, so counting either
    // would say "invariant pressure" about ordinary people.
    if (Number.isFinite(m.p) && m.pt === 'pen') {
      pressures.add(m.p);
      pressureVals.push(m.p);
    }
    // Injected events often report screen == client: nothing placed the window.
    if (m.sx === m.x && m.sy === m.y) screenClientEq++;
    if (Number.isFinite(m.et) && Number.isInteger(m.et)) intEt++;

    if (i === 0) continue;
    const prev = moves[i - 1];
    const dt = m.t - prev.t;
    const dx = m.x - prev.x;
    const dy = m.y - prev.y;
    const d = Math.hypot(dx, dy);

    if (dt === 0) dtZero++;
    else { dts.push(dt); speeds.push(d / dt); }
    steps.push(d);
    if (d > 150) teleports++;

    // movementX/Y comes from the OS input stack, so synthetic events omit it or
    // let it drift from the coordinate delta.
    if (d > 0 && m.mx === 0 && m.my === 0) movementZero++;
    if (Number.isFinite(m.mx) && Math.abs(m.mx - dx) > 1.5) movementMismatch++;

    if (d > 0.5) {
      const ang = Math.atan2(dy, dx);
      if (angPrev !== null) {
        let turn = Math.abs(ang - angPrev);
        if (turn > Math.PI) turn = 2 * Math.PI - turn;
        turns.push(turn);
      }
      angPrev = ang;
    }
  }

  const n = moves.length;
  const span = moves[n - 1].t - moves[0].t;
  out.b_pm_count = n;
  out.b_pm_rate = span > 0 ? (n / span) * 1000 : NA;

  dist(out, 'b_pm_dt', dts);
  dist(out, 'b_pm_step', steps);
  dist(out, 'b_pm_speed', speeds);
  dist(out, 'b_pm_turn', turns);

  // Human aiming is ballistic: fast launch, decelerating approach, corrective
  // bursts. Interpolated paths run at near-constant speed, so derivatives collapse.
  const accels = [];
  for (let i = 1; i < speeds.length; i++) {
    const dt = dts[i];
    if (dt > 0) accels.push((speeds[i] - speeds[i - 1]) / dt);
  }
  const jerks = [];
  for (let i = 1; i < accels.length; i++) {
    const dt = dts[i + 1];
    if (dt > 0) jerks.push((accels[i] - accels[i - 1]) / dt);
  }
  dist(out, 'b_pm_accel', accels);
  dist(out, 'b_pm_jerk', jerks);

  out.b_pm_screen_client_eq_ratio = screenClientEq / n;
  out.b_pm_movement_zero_ratio = movementZero / n;
  out.b_pm_movement_mismatch_ratio = movementMismatch / n;
  out.b_pm_int_et_ratio = intEt / n;
  out.b_pm_dt_zero_ratio = dtZero / n;
  out.b_pm_teleport_count = teleports;
  out.b_pm_teleport_ratio = teleports / n;
  out.b_pm_unique_pos_ratio = positions.size / n;
  out.b_pm_pressure_unique = pressureVals.length ? pressures.size : NA;
  out.b_pm_pressure_mean = mean(pressureVals);

  // Tremor and correction flip the step sign constantly. Generated paths rarely
  // backtrack.
  let reversals = 0;
  for (let i = 2; i < moves.length; i++) {
    const dx1 = moves[i - 1].x - moves[i - 2].x;
    const dx2 = moves[i].x - moves[i - 1].x;
    const dy1 = moves[i - 1].y - moves[i - 2].y;
    const dy2 = moves[i].y - moves[i - 1].y;
    if (dx1 * dx2 < 0 || dy1 * dy2 < 0) reversals++;
  }
  out.b_pm_reversal_rate = reversals / n;

  // Local minima in speed: course correction mid-gesture, rather than one glide.
  let submoves = 0;
  for (let i = 1; i < speeds.length - 1; i++) {
    if (speeds[i] < speeds[i - 1] && speeds[i] < speeds[i + 1]
        && speeds[i] < 0.6 * Math.max(speeds[i - 1], speeds[i + 1])) submoves++;
  }
  out.b_pm_submovement_rate = speeds.length ? submoves / speeds.length : NA;

  const strokes = splitStrokes(moves);
  out.b_pm_stroke_count = strokes.length;
  const straight = [];
  for (const s of strokes) {
    if (s.length < 3) continue;
    let path = 0;
    for (let i = 1; i < s.length; i++) path += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
    const euclid = Math.hypot(s[s.length - 1].x - s[0].x, s[s.length - 1].y - s[0].y);
    if (euclid > 5) straight.push(path / euclid);
  }
  dist(out, 'b_pm_straightness', straight);
}

function clickFeatures(evts, moves, out) {
  const clicks = evts.filter((e) => e.e === 'cl');
  const downs = evts.filter((e) => e.e === 'pd');
  const ups = evts.filter((e) => e.e === 'pu');
  out.b_click_count = clicks.length;
  out.b_down_count = downs.length;

  // A tap has no approach and a keyboard activation has no pointer at all, so
  // neither can be read as "the pointer appeared on the target".
  const pointerTypeOf = (c) => {
    let pt = null;
    for (const d of downs) if (d.t <= c.t && d.t > c.t - 1000) pt = d.pt ?? pt;
    return pt;
  };
  const keyboardClicks = clicks.filter((c) => c.d === 0);
  const tapClicks = clicks.filter((c) => c.d !== 0 && ['touch', 'pen'].includes(pointerTypeOf(c)));
  const mouseClicks = clicks.filter((c) => c.d !== 0 && !['touch', 'pen'].includes(pointerTypeOf(c)));
  out.b_click_keyboard_count = keyboardClicks.length;
  out.b_click_touch_count = tapClicks.length;
  out.b_click_mouse_count = mouseClicks.length;

  if (!clicks.length) {
    out.b_moves_before_click_mean = NA;
    out.b_click_screen_eq_ratio = NA;
  } else {
    out.b_moves_before_click_mean = mean(clicks.map(
      (c) => moves.filter((m) => m.t < c.t && m.t > c.t - 500).length));
    out.b_click_screen_eq_ratio = clicks.filter((c) => c.sx === c.x && c.sy === c.y).length / clicks.length;
  }

  if (!mouseClicks.length) {
    out.b_click_no_move_ratio = NA;
  } else {
    // The surviving signal is the missing approach, not the missing recent motion:
    // a person who reads for ten seconds with the cursor resting on the button is
    // still a person. What automation cannot produce without emulating it is the
    // stream of moves that ends on the target.
    const APPROACH_RADIUS = 30;
    const approached = (c) => moves.filter(
      (m) => m.t < c.t && Math.hypot(m.x - c.x, m.y - c.y) <= APPROACH_RADIUS).length >= 3;
    out.b_click_no_move_ratio = mouseClicks.filter((c) => !approached(c)).length / mouseClicks.length;
  }

  // Humans hold a button ~60-120ms with spread. Injected clicks are instant or fixed.
  const dwells = [];
  for (const d of downs) {
    const u = ups.find((x) => x.t >= d.t);
    if (u) dwells.push(u.t - d.t);
  }
  dist(out, 'b_click_dwell', dwells);
}

function keyboardFeatures(evts, out) {
  const kd = evts.filter((e) => e.e === 'kd');
  const ku = evts.filter((e) => e.e === 'ku');
  const ip = evts.filter((e) => e.e === 'ip');
  const pa = evts.filter((e) => e.e === 'pa');
  const ch = evts.filter((e) => e.e === 'ch');

  out.b_kd_count = kd.length;
  out.b_ku_count = ku.length;
  out.b_input_count = ip.length;
  out.b_paste_count = pa.length;
  out.b_change_count = ch.length;

  // Pasting, dropping, autocorrect and IME composition all reach the field without
  // a keystroke behind them, and all three are things people do. Only the input
  // types that claim to be typing are evidence of a missing keystroke.
  const typedInputs = ip.filter((e) => !NON_KEY_INPUT_TYPES.has(e.it || ''));
  out.b_paste_like_count = ip.length - typedInputs.length;
  out.b_input_without_keydown = typedInputs.filter(
    (e) => !kd.some((k) => k.t <= e.t && k.t > e.t - 500)).length;
  out.b_input_key_ratio = kd.length > 0 ? ip.length / kd.length : (ip.length > 0 ? 999 : NA);
  out.b_key_imbalance = kd.length > 0 ? Math.abs(kd.length - ku.length) / kd.length : NA;

  // Typing advances one char at a time; setting .value jumps the whole string.
  // Only steps between consecutive input events count: the length at the first
  // event describes what was already in the field (a restored form value, say),
  // not how fast it got there. Each typed input is measured against the input right
  // before it, whatever its type: skipping a paste or an IME composition in between
  // would charge the pasted text to the next keystroke.
  const jumps = [];
  for (let i = 1; i < ip.length; i++) {
    if (NON_KEY_INPUT_TYPES.has(ip[i].it || '')) continue;
    const j = (ip[i].len ?? 0) - (ip[i - 1].len ?? 0);
    if (Number.isFinite(j)) jumps.push(j);
  }
  out.b_input_first_len = ip.length ? (ip[0].len ?? NA) : NA;
  out.b_input_len_jump_max = jumps.length ? Math.max(...jumps) : NA;
  out.b_input_len_jump_mean = jumps.length ? mean(jumps) : NA;

  // Keystroke dynamics is about the keys that produce characters. Modifiers arrive
  // in pairs with the key they modify, and autorepeat is the keyboard firing, not
  // the finger, so both would fake intervals below the human motor limit.
  const typedKeys = kd.filter((k) => k.rep !== 1 && TYPING_KEYS.has(k.c));
  out.b_typed_key_count = typedKeys.length;
  out.b_repeat_ratio = kd.length ? kd.filter((k) => k.rep === 1).length / kd.length : NA;

  if (typedKeys.length < MIN_KEYS) {
    for (const k of [
      'b_interkey_mean', 'b_interkey_std', 'b_interkey_p50', 'b_interkey_p95', 'b_interkey_max',
      'b_interkey_min', 'b_interkey_cv', 'b_hold_mean', 'b_hold_std', 'b_hold_p50', 'b_hold_p95',
      'b_hold_max', 'b_hold_min', 'b_hold_cv', 'b_interkey_fast_ratio', 'b_erase_ratio',
      'b_key_int_et_ratio',
    ]) out[k] = NA;
    return;
  }

  const inter = [];
  for (let i = 1; i < typedKeys.length; i++) inter.push(typedKeys[i].t - typedKeys[i - 1].t);
  dist(out, 'b_interkey', inter);
  // Human inter-key latency rarely drops below ~50ms, even for fast typists.
  out.b_interkey_fast_ratio = inter.filter((d) => d < 30).length / Math.max(1, inter.length);

  const holds = [];
  const usedUps = new Set();
  for (const d of typedKeys) {
    const idx = ku.findIndex((u, i) => !usedUps.has(i) && u.t >= d.t && u.c === d.c);
    if (idx >= 0) { usedUps.add(idx); holds.push(ku[idx].t - d.t); }
  }
  dist(out, 'b_hold', holds);

  out.b_erase_ratio = kd.filter((k) => k.c === 'erase').length / kd.length;
  out.b_key_int_et_ratio = kd.filter((k) => Number.isFinite(k.et) && Number.isInteger(k.et)).length / kd.length;
}

function scrollFeatures(evts, out) {
  const wh = evts.filter((e) => e.e === 'wh');
  const sc = evts.filter((e) => e.e === 'sc');
  const inputs = evts.filter((e) => SCROLL_INPUT_EVENTS.has(e.e));
  out.b_wheel_count = wh.length;
  out.b_scroll_count = sc.length;

  // The page moves on its own more often than it looks: scroll restoration on
  // reload, an anchor jump, the browser bringing a focused field into view. Those
  // land before the person has touched anything, so they are not evidence.
  const firstInput = inputs.length ? inputs[0].t : Infinity;
  const scored = sc.filter((s) => s.t >= firstInput);
  out.b_scroll_after_input_count = scored.length;

  // Dragging a scrollbar scrolls while the button is held, and Chromium sends no
  // pointermove during the drag. Only scrolls inside a press are explained by it: a
  // click does not explain a scroll that starts after the button is released.
  const presses = [];
  let pressStart = null;
  for (const e of evts) {
    if (e.e === 'pd' && pressStart === null) pressStart = e.t;
    else if (pressStart !== null && (e.e === 'pu' || (e.e === 'pm' && e.b === 0))) {
      presses.push([pressStart, e.t]);
      pressStart = null;
    }
  }
  if (pressStart !== null) presses.push([pressStart, Infinity]);
  const unexplained = scored.filter((s) => !presses.some(([a, b]) => s.t >= a && s.t <= b));

  // A wheel is not the only way a person scrolls: keyboard, touch and the scrollbar
  // all move the page without one. What no person does is move the page with no
  // input device involved anywhere in the session.
  const hasScrollCapableInput = wh.length > 0
    || evts.some((e) => e.e === 'kd' || e.e === 'ts' || e.e === 'te');
  out.b_scroll_no_wheel = sc.length ? (wh.length === 0 ? 1 : 0) : NA;
  out.b_scroll_no_input = unexplained.length >= 2 ? (hasScrollCapableInput ? 0 : 1) : NA;

  // Graded form. The window has to survive smooth scrolling: one wheel tick, one
  // key or one drag keeps emitting scroll events after it.
  if (scored.length) {
    const orphan = unexplained.filter(
      (s) => !inputs.some((i) => i.t <= s.t && i.t > s.t - 600)).length;
    out.b_scroll_orphan_ratio = orphan / scored.length;
    out.b_scroll_orphan_count = orphan;
  } else {
    out.b_scroll_orphan_ratio = NA;
    out.b_scroll_orphan_count = NA;
  }
  if (sc.length) {
    const jumps = [];
    const previous = new Map();
    for (const s of sc) {
      // Older records only captured the document and have no target field.
      const target = s.target ?? 0;
      const y = s.sy ?? 0;
      if (previous.has(target)) jumps.push(Math.abs(y - previous.get(target)));
      previous.set(target, y);
    }
    dist(out, 'b_scroll_jump', jumps);
  } else {
    dist(out, 'b_scroll_jump', []);
  }

  if (wh.length >= MIN_SCROLLS) {
    const deltas = wh.map((w) => w.dy).filter(Number.isFinite);
    dist(out, 'b_wheel_delta', deltas.map(Math.abs));
    out.b_wheel_delta_unique = new Set(deltas).size;
    out.b_wheel_delta_unique_ratio = deltas.length ? new Set(deltas).size / deltas.length : NA;
    const wdt = [];
    for (let i = 1; i < wh.length; i++) wdt.push(wh[i].t - wh[i - 1].t);
    dist(out, 'b_wheel_dt', wdt);
    out.b_wheel_mode_nonzero = wh.filter((w) => w.dm !== 0).length / wh.length;
  } else {
    dist(out, 'b_wheel_delta', []);
    dist(out, 'b_wheel_dt', []);
    out.b_wheel_delta_unique = NA;
    out.b_wheel_delta_unique_ratio = NA;
    out.b_wheel_mode_nonzero = NA;
  }
}

function behaviourFeatures(session, out) {
  const evts = Array.isArray(session.events) ? session.events : [];
  const elapsed = num(session.elapsed_ms);
  // Kinematics describe a hand steering a cursor. A finger dragging the page is a
  // different motion: swipes are straight by nature and carry no OS movement delta,
  // so reading them as a mouse would accuse every phone of scripting.
  const moves = evts.filter((e) => e.e === 'pm' && e.pt !== 'touch');

  out.b_event_count = evts.length;
  out.b_duration_ms = elapsed;
  out.b_events_per_sec = Number.isFinite(elapsed) && elapsed > 0 ? (evts.length / elapsed) * 1000 : NA;
  out.b_time_to_first_event = evts.length ? evts[0].t : NA;
  out.b_untrusted_ratio = evts.length ? evts.filter((e) => e.tr === 0).length / evts.length : NA;

  out.b_focus_count = evts.filter((e) => e.e === 'fo').length;
  out.b_blur_count = evts.filter((e) => e.e === 'bl').length;
  out.b_visibility_count = evts.filter((e) => e.e === 'vc').length;
  out.b_select_count = evts.filter((e) => e.e === 'se').length;
  out.b_touch_count = evts.filter((e) => e.e === 'ts' || e.e === 'te').length;

  // Gates: "looks automated" and "has not shown me anything yet" are different
  // claims and must not collapse into the same feature values.
  out.b_has_pointer = moves.length >= MIN_MOVES ? 1 : 0;
  out.b_has_keys = evts.filter((e) => e.e === 'kd').length >= MIN_KEYS ? 1 : 0;
  out.b_has_scroll = evts.filter((e) => e.e === 'wh' || e.e === 'sc').length >= MIN_SCROLLS ? 1 : 0;
  out.b_evidence_score = out.b_has_pointer + out.b_has_keys + out.b_has_scroll;

  pointerFeatures(moves, out);
  clickFeatures(evts, moves, out);
  keyboardFeatures(evts, out);
  scrollFeatures(evts, out);
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/** Session -> feature map. Pure: same output in browser and in Node. */
export function extractFeatures(session) {
  const out = {};
  automationFeatures(session.automation, out);
  environmentFeatures(session.env, out);
  crossLayerFeatures(session.env, out);
  timingFeatures(session.timing, out);
  behaviourFeatures(session, out);
  return out;
}
