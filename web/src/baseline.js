/**
 * Rule-based baseline.
 *
 * This is the benchmark the model has to beat. It also makes the page work
 * end-to-end before any data exists, which is what let collection start early.
 *
 * Rules are data, not branches: each carries a weight and an explanation, so the
 * same structure produces the score and the reason codes. Weights come from the
 * documented strength of each signal, not from fitting.
 *
 * Every rule declares a `group`, and the groups are not interchangeable:
 *
 *   hard       direct automation artifacts. Present, the verdict is bot.
 *   tamper     someone rewrote the browser's APIs. Strong, but reachable by
 *              privacy extensions, so it accumulates instead of deciding alone.
 *   env        environment incoherence.
 *   timing     runtime cadence.
 *   behaviour  pointer, typing and scrolling, in both directions.
 *
 * Behavioural evidence for a human cancels behavioural evidence for a bot, and
 * stops there. Letting a convincing mouse trajectory subtract from "the WebDriver
 * accessor was deleted" is exactly what an adversary who imitates human motion
 * would want, and the humanised adversary in this repo imitates it well.
 *
 * Five behavioural rules were removed after the audit in docs/03-resultados.md
 * measured them against the collected sessions. `path_too_straight` and
 * `no_reversals` were calling three real visitors automation in the first
 * seconds, before there was enough pointer data to contradict them. The other
 * three moved no verdict, but the page prints the `why` of every rule that
 * fires, so a humanised bot was reading "the tremor and correction typical of a
 * human hand" in its own explanation.
 *
 * Removed rather than inverted: `b_pm_reversal_rate` does separate the classes
 * here, but the threshold would come from this one generator's jitter, and 2.5
 * of the methodology rules out fitting thresholds to the sample. The model reads
 * that feature already.
 */

const S = (v) => Number.isFinite(v);

/** Positive weight is evidence of automation, negative of a human. */
export const RULES = [
  // --- Layer A: direct automation artifacts ----------------------------
  { id: 'webdriver', layer: 'A', group: 'hard', w: 4.0,
    why: 'navigator.webdriver is set, the standard flag for a browser under automation control',
    test: (f) => f.a_webdriver === 1 },
  { id: 'globals', layer: 'A', group: 'hard', w: 4.0,
    why: 'Global variables injected by an automation framework were found on the page',
    test: (f) => S(f.a_known_globals_count) && f.a_known_globals_count > 0 },
  { id: 'doc_keys', layer: 'A', group: 'hard', w: 4.0,
    why: 'ChromeDriver or WebDriver keys are present on the document object',
    test: (f) => S(f.a_doc_keys_count) && f.a_doc_keys_count > 0 },
  { id: 'exposed_binding', layer: 'A', group: 'hard', w: 4.0,
    why: 'A function exposed by an automation binding was detected',
    test: (f) => f.a_exposed_binding === 1 },
  { id: 'ua_headless', layer: 'A', group: 'hard', w: 3.5,
    why: 'The User-Agent string declares a headless browser',
    test: (f) => f.a_ua_headless === 1 },

  // --- Layer A: tamper detection, which is what catches naive evasion ----
  // A careful stealth plugin masks Function.prototype.toString and patches every
  // context, and then most of these stay silent (docs/03-resultados.md).
  { id: 'webdriver_tampered', layer: 'A', group: 'tamper', w: 2.5,
    why: 'The navigator.webdriver accessor was removed or rewritten, a signature of evasion tooling',
    test: (f) => f.a_webdriver_desc_missing === 1 || f.a_webdriver_getter_not_native === 1 || f.a_webdriver_own_prop === 1 },
  { id: 'natives_patched', layer: 'A', group: 'tamper', w: 2.0,
    why: 'Native browser functions have been replaced with JavaScript implementations',
    test: (f) => S(f.a_natives_patched_count) && f.a_natives_patched_count > 0 },
  { id: 'accessors_patched', layer: 'A', group: 'tamper', w: 2.0,
    why: 'Commonly spoofed navigator properties no longer have a native implementation',
    test: (f) => S(f.a_nav_accessors_nonnative) && f.a_nav_accessors_nonnative > 0 },
  // Found by looking at the evasion layer's own output: it rewrites
  // WebGLRenderingContext.prototype.getParameter and leaves WebGL2RenderingContext
  // untouched, so the two contexts report different GPUs. puppeteer-extra-plugin-stealth
  // patches both, so this only catches evasion written without that care.
  { id: 'webgl_context_mismatch', layer: 'A', group: 'tamper', w: 2.0,
    why: 'The two WebGL contexts disagree about which GPU renders this page, so one of them was rewritten',
    test: (f) => f.e_webgl_renderer_mismatch === 1 },
  // Only meaningful inside Chromium: Firefox and Safari have no window.chrome and
  // never did, so features.js gates this on the browser family.
  { id: 'chrome_stub', layer: 'A', group: 'tamper', w: 1.5,
    why: 'This browser reports itself as Chrome, but window.chrome is missing or was artificially reconstructed',
    test: (f) => f.a_chrome_absent_in_chromium === 1 || f.a_chrome_stub_in_chromium === 1 },
  // Corroboration only. DevTools trips this too, and people open DevTools, so the
  // weight is deliberately too small to carry a verdict on its own.
  { id: 'cdp', layer: 'A', group: 'env', w: 1.0,
    why: 'A debugging protocol appears to be attached to this page, which is also true when you open DevTools yourself',
    test: (f) => f.a_cdp_stack_getter === 1 },

  // --- Layer B: environment coherence ---------------------------------
  { id: 'software_gpu', layer: 'B', group: 'env', w: 1.5,
    why: 'Desktop User-Agent, but rendering through a software GPU with no real graphics card',
    test: (f) => f.e_desktop_ua_software_gpu === 1 },
  { id: 'no_window_chrome', layer: 'B', group: 'env', w: 1.5,
    why: 'Window has no toolbar or borders, the geometry typical of a headless browser',
    test: (f) => f.e_no_chrome_height === 1 || f.e_outer_zero === 1 },
  { id: 'pointer_none', layer: 'B', group: 'env', w: 1.5,
    why: 'CSS reports that this device has no pointer and no hover capability',
    test: (f) => f.e_pointer_none === 1 || f.e_any_pointer_none === 1 },
  // 'default' and 'prompt' are the same state spelled two ways; features.js folds
  // them together first. What remains is the headless signature: Notification says
  // denied while permissions.query still says prompt.
  { id: 'perm_mismatch', layer: 'B', group: 'env', w: 1.5,
    why: 'Permission APIs contradict each other, so one of them was altered without the other',
    test: (f) => f.e_perm_mismatch === 1 },
  // Chrome loads voices asynchronously and plenty of real desktops have neither a
  // camera nor a microphone, so this is weak on its own by design.
  { id: 'no_media_stack', layer: 'B', group: 'env', w: 0.75,
    why: 'No media devices and no speech synthesis voices are available',
    test: (f) => f.e_media_device_count === 0 && f.e_voices_count === 0 },
  // Only says something inside Chromium: it separates installed Chrome, which ships
  // the proprietary decoders, from the Chromium bundled with automation. Firefox on
  // Linux frequently lacks them too, and that is a person.
  { id: 'chromium_codecs', layer: 'B', group: 'env', w: 1.0,
    why: 'No proprietary codec support, indicating a bundled automation Chromium rather than installed Chrome',
    test: (f) => f.e_chromium_ua === 1 && f.e_h264_absent === 1 && f.e_aac_absent === 1 },
  { id: 'few_fonts', layer: 'B', group: 'env', w: 1.0,
    why: 'Very few fonts installed, characteristic of a container image',
    test: (f) => S(f.e_font_count) && f.e_font_count <= 3 },
  { id: 'utc_no_dst', layer: 'B', group: 'env', w: 0.5,
    why: 'UTC timezone with no seasonal variation, which points to a server rather than a user machine',
    test: (f) => f.e_tz_is_utc === 1 && f.e_tz_no_dst === 1 },
  { id: 'ua_incoherent', layer: 'B', group: 'env', w: 2.0,
    why: 'Platform declarations contradict each other across User-Agent, Client Hints and system',
    test: (f) => f.e_uach_ua_mismatch === 1 || f.e_ua_platform_mismatch === 1 || f.e_mobile_touch_mismatch === 1 },

  // --- Layer C: timing -------------------------------------------------
  // NaN, not 0, when the tab was in the background: no frames there says nothing
  // about who is driving the browser.
  { id: 'no_raf', layer: 'C', group: 'timing', w: 2.0,
    why: 'No animation frames were rendered, so no compositor is drawing this page',
    test: (f) => f.t_raf_absent === 1 },
  { id: 'raf_off_vsync', layer: 'C', group: 'timing', w: 1.5,
    why: 'Frame cadence falls outside the vertical sync range of a real display',
    test: (f) => S(f.t_raf_vsync_ratio) && f.t_raf_count > 5 && f.t_raf_vsync_ratio < 0.5 },

  // --- Layer D: behaviour (positive evidence of automation) ------------
  { id: 'screen_client_eq', layer: 'D', group: 'behaviour', w: 3.0,
    why: 'Screen coordinates identical to page coordinates, so events were injected rather than produced by the operating system',
    test: (f) => S(f.b_pm_screen_client_eq_ratio) && f.b_pm_screen_client_eq_ratio > 0.9 },
  // Taps and keyboard activations are excluded upstream: neither has an approach
  // to miss. What is left is a pointer that materialised on the target.
  { id: 'click_without_approach', layer: 'D', group: 'behaviour', w: 2.0,
    why: 'Clicks with no approach trajectory, the pointer appeared directly over the target',
    test: (f) => S(f.b_click_no_move_ratio) && f.b_click_no_move_ratio > 0.6 },
  { id: 'typed_too_fast', layer: 'D', group: 'behaviour', w: 2.5,
    why: 'Interval between keystrokes below the human motor limit',
    test: (f) => S(f.b_interkey_fast_ratio) && f.b_interkey_fast_ratio > 0.5 },
  { id: 'programmatic_fill', layer: 'D', group: 'behaviour', w: 2.5,
    why: 'Fields filled programmatically, without the keystrokes that would produce them',
    test: (f) => (S(f.b_input_without_keydown) && f.b_input_without_keydown > 0)
      || (S(f.b_input_len_jump_max) && f.b_input_len_jump_max > 5) },
  { id: 'no_movement_delta', layer: 'D', group: 'behaviour', w: 2.0,
    why: 'Pointer events carry no movement delta from the operating system',
    test: (f) => S(f.b_pm_movement_zero_ratio) && f.b_pm_movement_zero_ratio > 0.8 },
  // People scroll with the wheel, the keyboard, a finger or the scrollbar. A page
  // that moves with no input device present anywhere in the session was scrolled
  // by a script.
  { id: 'scroll_programmatic', layer: 'D', group: 'behaviour', w: 1.5,
    why: 'The page scrolled with no wheel, key or touch anywhere in the session, so it was driven by a script',
    test: (f) => f.b_scroll_no_input === 1 },
  { id: 'scroll_orphan', layer: 'D', group: 'behaviour', w: 0.75,
    why: 'Scroll events with no input preceding them',
    test: (f) => S(f.b_scroll_orphan_ratio) && f.b_scroll_orphan_ratio > 0.9
      && S(f.b_scroll_orphan_count) && f.b_scroll_orphan_count >= 3 },
  { id: 'no_submovements', layer: 'D', group: 'behaviour', w: 1.5,
    why: 'Movement without micro corrections, missing the instability of human motor control',
    test: (f) => S(f.b_pm_submovement_rate) && f.b_pm_count > 30 && f.b_pm_submovement_rate < 0.02 },
  { id: 'constant_dwell', layer: 'D', group: 'behaviour', w: 1.5,
    why: 'Button press duration is constant or zero',
    test: (f) => S(f.b_click_dwell_cv) && f.b_click_count >= 3 && f.b_click_dwell_cv < 0.05 },
  // Only a pen grades pressure, so features.js leaves it undefined for a mouse or
  // a finger rather than reporting an invariant value.
  { id: 'single_pressure', layer: 'D', group: 'behaviour', w: 1.0,
    why: 'Pointer pressure holds a single invariant value',
    test: (f) => f.b_pm_pressure_unique === 1 && f.b_pm_count > 30 },
  { id: 'untrusted_events', layer: 'D', group: 'behaviour', w: 3.0,
    why: 'Synthetic events dispatched by script (isTrusted is false)',
    test: (f) => S(f.b_untrusted_ratio) && f.b_untrusted_ratio > 0.2 && f.b_event_count >= 10 },

  // --- Layer D: negative evidence (looks human) ------------------------
  { id: 'human_submovements', layer: 'D', group: 'behaviour', w: -1.5,
    why: 'Trajectory micro corrections consistent with human motor control',
    test: (f) => S(f.b_pm_submovement_rate) && f.b_pm_submovement_rate > 0.08 },
  { id: 'human_curvature', layer: 'D', group: 'behaviour', w: -1.0,
    why: 'Curved trajectory with natural deviation from a straight line',
    test: (f) => S(f.b_pm_straightness_p50) && f.b_pm_straightness_p50 > 1.12 },
  { id: 'human_pressure', layer: 'D', group: 'behaviour', w: -1.0,
    why: 'Pointer pressure varies across the session',
    test: (f) => S(f.b_pm_pressure_unique) && f.b_pm_pressure_unique > 2 },
  // Touch interaction, which is most of the web and none of the default automation
  // stacks. Without it a phone produces no human-side evidence at all.
  { id: 'human_touch', layer: 'D', group: 'behaviour', w: -1.0,
    why: 'Touch interaction from a physical screen',
    test: (f) => S(f.b_touch_count) && f.b_touch_count >= 2 },
];

/**
 * Heuristic bias, set by hand rather than estimated from how many visitors are
 * people or bots. It keeps a visit without enough evidence from being classified as
 * automation: with no evidence the score is about 0.17. Without it the score sits at
 * exactly 0.5 and the page greets every visitor as automation.
 *
 * The size is set so that the weak environment signals cannot add up to a verdict
 * on their own: a Linux desktop with no camera, few fonts and DevTools open is a
 * developer, not a bot, and that combination has to stay below the line.
 */
const BIAS = 3.5;

/** How fast accumulated evidence saturates. */
const SCALE = 2.2;

/** Decision point. Reported to the UI so the threshold is never implied. */
export const THRESHOLD = 0.5;

/** A direct artifact is not a matter of degree: it puts the verdict on the floor. */
const HARD_FLOOR = 0.95;

function squash(x, scale = SCALE) {
  return 1 / (1 + Math.exp(-x / scale));
}

/**
 * Returns an uncalibrated risk score in `probability`, fired rules, and coverage.
 * The field name is kept for compatibility with the analysis pipeline. A session with
 * no interaction leaves every behavioural rule undecidable, and the caller needs
 * to know that before trusting the score.
 */
export function scoreBaseline(features) {
  const fired = [];
  const groups = { hard: 0, tamper: 0, env: 0, timing: 0, behaviour: 0 };
  let evaluable = 0;

  for (const rule of RULES) {
    let result;
    try {
      result = rule.test(features);
    } catch (_) {
      continue;
    }
    if (result === true || result === false) evaluable++;
    if (result !== true) continue;
    groups[rule.group] += rule.w;
    fired.push({ id: rule.id, layer: rule.layer, group: rule.group, weight: rule.w, why: rule.why });
  }

  // Human behavioural evidence cancels behavioural suspicion and nothing else.
  const total = groups.hard + groups.tamper + groups.env + groups.timing
    + Math.max(0, groups.behaviour);
  let probability = squash(total - BIAS);
  if (groups.hard > 0) probability = Math.max(probability, HARD_FLOOR);

  fired.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return {
    probability,
    threshold: THRESHOLD,
    raw_score: total,
    groups,
    fired,
    rules_evaluated: evaluable,
    rules_total: RULES.length,
    coverage: evaluable / RULES.length,
  };
}
