/**
 * Model inference, hand-written. No ONNX, no runtime dependency.
 *
 * The model ships as JSON (raw tree nodes) and this file evaluates it, which keeps
 * the page one small static asset and keeps the case constraint unambiguous:
 * nothing is delegated to an off-the-shelf detector.
 *
 * NaN is a first-class input, not silently read as zero. The reason codes shown in
 * the page come from the rule engine, which produces exact explanations; this file
 * only produces the model score, without probability calibration.
 */

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

/** Node layout: [is_leaf, value, feature_idx, threshold, left, right, missing_left]. */
function predictGBDT(model, vec) {
  let raw = model.base_score;
  for (const tree of model.trees) {
    let node = 0;
    // Bounded by depth. Cheap insurance against a malformed export.
    for (let step = 0; step < 128; step++) {
      const n = tree[node];
      if (n[0] === 1) { raw += n[1]; break; }
      const v = vec[n[2]];
      if (!Number.isFinite(v)) node = n[6] === 1 ? n[4] : n[5];
      else node = v <= n[3] ? n[4] : n[5];
    }
  }
  return sigmoid(raw);
}

/** Returns null when no model is published yet, and the page falls back to rules. */
export async function loadModel(url = './src/model.json') {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const model = await res.json();
    if (model.kind !== 'gbdt' || !Array.isArray(model.feature_names) || !model.feature_names.length) {
      return null;
    }
    return model;
  } catch (_) {
    return null;
  }
}

/** Score a feature map with a loaded model. */
export function scoreModel(model, featureMap) {
  const vec = model.feature_names.map((n) => {
    const v = featureMap[n];
    return typeof v === 'number' ? v : NaN;
  });
  return {
    probability: predictGBDT(model, vec),
    threshold: model.threshold ?? 0.5,
    model_kind: model.kind,
    model_version: model.metadata?.version ?? 'dev',
  };
}
