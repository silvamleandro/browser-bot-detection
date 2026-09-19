/**
 * Evasion layers, so the dataset covers adversaries that actively hide.
 *
 * `basic` is a naive evasion: it hides the same signals public stealth plugins
 * hide, but without their care. It deletes the WebDriver accessor instead of using
 * the launch flag, installs plain JavaScript functions without masking
 * Function.prototype.toString, and patches WebGL 1 only. The tamper rules catch it
 * for exactly those reasons, so it is not a stand-in for a real stealth plugin.
 *
 * `flag` is the one-line evasion: the launch flag alone, nothing rewritten.
 * The real public plugin (puppeteer-extra-plugin-stealth) runs through its own
 * launcher in run-matrix.js.
 */

/** The patch set of a stealth plugin, written without a stealth plugin's care. */
export const BASIC_EVASION = `
(() => {
  // 1. remove the WebDriver flag
  try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => undefined, configurable: true }); } catch (e) {}
  try { delete Navigator.prototype.webdriver; } catch (e) {}

  // 2. rebuild a plausible window.chrome
  try {
    if (!window.chrome) window.chrome = {};
    if (!window.chrome.runtime) window.chrome.runtime = {};
    if (!window.chrome.csi) window.chrome.csi = function csi() { return {}; };
    if (!window.chrome.loadTimes) window.chrome.loadTimes = function loadTimes() { return {}; };
    if (!window.chrome.app) window.chrome.app = { isInstalled: false };
  } catch (e) {}

  // 3. normalise the permissions/notification disagreement
  try {
    const orig = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (p) =>
      p && p.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission, onchange: null })
        : orig(p);
  } catch (e) {}

  // 4. populate plugins and languages
  try {
    Object.defineProperty(Navigator.prototype, 'plugins', {
      get: () => [1, 2, 3, 4, 5], configurable: true,
    });
    Object.defineProperty(Navigator.prototype, 'languages', {
      get: () => ['pt-BR', 'pt', 'en-US', 'en'], configurable: true,
    });
  } catch (e) {}

  // 5. claim a real GPU instead of the software rasteriser
  try {
    const gp = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (p) {
      if (p === 37445) return 'Intel Inc.';
      if (p === 37446) return 'Intel Iris OpenGL Engine';
      return gp.apply(this, arguments);
    };
  } catch (e) {}
})();
`;

/** Suppresses Chromium's own automation markers. */
export const EVASION_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--exclude-switches=enable-automation',
];

export function evasionFor(level) {
  if (level === 'basic') return { initScript: BASIC_EVASION, args: EVASION_ARGS };
  // navigator.webdriver becomes false natively, with the accessor untouched.
  if (level === 'flag') return { initScript: null, args: ['--disable-blink-features=AutomationControlled'] };
  return { initScript: null, args: [] };
}
