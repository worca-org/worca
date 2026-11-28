// test/ui-how-it-works-slots.test.mjs — where each page keeps its "How it works" button in the static shell
// (index.html): the last control on the page's own top row, never the top bar. The controller that fills the
// slots is covered by ui-how-it-works-dialog.test.mjs; the headers built in JS by their own suites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readIndexHtml } from '../src/core/read-index-html.mjs';

const doc = new JSDOM(readIndexHtml()).window.document;
const slotsOf = (area) => [...doc.querySelectorAll(`[data-howto-slot="${area}"]`)];

// area -> the row (or the row's group of controls) the slot ends, the id just before it (null: the intro text's
// own <div>), and its size ('md': a row of 32px buttons).
const ROWS = {
  runs: { row: '.runs-head', before: 'runs-new-slot' },
  new: { row: '[data-view="new"] > .topbar', before: null },
  schedules: { row: '[data-view="schedules"] > .topbar > .topbar-actions', before: 'schedules-new', size: 'md' },
  stats: { row: '[data-view="stats"] > .topbar', before: null },
  'team-metrics': { row: '[data-view="team-metrics"] > .topbar', before: 'tm-sync' },
  requirements: { row: '[data-view="requirements"] > .topbar', before: null },
  models: { row: '[data-view="models"] > .mdl-head', before: null, size: 'md' },
  projects: { row: '.proj-screen-list > .topbar > .topbar-actions', before: 'project-add-btn' },
  'team-policy': { row: '[data-view="team-policy"] > .topbar', before: 'tp-sync' },
};

for (const [area, { row, before, size }] of Object.entries(ROWS)) {
  test(`${area}: one slot, the last control on its row`, () => {
    const slots = slotsOf(area);
    assert.equal(slots.length, 1);
    const [slot] = slots;
    assert.equal(slot.tagName, 'SPAN');
    assert.ok(slot.classList.contains('howto-slot'));
    assert.equal(slot.children.length, 0, 'empty: the controller fills it');
    const host = doc.querySelector(row);
    assert.ok(host, `${row} exists`);
    assert.equal(slot.parentElement, host);
    assert.equal(host.lastElementChild, slot, 'the far corner: nothing after it');
    if (before) assert.equal(slot.previousElementSibling.id, before);
    assert.equal(slot.dataset.howtoSize, size, size ? '32px beside 32px buttons' : '28px');
  });
}

test('Schedules: the main button and the ? are one group, so the row still has two ends', () => {
  const top = doc.querySelector('[data-view="schedules"] > .topbar');
  assert.equal(top.children.length, 2);
  assert.equal(doc.getElementById('schedules-new').parentElement.className, 'topbar-actions');
});

test('Models: the slot is outside the Catalogue-only actions, so every tab shows it', () => {
  const [slot] = slotsOf('models');
  assert.equal(slot.closest('[data-tab-only]'), null);
  assert.ok(slot.previousElementSibling.matches('.mv-head-actions[data-tab-only="catalogue"]'));
  assert.deepEqual([...doc.querySelector('.mdl-head').children].map((e) => e.id || e.className), ['models-tabs-host', 'mv-head-actions', 'howto-slot']);
});

test('Settings: every section starts with a line that ends in the slot, after its own button if it has one', () => {
  const panes = [...doc.querySelectorAll('[data-view="settings"] .settings-pane')];
  assert.deepEqual(panes.map((p) => p.dataset.tab), ['general', 'tags', 'presets', 'automations', 'runs', 'experimental', 'ask', 'guardrails', 'memory']);
  for (const pane of panes) {
    const tab = pane.dataset.tab;
    const top = pane.firstElementChild;
    assert.ok(top.matches('div.topbar'), `${tab}: the line above the cards comes first`);
    const slots = [...pane.querySelectorAll('[data-howto-slot]')];
    assert.equal(slots.length, 1, `${tab}: one slot`);
    assert.equal(slots[0].dataset.howtoSlot, 'settings');
    assert.equal(slots[0].dataset.howtoSize, undefined, `${tab}: 28px`);
    assert.ok(top.contains(slots[0]), `${tab}: on that line`);
    assert.equal(top.children.length, 2, `${tab}: the line has two ends`);
    assert.equal(top.lastElementChild.contains(slots[0]), true, `${tab}: at its right end`);
    assert.equal(slots[0].parentElement.lastElementChild, slots[0], `${tab}: nothing after it`);
  }
  assert.equal(slotsOf('settings').length, panes.length, 'no Settings slot outside a section');
  for (const id of ['flags-reset', 'guardrail-create-btn']) {
    const btn = doc.getElementById(id);
    assert.equal(btn.parentElement.className, 'topbar-actions', `${id} shares a group with the slot`);
    assert.equal(btn.nextElementSibling.dataset.howtoSlot, 'settings', `${id} comes just before it`);
  }
});

test('Workspaces: its own button is the icon form, after Create workspace', () => {
  const btn = doc.getElementById('ws-howto-btn');
  const acts = doc.querySelector('.ws-screen-list .ws-top-actions');
  assert.deepEqual([...acts.children].map((e) => e.id), ['ws-create-btn', 'ws-howto-btn']);
  assert.deepEqual([...btn.classList], ['btn', 'btn-quiet', 'btn-icon', 'btn-sm', 'page-howto']);
  assert.equal(btn.textContent.trim(), '', 'no words');
  assert.equal(btn.title, 'How workspaces work');
  assert.equal(btn.getAttribute('aria-label'), 'How workspaces work');
  assert.equal(btn.dataset.howtoLabel, 'How workspaces work');
  assert.equal(btn.hasAttribute('data-min-level'), false, 'no level gate, as before');
  assert.equal(btn.hasAttribute('data-howto-area'), false, 'app.js opens its walkthrough, not the controller');
  assert.equal(btn.querySelector('svg').getAttribute('width'), '16');
  assert.equal(btn.querySelector('.howto-new').hidden, true);
  assert.equal(slotsOf('workspaces').length, 0);
});

test('the top bar holds no How it works button, and no page has two slots', () => {
  assert.equal(doc.querySelector('.topnav [id*="howto"], .topnav [data-howto-slot], .topnav-r .page-howto'), null);
  // The pages whose header is built in JS (Chat and Design's list, Marketplace, Connectors) and the Workflows
  // editor (its own #wfv-howto-slot) have no static slot.
  for (const area of ['chat', 'design', 'marketplace', 'connectors', 'workflows']) assert.equal(slotsOf(area).length, 0, area);
  const areas = [...doc.querySelectorAll('[data-howto-slot]')].map((s) => s.dataset.howtoSlot);
  assert.deepEqual([...new Set(areas)].sort(), [...Object.keys(ROWS), 'settings'].sort());
});
