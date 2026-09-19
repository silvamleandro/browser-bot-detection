/**
 * Session orchestration.
 *
 * The recorder is attached synchronously before any probe is awaited: automation
 * usually acts in the first few hundred ms, which is exactly the window we would
 * lose by collecting the environment first.
 */
import { sessionId } from './util.js';
import { collectEnvironment } from './collect/environment.js';
import { collectAutomation } from './collect/automation.js';
import { collectTiming } from './collect/timing.js';
import { startRecorder } from './collect/behavior.js';
import { extractFeatures } from './features.js';

export const SCHEMA_VERSION = 1;

export function createSession() {
  // Attach first. Await nothing above this line.
  const recorder = startRecorder(document);
  const started_at = Date.now();
  const id = sessionId();

  let passive = null;
  const passivePromise = (async () => {
    // Cheap and synchronous, so the first verdict does not wait on the rest.
    const automation = collectAutomation();
    const [env, timing] = await Promise.all([collectEnvironment(), collectTiming()]);
    passive = { env, automation, timing };
    return passive;
  })();

  const record = (meta = {}) => ({
    schema_version: SCHEMA_VERSION,
    session_id: id,
    started_at,
    page: {
      url: location.origin + location.pathname,
      has_referrer: document.referrer.length > 0,
    },
    env: passive?.env ?? {},
    automation: passive?.automation ?? {},
    timing: passive?.timing ?? {},
    events: recorder.events.slice(),
    elapsed_ms: recorder.elapsed(),
    truncated: recorder.truncated,
    meta,
  });

  return {
    id,
    recorder,
    /** Resolves once passive collection completes. */
    ready: passivePromise,
    /** Have the passive probes landed? */
    get passiveReady() { return passive !== null; },
    /** What gets stored during research collection. */
    record,
    /** Recomputed from the live event stream. */
    features(meta = {}) { return extractFeatures(record(meta)); },
    stop() { recorder.stop(); },
  };
}
