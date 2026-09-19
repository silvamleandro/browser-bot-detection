import { scoreBaseline } from './baseline.js';
import { scoreModel } from './infer.js';

const requiredBehaviour = new WeakMap();

// Only features the trees actually split on matter; most of the exported
// feature_names are never read. The published model splits on 16 behavioural
// ones, spanning pointer motion, click dwell and wheel deltas, so all three have
// to be present before the gate opens. A phone emits no wheel events and a
// keyboard-only visit emits no pointer motion, so both stay on the rules for the
// whole visit. That is the conservative side: the rules are the engine that
// scored zero false positives on the collected sessions.
function hasModelEvidence(model, features) {
  if (!requiredBehaviour.has(model)) {
    const names = new Set();
    for (const tree of model.trees) {
      for (const node of tree) {
        if (node[0] !== 1) {
          const name = model.feature_names[node[2]];
          if (name.startsWith('b_')) names.add(name);
        }
      }
    }
    requiredBehaviour.set(model, [...names]);
  }
  return requiredBehaviour.get(model).every((name) => Number.isFinite(features[name]));
}

/** Live policy; offline scoreModel still measures the model on its own.
 * The trees read a missing behavioural input as bot, which is how the first
 * published model called every visitor who had not interacted yet automation.
 * So the model only takes over once the inputs it splits on exist, and until
 * then the rules decide rather than the model interpreting absence. This gate
 * does not establish model generalisation; it prevents that known missing-input
 * false positive. Direct automation artifacts retain precedence.
 */
export function scoreVisit(features, model = null) {
  const rules = scoreBaseline(features);
  if (!model || rules.groups.hard > 0 || !hasModelEvidence(model, features)) {
    return { ...rules, source: 'rules' };
  }
  return { ...scoreModel(model, features), fired: rules.fired, source: 'model' };
}
