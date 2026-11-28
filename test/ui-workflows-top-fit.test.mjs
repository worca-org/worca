// test/ui-workflows-top-fit.test.mjs — the Workflows view's top row never overlaps (ui/public/workflows/top-fit.mjs):
// when the top-left bar and the top-right group do not both fit the stage, the status bar folds its badge and chip into
// one "!" button that opens them as a menu, and the top-left bar gets what is left. jsdom has no layout, so each test
// sets the widths the module reads.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createTopFit } from '../ui/public/workflows/top-fit.mjs';
import { closeMenus } from '../ui/public/workflows/menu.mjs';

const HTML = `<!doctype html><body><div id="wfv-stage">
  <div class="wfv-tl"><div class="wfv-bar"><input id="wfv-name"></div></div>
  <div class="wfv-tr">
    <div class="wfv-bar wfv-status" id="wfv-status" data-compact="false">
      <span class="wfv-doc" id="wfv-doc" role="status">Not saved</span>
      <button type="button" class="btn btn-sm btn-danger wfv-errchip is-incomplete" id="wfv-errors">3 ports to wire</button>
      <button type="button" class="btn btn-sm btn-danger btn-icon wfv-errchip wfv-status-more" id="wfv-status-more" aria-haspopup="menu" aria-expanded="false" hidden></button>
    </div>
    <button id="wfv-lib-toggle">Open</button><button id="wfv-save">Save</button>
  </div>
</div></body>`;

const live = [];
afterEach(() => { closeMenus(); for (const d of live.splice(0)) d.window.close(); });
const tick = () => new Promise((r) => setTimeout(r, 0));

/** The page with the widths a browser would report: the top-left bar is `tl` wide, the top-right group `full` with the
 *  status bar open and `folded` with it folded (the "!" counted only while it shows). */
function boot({ stage = 796, tl = 328, full = 360, folded = 200, phone = false } = {}) {
  const dom = new JSDOM(HTML, { url: 'http://localhost/', pretendToBeVisual: true });
  live.push(dom);
  const win = dom.window; const doc = win.document;
  const g = (id) => doc.getElementById(id);
  const w = { stage, tl, full, folded, phone };
  const els = { stage: g('wfv-stage'), tl: doc.querySelector('.wfv-tl'), tr: doc.querySelector('.wfv-tr'), status: g('wfv-status'),
    more: g('wfv-status-more'), badge: g('wfv-doc'), chip: g('wfv-errors') };
  Object.defineProperty(els.stage, 'clientWidth', { configurable: true, get: () => w.stage });
  Object.defineProperty(els.tl, 'offsetWidth', { configurable: true, get: () => w.tl });
  // Folded, the group is its buttons plus the "!" when that shows; open, a showing "!" would be measured too (it must not).
  Object.defineProperty(els.tr, 'offsetWidth', { configurable: true,
    get: () => (els.status.dataset.compact === 'true' ? w.folded - (els.more.hidden ? 44 : 0) : w.full + (els.more.hidden ? 0 : 44)) });
  win.matchMedia = (q) => ({ matches: q === '(max-width:760px)' && w.phone });
  const clicks = [];
  els.chip.addEventListener('click', () => clicks.push('chip'));
  const fitter = createTopFit({ doc, els });
  return { win, doc, els, w, clicks, fitter };
}

test('room for both groups: the status bar stays open, no "!", and the top-left bar is told how wide the right group is', () => {
  const { els, fitter } = boot();                       // 328 + 8 + 360 = 696 <= 796 - 24
  fitter.fit();
  assert.equal(els.status.dataset.compact, 'false');
  assert.equal(els.more.hidden, true);
  assert.equal(els.stage.style.getPropertyValue('--wfv-tr-w'), '360px');
});

test('too narrow for both: the badge and the chip fold into one "!" in the chip\'s tone, named after the problem', () => {
  const { els, w, fitter } = boot();
  w.stage = 620;                                        // 696 > 620 - 24: what the screenshot showed as an overlap
  fitter.fit();
  assert.equal(els.status.dataset.compact, 'true');
  assert.equal(els.more.hidden, false);
  assert.ok(els.more.classList.contains('is-incomplete'), 'grey like the "ports to wire" chip');
  assert.equal(els.more.classList.contains('is-warning'), false);
  assert.equal(els.more.getAttribute('aria-label'), '3 ports to wire. Show details');
  assert.equal(els.more.title, '3 ports to wire');
  assert.equal(els.stage.style.getPropertyValue('--wfv-tr-w'), '200px', 'the folded width: the name takes the rest');
});

test('the decision is taken on the open layout every time: a folded bar opens again once there is room, and the "!" never counts as room taken', () => {
  const { els, w, fitter } = boot({ stage: 620 });
  fitter.fit();
  assert.equal(els.status.dataset.compact, 'true');
  fitter.fit();
  assert.equal(els.status.dataset.compact, 'true', 'still folded: 328 + 8 + 360 was measured, not + the "!"');
  w.stage = 720;                                        // exactly 696 of room
  fitter.fit();
  assert.equal(els.status.dataset.compact, 'false');
  assert.equal(els.more.hidden, true);
  w.stage = 719;
  fitter.fit();
  assert.equal(els.status.dataset.compact, 'true', 'one pixel short');
});

test('a long name folds the status bar first: the name keeps its room', () => {
  const { els, w, fitter } = boot();
  w.tl = 500;                                           // 500 + 8 + 360 > 772
  fitter.fit();
  assert.equal(els.status.dataset.compact, 'true');
});

test('<= 760px the right group has a row of its own: only its width counts', () => {
  const { els, w, fitter } = boot({ phone: true, stage: 400, tl: 370 });
  fitter.fit();
  assert.equal(els.status.dataset.compact, 'false', '360 <= 400 - 24, whatever the top-left bar takes');
  w.stage = 359;
  fitter.fit();
  assert.equal(els.status.dataset.compact, 'true', '360 > 335');
});

test('folded with no chip to show (the badge alone): no "!"', () => {
  const { els, fitter } = boot({ stage: 620 });
  els.chip.hidden = true;
  fitter.fit();
  assert.equal(els.status.dataset.compact, 'true');
  assert.equal(els.more.hidden, true, 'nothing is wrong: nothing to open');
});

test('the "!" opens a menu: what the canvas holds as its heading, the problem as its item; picking it is the chip\'s own click', () => {
  const { doc, els, clicks, fitter } = boot({ stage: 620 });
  fitter.fit();
  els.more.click();
  assert.equal(els.more.getAttribute('aria-expanded'), 'true');
  const menu = doc.querySelector('[role="menu"]');
  assert.ok(menu, 'a menu');
  assert.equal(menu.getAttribute('aria-label'), 'Status');
  assert.deepEqual([...menu.querySelectorAll('.menu-h')].map((h) => h.textContent), ['Not saved']);
  const items = [...menu.querySelectorAll('[role="menuitem"]')];
  assert.deepEqual(items.map((b) => b.textContent), ['3 ports to wire']);
  assert.equal(items[0].title, 'Show the first one');
  items[0].click();
  assert.deepEqual(clicks, ['chip']);
  assert.equal(doc.querySelector('[role="menu"]'), null, 'a pick closes it');
  els.badge.hidden = true;
  els.more.click();
  assert.equal(doc.querySelector('[role="menu"] .menu-h'), null, 'no heading without a badge');
});

test('the chip changes while folded: the "!" follows its tone, its words and whether it shows; an open menu closes when it goes', async () => {
  const { doc, els, fitter } = boot({ stage: 620 });
  fitter.fit();
  els.chip.classList.remove('is-incomplete');           // real errors: the chip's own red
  els.chip.textContent = '2 errors';
  await tick();
  assert.equal(els.more.classList.contains('is-incomplete'), false);
  assert.equal(els.more.getAttribute('aria-label'), '2 errors. Show details');
  els.chip.classList.add('is-warning');
  els.chip.textContent = '1 warning';
  await tick();
  assert.ok(els.more.classList.contains('is-warning'));
  els.more.click();
  assert.ok(doc.querySelector('[role="menu"]'));
  els.chip.hidden = true;                               // the graph is clean
  await tick();
  assert.equal(els.more.hidden, true);
  assert.equal(doc.querySelector('[role="menu"]'), null);
});

test('it re-fits on a window resize and on a size change of the stage or either group', () => {
  const dom = new JSDOM(HTML, { url: 'http://localhost/', pretendToBeVisual: true });
  live.push(dom);
  const seen = [];
  dom.window.ResizeObserver = class { constructor(fn) { this.fn = fn; seen.push(this); this.targets = []; } observe(el) { this.targets.push(el); } disconnect() { this.targets = null; } };
  const doc = dom.window.document;
  const g = (id) => doc.getElementById(id);
  const els = { stage: g('wfv-stage'), tl: doc.querySelector('.wfv-tl'), tr: doc.querySelector('.wfv-tr'), status: g('wfv-status'), more: g('wfv-status-more'), badge: g('wfv-doc'), chip: g('wfv-errors') };
  let stage = 620;
  Object.defineProperty(els.stage, 'clientWidth', { configurable: true, get: () => stage });
  Object.defineProperty(els.tl, 'offsetWidth', { configurable: true, get: () => 328 });
  Object.defineProperty(els.tr, 'offsetWidth', { configurable: true, get: () => (els.status.dataset.compact === 'true' ? 200 : 360) });
  const fitter = createTopFit({ doc, els });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].targets, [els.stage, els.tl, els.tr]);
  seen[0].fn();
  assert.equal(els.status.dataset.compact, 'true');
  stage = 900;
  dom.window.dispatchEvent(new dom.window.Event('resize'));
  assert.equal(els.status.dataset.compact, 'false');
  fitter.destroy();
  assert.equal(seen[0].targets, null, 'the observer is disconnected');
  stage = 620;
  dom.window.dispatchEvent(new dom.window.Event('resize'));
  assert.equal(els.status.dataset.compact, 'false', 'destroyed: it listens no more');
});

test('destroy puts the bar back as the page drew it; a view that is not laid out, or a missing element, changes nothing', () => {
  const { els, w, fitter } = boot({ stage: 620 });
  fitter.fit();
  fitter.destroy();
  assert.equal(els.status.dataset.compact, 'false');
  assert.equal(els.more.hidden, true);
  assert.equal(els.stage.style.getPropertyValue('--wfv-tr-w'), '');
  const b = boot({ stage: 0 });                         // display:none: clientWidth 0
  b.fitter.fit();
  assert.equal(b.els.status.dataset.compact, 'false');
  assert.equal(b.els.stage.style.getPropertyValue('--wfv-tr-w'), '');
  const none = createTopFit({ doc: b.doc, els: { stage: b.els.stage } });
  assert.doesNotThrow(() => { none.fit(); none.destroy(); });
  w.stage = 100;
});
