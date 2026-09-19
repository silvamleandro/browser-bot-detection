import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractFeatures } from '../web/src/features.js';
import { scoreModel } from '../web/src/infer.js';
import { scoreVisit } from '../web/src/decision.js';

const model = JSON.parse(fs.readFileSync(new URL('../web/src/model.json', import.meta.url)));
const isBot = (result) => result.probability >= result.threshold;
const features = (events = []) => extractFeatures({ events, elapsed_ms: 5000 });
const scroll = [
  { e: 'wh', t: 1000, dy: 20, dm: 0 },
  { e: 'sc', t: 1010, sy: 10 },
  { e: 'sc', t: 1026, sy: 20 },
  { e: 'sc', t: 1042, sy: 30 },
];

test('the shipped model cannot label a new visit as bot just for missing scroll', () => {
  const f = features();
  const result = scoreVisit(f, model);
  assert.equal(result.source, 'rules');
  assert.equal(isBot(result), false);
});

test('typing and pointer activity without scroll keep the initial rule assessment', () => {
  const events = [
    ...Array.from({ length: 20 }, (_, i) => ({
      e: 'pm', t: 1000 + i * 80, x: 10 + i * 3, y: 20 + i * 4, pt: 'mouse', tr: 1,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      e: 'kd', t: 3000 + i * 250, c: 'alpha', rep: 0, mod: 0, tr: 1,
    })),
  ];
  const result = scoreVisit(features(events), model);
  assert.equal(result.source, 'rules');
});

test('observed scroll allows the model to score, and restarting returns to rules', () => {
  const f = features(scroll);
  const result = scoreVisit(f, model);
  assert.equal(result.source, 'model');
  assert.equal(result.probability, scoreModel(model, f).probability);
  assert.equal(result.threshold, scoreModel(model, f).threshold);
  assert.equal(isBot(result), false);
  assert.equal(scoreVisit(features(), model).source, 'rules');
});

test('direct automation evidence survives a human-looking model input', () => {
  const f = { ...features(scroll), a_webdriver: 1 };
  assert.equal(isBot(scoreModel(model, f)), false);
  const result = scoreVisit(f, model);
  assert.equal(result.source, 'rules');
  assert.equal(isBot(result), true);
  assert.ok(result.fired.some((rule) => rule.group === 'hard'));
});

test('model unavailability leaves the rule detector working', () => {
  assert.equal(isBot(scoreVisit(features())), false);
  assert.equal(isBot(scoreVisit({ a_webdriver: 1 })), true);
});
