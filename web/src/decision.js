import { scoreBaseline } from './baseline.js';
import { scoreModel } from './infer.js';

const requiredBehaviour = new WeakMap();

// Only features actually used by tree splits matter. Most of the exported
// feature_names are unused. Waiting for all of them would exclude mobile users
// and people who read without typing or moving a mouse.
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
 * The current model uses only b_scroll_jump_mean and treats missing scroll as bot.
 * Until that input exists, use rules instead of interpreting missing behaviour.
 * This gate does not establish model generalisation; it prevents the known
 * missing-input false positive. Direct automation artifacts retain precedence.
 */
export function scoreVisit(features, model = null) {
  const rules = scoreBaseline(features);
  if (!model || rules.groups.hard > 0 || !hasModelEvidence(model, features)) {
    return { ...rules, source: 'rules' };
  }
  return { ...scoreModel(model, features), fired: rules.fired, source: 'model' };
}
