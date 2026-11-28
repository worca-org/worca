// test/ui-tab-fold.test.mjs — which tabs of a detail screen's tab line go under "More" at a given width (jsdom does no
// layout, so the decision is a pure function: widths in, folded keys out). The wiring is test/ui-detail-tabs.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldTabs } from '../ui/public/tab-fold.mjs';
import { checkRows } from './helpers/rows.mjs';

const tabs = (...pairs) => pairs.map(([key, width]) => ({ key, width }));
// A run page's ten tabs in table order. Gap 10, More 50, the tool icons 118.
const TABS = tabs(['overview', 100], ['task', 60], ['diff', 60], ['artifacts', 90], ['actions', 80], ['workflow', 90],
  ['qa', 60], ['logs', 60], ['sessions', 80], ['agents', 70]);
const ICONS = 118;
const fold = (over = {}) => foldTabs({ tabs: TABS, active: 'overview', avail: 1000, gap: 10, more: 50, ...over });
// All ten drawn: 750 of tabs and 9 gaps.
const ALL = 840;
// The foldable tabs, in the order they give way.
const RIGHT_TO_LEFT = ['agents', 'sessions', 'logs', 'qa', 'workflow', 'actions', 'artifacts', 'diff', 'task'];

test('all tabs that fit: nothing folds, no More', async () => {
  await checkRows([
    { name: 'wide', run: () => assert.deepEqual(fold(), []) },
    { name: 'exactly wide enough', run: () => assert.deepEqual(fold({ avail: ALL }), []) },
    { name: 'any number of tabs stays on the line', run: () => assert.deepEqual(fold({ avail: 100000 }), []) },
    { name: 'one tab', run: () => assert.deepEqual(fold({ tabs: tabs(['overview', 100]), avail: 100 }), []) },
  ]);
});

test('a narrow bar folds from the right end: Agents, Sessions, Logs, Q&A before Workflow and Actions', async () => {
  await checkRows([
    // 680 of tabs, More and 9 gaps: 820.
    { name: 'one tab', run: () => assert.deepEqual(fold({ avail: ALL - 1 }), ['agents']) },
    { name: 'it fits with that one gone', run: () => assert.deepEqual(fold({ avail: 820 }), ['agents']) },
    { name: 'two tabs', run: () => assert.deepEqual(fold({ avail: 819 }), ['agents', 'sessions']) },
    { name: 'Logs and Q&A, Workflow still drawn', run: () => assert.deepEqual(fold({ avail: 590 }), RIGHT_TO_LEFT.slice(0, 4)) },
    { name: 'then Workflow and Actions', run: () => assert.deepEqual(fold({ avail: 400 }), RIGHT_TO_LEFT.slice(0, 6)) },
    { name: 'down to Overview, Task and More', run: () => assert.deepEqual(fold({ avail: 230 }), RIGHT_TO_LEFT.slice(0, 8)) },
  ]);
});

test('the gaps and More count once something folds; More is not counted while nothing folds', async () => {
  const two = tabs(['overview', 100], ['task', 100]);
  const run = (avail) => foldTabs({ tabs: two, active: 'overview', avail, gap: 10, more: 50 });
  await checkRows([
    { name: 'no More: two tabs and one gap', run: () => assert.deepEqual(run(210), []) },
    { name: 'the gap tips it', run: () => assert.deepEqual(run(209), ['task']) },
    // 680 of tabs and 8 gaps would fit in 800; More and its gap do not.
    { name: 'More and its gap tip it', run: () => assert.deepEqual(fold({ avail: 800 }), ['agents', 'sessions']) },
  ]);
});

test('the end width (and its gap) is reserved; end 0 costs nothing', async () => {
  await checkRows([
    { name: 'the icons and their gap fit', run: () => assert.deepEqual(fold({ end: ICONS, avail: ALL + ICONS + 10 }), []) },
    { name: 'the gap tips it', run: () => assert.deepEqual(fold({ end: ICONS, avail: ALL + ICONS + 9 }), ['agents']) },
    { name: 'a width that fits without the icons folds with them', run: () => {
      assert.deepEqual(fold({ avail: ALL }), []);
      // 820 with Agents folded, plus 128: 948, 858, 788.
      assert.deepEqual(fold({ avail: ALL, end: ICONS }), ['agents', 'sessions', 'logs']);
    } },
    { name: 'end 0', run: () => assert.deepEqual(fold({ avail: ALL, end: 0 }), []) },
    { name: 'an end width that is not finite', run: () => assert.deepEqual(fold({ avail: ALL, end: Number.NaN }), []) },
  ]);
});

test('Overview and the open tab are never folded', async () => {
  await checkRows([
    { name: 'the open tab is skipped', run: () => assert.deepEqual(fold({ active: 'agents', avail: ALL - 1 }), ['sessions']) },
    { name: 'a tiny bar keeps Overview, the open tab and More', run: () => assert.deepEqual(
      fold({ active: 'actions', avail: 1, end: ICONS }), RIGHT_TO_LEFT.filter((k) => k !== 'actions')) },
    // Overview, Task, the open Agents and More: 280 and 3 gaps.
    { name: 'the open tab past the fold point takes room', run: () => assert.deepEqual(
      fold({ active: 'agents', avail: 310 }), RIGHT_TO_LEFT.slice(1, 8)) },
    { name: 'no open tab', run: () => assert.deepEqual(fold({ active: null, avail: 1 }), RIGHT_TO_LEFT) },
  ]);
});

test('an unmeasured bar folds nothing', async () => {
  await checkRows([0, -1, Number.NaN, undefined].map((avail) => (
    { name: `avail ${avail}`, run: () => assert.deepEqual(foldTabs({ tabs: TABS, active: 'overview', avail, gap: 10, more: 50, end: ICONS }), []) }
  )));
});

test('empty input and widths that are not finite never throw', async () => {
  await checkRows([
    { name: 'nothing to fold', run: () => assert.deepEqual(foldTabs({ tabs: [], active: null, avail: 1, gap: 10, more: 50 }), []) },
    { name: 'widths that are not finite count as 0', run: () => assert.deepEqual(
      foldTabs({ tabs: tabs(['overview', Number.NaN], ['task', undefined]), active: 'overview', avail: 1, gap: Number.NaN, more: Infinity }), []) },
  ]);
});

test('monotone: every narrower bar folds at least what a wider one folds, in the same order', () => {
  for (const end of [0, ICONS]) {
    for (const active of ['overview', 'diff', 'actions', 'agents', null]) {
      let wider = fold({ active, end, avail: 1100 });
      for (let avail = 1100; avail >= 1; avail--) {
        const now = fold({ active, end, avail });
        assert.deepEqual(now.slice(0, wider.length), wider, `${active}, end ${end}, at ${avail}px`);
        wider = now;
      }
    }
  }
});

test('half a pixel of rounding does not fold a tab', async () => {
  await checkRows([
    { name: 'within tolerance', run: () => assert.deepEqual(fold({ avail: ALL - 0.5 }), []) },
    { name: 'past it', run: () => assert.deepEqual(fold({ avail: ALL - 0.6 }), ['agents']) },
  ]);
});
