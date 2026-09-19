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

test('a session with the behaviour the trees need is scored by the model', () => {
  // A recorded humanized bot: it moves, clicks twice and scrolls with the wheel,
  // so every behavioural input the model splits on exists.
  const sessions = fs.readFileSync(new URL('../data/sample/sessions.sample.jsonl', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const humanized = sessions.filter((s) => s.meta.journey === 'humanized').map(extractFeatures);
  const scored = humanized.filter((f) => scoreVisit(f, model).source === 'model');
  assert.ok(scored.length, 'no humanized session had the inputs the model needs');
  for (const f of scored) {
    const result = scoreVisit(f, model);
    assert.equal(result.probability, scoreModel(model, f).probability);
    assert.equal(isBot(result), true);
  }
  // A visit that has just started goes back to the rules.
  assert.equal(scoreVisit(features(), model).source, 'rules');
});

test('a direct automation artifact keeps the decision with the rules', () => {
  const f = { ...features(scroll), a_webdriver: 1 };
  const result = scoreVisit(f, model);
  assert.equal(result.source, 'rules');
  assert.equal(isBot(result), true);
  assert.ok(result.fired.some((rule) => rule.group === 'hard'));
});

test('model unavailability leaves the rule detector working', () => {
  assert.equal(isBot(scoreVisit(features())), false);
  assert.equal(isBot(scoreVisit({ a_webdriver: 1 })), true);
});

test('scrolling with the keyboard is not what decides the verdict', () => {
  // The first published model split on the mean scroll jump alone, so a space bar
  // or a mouse wheel without smooth scrolling crossed its threshold and read as bot.
  const keyboard = [
    { e: 'kd', t: 2000, c: 'space', rep: 0, mod: 0, tr: 1 },
    ...Array.from({ length: 9 }, (_, i) => ({ e: 'sc', t: 2016 + i * 16, sy: 70 * i, sx: 0, target: 0, tr: 1 })),
  ];
  assert.equal(isBot(scoreVisit(features(keyboard), model)), false);
  const wheel = Array.from({ length: 8 }, (_, i) => [
    { e: 'wh', t: 1000 + i * 300, dy: 100, dm: 0, tr: 1 },
    { e: 'sc', t: 1010 + i * 300, sy: 100 * i, sx: 0, target: 0, tr: 1 },
  ]).flat();
  assert.equal(isBot(scoreVisit(features(wheel), model)), false);
});
