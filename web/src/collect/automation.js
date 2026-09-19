/**
 * Layer A: automation artifacts and tamper detection.
 *
 * Direct artifacts are precise but trivially removed, so the more useful half of
 * this module asks "has someone been editing this browser's APIs?" rather than
 * "is the flag set?". Evasion tooling trades one signal for another.
 */
import { safe, PROBE_ABSENT } from '../util.js';

/** Window/document keys injected by specific automation stacks. */
const KNOWN_GLOBALS = [
  // Playwright
  '__playwright__binding__', '__pwInitScripts', '__playwright_target__',
  '__pw_manual', '_playwright_global',
  // Puppeteer
  '__puppeteer_evaluation_script__', 'puppeteer',
  // Selenium / WebDriver
  '_Selenium_IDE_Recorder', '_selenium', 'callSelenium', '__webdriver_script_fn',
  '__driver_evaluate', '__webdriver_evaluate', '__selenium_evaluate',
  '__fxdriver_evaluate', '__driver_unwrapped', '__webdriver_unwrapped',
  '__selenium_unwrapped', '__fxdriver_unwrapped', '__$webdriverAsyncExecutor',
  'webdriver', 'domAutomation', 'domAutomationController',
  // Nightmare / PhantomJS / Electron
  '__nightmare', 'callPhantom', '_phantom', 'phantom', 'awesomium',
  // Anti-detect / stealth runtimes
  '__stealth', '__navigator_patched', '__undetected_chromedriver',
];

/** ChromeDriver leaves `cdc_`-prefixed keys on `document`. */
const DOC_KEY_PATTERNS = [/^cdc_/, /^\$cdc_/, /^\$chrome_asyncScriptInfo$/, /^__webdriver/, /^__selenium/, /^__driver/];

/** Check these still report [native code] under toString. */
function nativeFunctionChecks() {
  const targets = [
    ['Function.toString', () => Function.prototype.toString],
    ['navigator.permissions.query', () => navigator.permissions.query],
    ['navigator.mediaDevices.enumerateDevices', () => navigator.mediaDevices.enumerateDevices],
    ['canvas.toDataURL', () => HTMLCanvasElement.prototype.toDataURL],
    ['canvas.getContext', () => HTMLCanvasElement.prototype.getContext],
    ['webgl.getParameter', () => WebGLRenderingContext.prototype.getParameter],
    ['Date.getTimezoneOffset', () => Date.prototype.getTimezoneOffset],
    ['Intl.DateTimeFormat', () => Intl.DateTimeFormat],
    ['Notification.requestPermission', () => Notification.requestPermission],
    ['Element.attachShadow', () => Element.prototype.attachShadow],
    ['Object.getOwnPropertyDescriptor', () => Object.getOwnPropertyDescriptor],
    ['Reflect.get', () => Reflect.get],
  ];
  const patched = [];
  let checked = 0;
  for (const [name, getFn] of targets) {
    const fn = safe(getFn, null);
    if (typeof fn !== 'function') continue;
    checked++;
    const src = safe(() => Function.prototype.toString.call(fn), '');
    if (typeof src === 'string' && !src.includes('[native code]')) patched.push(name);
  }
  return { checked, patched };
}

/**
 * In stock Chrome, `webdriver` is an accessor on Navigator.prototype and the
 * instance has no own property. Deleting it or shadowing it changes that shape.
 */
function accessorShapeChecks() {
  const out = {};

  out.webdriver_own_prop = safe(() => Object.prototype.hasOwnProperty.call(navigator, 'webdriver'));
  out.webdriver_on_proto = safe(() => Object.prototype.hasOwnProperty.call(Navigator.prototype, 'webdriver'));
  out.webdriver_descriptor_kind = safe(() => {
    const d = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
    if (!d) return 'missing';
    if (d.get) return 'accessor';
    return 'data';
  });
  out.webdriver_getter_native = safe(() => {
    const d = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
    if (!d || !d.get) return PROBE_ABSENT;
    return Function.prototype.toString.call(d.get).includes('[native code]');
  });

  for (const [label, obj, prop] of [
    ['languages', Navigator.prototype, 'languages'],
    ['plugins', Navigator.prototype, 'plugins'],
    ['hardware_concurrency', Navigator.prototype, 'hardwareConcurrency'],
    ['platform', Navigator.prototype, 'platform'],
    ['user_agent', Navigator.prototype, 'userAgent'],
  ]) {
    out[`${label}_own_prop`] = safe(() => Object.prototype.hasOwnProperty.call(navigator, prop));
    out[`${label}_getter_native`] = safe(() => {
      const d = Object.getOwnPropertyDescriptor(obj, prop);
      if (!d || !d.get) return PROBE_ABSENT;
      return Function.prototype.toString.call(d.get).includes('[native code]');
    });
  }
  return out;
}

/**
 * With CDP attached and Runtime enabled, logging an Error makes the remote end
 * serialise it, which fires the `stack` getter. Nothing fires it in a normal page.
 *
 * Caveat: this detects an attached debugger, not a bot. DevTools trips it too.
 */
function cdpProbe() {
  return safe(() => {
    let touched = false;
    const e = new Error('cdp-probe');
    Object.defineProperty(e, 'stack', {
      configurable: true,
      get() { touched = true; return 'cdp-probe'; },
    });
    // Quietest console method that still serialises.
    const original = console.debug;
    try {
      console.debug(e);
    } finally {
      console.debug = original;
    }
    return touched;
  });
}

export function collectAutomation() {
  const out = {};

  // --- direct artifacts -------------------------------------------------
  // Trivially removable, but still set in a lot of real automation traffic.
  out.webdriver = safe(() => navigator.webdriver);
  const foundGlobals = safe(() => KNOWN_GLOBALS.filter((k) => k in window || k in (window.document || {})), []);
  out.known_globals_count = Array.isArray(foundGlobals) ? foundGlobals.length : PROBE_ABSENT;
  out.known_globals = Array.isArray(foundGlobals) ? foundGlobals.join('|') : PROBE_ABSENT;

  const docKeys = safe(() => Object.keys(document).filter((k) => DOC_KEY_PATTERNS.some((re) => re.test(k))), []);
  out.doc_automation_keys_count = Array.isArray(docKeys) ? docKeys.length : PROBE_ABSENT;
  out.doc_automation_keys = Array.isArray(docKeys) ? docKeys.join('|') : PROBE_ABSENT;

  // Playwright's exposeFunction wrapper has a recognisable toString body.
  out.exposed_binding_found = safe(() => {
    for (const k of Object.getOwnPropertyNames(window)) {
      if (!/^__|binding|playwright|puppeteer/i.test(k)) continue;
      const v = window[k];
      if (typeof v !== 'function') continue;
      const src = Function.prototype.toString.call(v);
      if (src.includes('exposeBindingHandle') || src.includes('__installed')) return true;
    }
    return false;
  });

  out.ua_headless_marker = safe(() => /HeadlessChrome|Electron|PhantomJS|SlimerJS/i.test(navigator.userAgent));

  // A reconstructed stub gets the key set right but not the function sources.
  out.chrome_present = safe(() => typeof window.chrome === 'object' && window.chrome !== null);
  out.chrome_has_csi = safe(() => typeof window.chrome?.csi === 'function');
  out.chrome_has_load_times = safe(() => typeof window.chrome?.loadTimes === 'function');
  out.chrome_has_runtime = safe(() => !!window.chrome?.runtime);
  out.chrome_csi_native = safe(() => {
    if (typeof window.chrome?.csi !== 'function') return PROBE_ABSENT;
    return Function.prototype.toString.call(window.chrome.csi).includes('[native code]');
  });

  // --- tamper detection -------------------------------------------------
  const nat = nativeFunctionChecks();
  out.natives_checked = nat.checked;
  out.natives_patched_count = nat.patched.length;
  out.natives_patched = nat.patched.join('|');

  Object.assign(out, accessorShapeChecks());

  // Proxy traps change how errors surface on an illegal invocation.
  out.proxy_toString_anomaly = safe(() => {
    try {
      // Stock V8 throws TypeError here. A Proxy around natives can change or swallow it.
      Function.prototype.toString.call({});
      return true; // no throw at all is itself anomalous
    } catch (err) {
      return !(err instanceof TypeError);
    }
  });

  out.error_stack_depth = safe(() => {
    function a() { return b(); }
    function b() { return c(); }
    function c() { return new Error('depth').stack.split('\n').length; }
    return a();
  });
  out.has_capture_stack_trace = safe(() => typeof Error.captureStackTrace === 'function');

  // --- CDP --------------------------------------------------------------
  out.cdp_stack_getter = cdpProbe();

  return out;
}
