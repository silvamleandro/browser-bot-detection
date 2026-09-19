/**
 * Shared helpers for signal collection.
 *
 * Every probe runs inside `safe()`. Exotic browser APIs throw often enough that an
 * unguarded collector would lose a whole session to one bad property access, and a
 * probe that throws is informative, so the failure is recorded rather than dropped.
 */

/** Sentinel stored when a probe throws. Distinct from `null` (probe ran, no value). */
export const PROBE_ERROR = '__error__';
/** Sentinel stored when the API does not exist in this browser at all. */
export const PROBE_ABSENT = '__absent__';

/** Run `fn`, returning its value or a sentinel describing how it failed. */
export function safe(fn, fallback = PROBE_ERROR) {
  try {
    const v = fn();
    return v === undefined ? PROBE_ABSENT : v;
  } catch (_) {
    return fallback;
  }
}

/** Async variant of `safe`, with a timeout so one hung promise cannot stall collection. */
export async function safeAsync(fn, timeoutMs = 1500, fallback = PROBE_ERROR) {
  try {
    return await Promise.race([
      Promise.resolve(fn()),
      new Promise((resolve) => setTimeout(() => resolve('__timeout__'), timeoutMs)),
    ]);
  } catch (_) {
    return fallback;
  }
}

/** Random. Not derived from any device or user property. */
export function sessionId() {
  const bytes = new Uint8Array(16);
  (globalThis.crypto || {}).getRandomValues?.(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
