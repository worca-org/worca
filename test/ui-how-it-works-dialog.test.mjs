// test/ui-how-it-works-dialog.test.mjs — the shared "How it works" dialog shell (openGuideDialog)
// in a bare jsdom: navigation, the last screen's buttons, every close reason, teardown order,
// the backdrop grace window, key isolation and focus return.
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { useDomRelease } from './helpers/jsdom-release.mjs';
import { openGuideDialog, BACKDROP_GRACE_MS } from '../ui/public/how-it-works/guide-dialog.mjs';
import { createHowItWorks } from '../ui/public/how-it-works/how-it-works.mjs';
import { howtoButtonHtml, paintHowtoMark } from '../ui/public/how-it-works/howto-button.mjs';
import { guideFor } from '../ui/public/how-it-works/area-guides.mjs';

const trackDom = useDomRelease(afterEach);
const STEPS = Object.freeze([
  Object.freeze({ id: 'one', title: 'First', paras: Object.freeze(['Alpha.']) }),
  Object.freeze({ id: 'two', title: 'Second', paras: Object.freeze(['Beta.']) }),
  Object.freeze({ id: 'three', title: 'Third', paras: Object.freeze(['Gamma.']) }),
]);
const MODAL_ID = 'test-guide-modal';
const click = (win, node) => node.dispatchEvent(new win.Event('click', { bubbles: true, cancelable: true }));
const key = (win, node, k, extra = {}) => node.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));

function open(opts = {}) {
  const dom = trackDom(new JSDOM('<!doctype html><body><button id="opener">Open</button></body>', { url: 'http://localhost/', pretendToBeVisual: true }));
  const { window } = dom;
  const doc = window.document;
  const opener = doc.getElementById('opener');
  opener.focus();
  const closes = [];
  const h = openGuideDialog({ doc, id: MODAL_ID, steps: STEPS, onClose: (how) => closes.push(how), ...opts });
  const q = (sel) => doc.querySelector(`#${MODAL_ID} ${sel}`);
  const labels = () => [...doc.querySelectorAll(`#${MODAL_ID} .wg-actions button`)].map((b) => b.textContent);
  return { window, doc, opener, h, closes, q, labels };
}
const toLast = (c) => c.h.goTo(STEPS.length - 1);

describe('openGuideDialog shell', () => {
  test('steps forward and back; Back is disabled on the first screen; N of M and dots follow', () => {
    const { window, q, h } = open();
    assert.equal(q('.wg-step-of').textContent, '1 of 3');
    assert.equal(q('.wg-back').disabled, true);
    assert.equal(q('.wg-title').textContent, 'First');
    assert.equal(q('.wg-close').getAttribute('aria-label'), 'Close');
    assert.ok(q('.wg-close svg'), 'the × is an inline SVG');
    click(window, q('.wg-next'));
    assert.equal(q('.wg-step-of').textContent, '2 of 3');
    assert.equal(q('.wg-back').disabled, false);
    assert.equal(q('.wg-title').textContent, 'Second');
    assert.deepEqual([...q('.wg-dots').children].map((d) => d.dataset.state), ['done', 'current', 'todo']);
    click(window, q('.wg-back'));
    assert.equal(h.index(), 0);
    key(window, q('.wg-next'), 'ArrowRight');
    assert.equal(h.index(), 1);
    key(window, q('.wg-next'), 'ArrowLeft');
    assert.equal(h.index(), 0);
  });

  test('last screen without a tour: only Done (primary), no tour button', () => {
    const c = open();
    toLast(c);
    assert.deepEqual(c.labels(), ['Skip', 'Back', 'Done']);
    assert.ok(c.q('.wg-next').classList.contains('btn-primary'));
  });

  test('last screen with a tour: Back, Done (secondary), then the tour button (primary)', () => {
    const c = open({ tour: { label: 'Show me in the product' } });
    assert.deepEqual(c.labels(), ['Skip', 'Back', 'Next'], 'no tour button before the last screen');
    toLast(c);
    assert.deepEqual(c.labels(), ['Skip', 'Back', 'Done', 'Show me in the product']);
    assert.ok(!c.q('.wg-next').classList.contains('btn-primary'));
    assert.ok(c.q('.wg-tour').classList.contains('btn-primary'));
    click(c.window, c.q('.wg-tour'));
    assert.deepEqual(c.closes, ['tour']);
  });

  test("tourPlacement 'secondary' keeps finishLabel primary and puts the tour button before it", () => {
    const c = open({ tour: { label: 'Show me' }, tourPlacement: 'secondary', finishLabel: 'Create workspace' });
    toLast(c);
    assert.deepEqual(c.labels(), ['Skip', 'Back', 'Show me', 'Create workspace']);
    assert.ok(c.q('.wg-next').classList.contains('btn-primary'));
    assert.ok(!c.q('.wg-tour').classList.contains('btn-primary'));
    click(c.window, c.q('.wg-next'));
    assert.deepEqual(c.closes, ['finish']);
  });

  test('each onClose reason fires exactly once', () => {
    const fin = open();
    toLast(fin);
    click(fin.window, fin.q('.wg-next'));
    fin.h.close('skip');
    assert.deepEqual(fin.closes, ['finish']);
    const skip = open();
    click(skip.window, skip.q('.wg-skip'));
    assert.deepEqual(skip.closes, ['skip']);
    const x = open();
    click(x.window, x.q('.wg-close'));
    x.h.close();
    assert.deepEqual(x.closes, ['close']);
  });

  test('the modal is gone and focus is home before onClose runs', () => {
    const seen = [];
    const dom = trackDom(new JSDOM('<!doctype html><body><button id="opener">Open</button></body>', { url: 'http://localhost/', pretendToBeVisual: true }));
    const doc = dom.window.document;
    const opener = doc.getElementById('opener');
    opener.focus();
    const h = openGuideDialog({ doc, id: MODAL_ID, steps: STEPS, onClose: () => seen.push({ modal: doc.getElementById(MODAL_ID), active: doc.activeElement }) });
    h.close('skip');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].modal, null);
    assert.equal(seen[0].active, opener);
  });

  test('backdrop click is ignored inside the grace window and honoured after it', async () => {
    assert.equal(BACKDROP_GRACE_MS, 450);
    const c = open();
    const modal = c.doc.getElementById(MODAL_ID);
    modal.dispatchEvent(new c.window.MouseEvent('mousedown', { bubbles: true }));
    click(c.window, modal);
    assert.deepEqual(c.closes, []);
    assert.ok(c.doc.getElementById(MODAL_ID));
    await new Promise((r) => setTimeout(r, BACKDROP_GRACE_MS + 50));
    modal.dispatchEvent(new c.window.MouseEvent('mousedown', { bubbles: true }));
    click(c.window, modal);
    assert.deepEqual(c.closes, ['close']);
  });

  test('Escape closes', () => {
    const c = open();
    key(c.window, c.q('.wg-next'), 'Escape');
    assert.deepEqual(c.closes, ['close']);
    assert.equal(c.doc.getElementById(MODAL_ID), null);
  });

  test('keys typed inside the modal never reach a document-level handler', () => {
    const c = open();
    const reached = [];
    c.doc.addEventListener('keydown', (e) => reached.push(e.key));
    key(c.window, c.q('.wg-next'), 'ArrowRight');
    key(c.window, c.q('.wg-next'), 'Delete');
    key(c.window, c.q('.wg-next'), 'a');
    key(c.window, c.q('.wg-next'), 'Escape');
    assert.deepEqual(reached, []);
    key(c.window, c.opener, 'Delete');
    assert.deepEqual(reached, ['Delete'], 'a key outside the modal still reaches the document');
  });

  test('Tab wraps inside the dialog', () => {
    const c = open();
    const buttons = [...c.doc.querySelectorAll(`#${MODAL_ID} button:not([disabled])`)];
    const last = buttons.at(-1);
    last.focus();
    key(c.window, last, 'Tab');
    assert.equal(c.doc.activeElement, buttons[0]);
    key(c.window, buttons[0], 'Tab', { shiftKey: true });
    assert.equal(c.doc.activeElement, last);
  });

  test('focus returns to the opener on close; dataset and buildArt are applied', () => {
    const c = open({ dataset: { mode: 'x' }, buildArt: (doc, art) => (art ? [Object.assign(doc.createElement('i'), { className: 'art-probe', textContent: art })] : []) });
    assert.equal(c.doc.getElementById(MODAL_ID).dataset.mode, 'x');
    c.h.close('skip');
    assert.equal(c.doc.activeElement, c.opener);
    const withArt = open({ steps: [{ id: 'a', title: 'A', paras: ['p'], art: 'pic' }], buildArt: (doc, art) => [Object.assign(doc.createElement('i'), { className: 'art-probe', textContent: art })] });
    assert.equal(withArt.q('.art-probe').textContent, 'pic');
  });
});

const BAR_HTML = '<header id="topnav"><h1 id="topnav-title">Chat</h1><div class="topnav-r"><button id="topnav-ask">Ask</button></div></header>'
  + '<div class="runs-head"><span class="howto-slot" data-howto-slot="runs"></span></div>'
  + '<div class="chats-head"><span class="howto-slot" data-howto-slot="chat"></span></div>'
  + '<div class="mdl-head"><span class="howto-slot" data-howto-slot="models" data-howto-size="md"></span></div>'
  + '<div class="odd-head"><span class="howto-slot" data-howto-slot="profile"></span></div>'
  + '<button id="wfv-lib-toggle">Open</button><div id="wfv-br"><div class="wfv-bar"><button id="wfv-zoom">100%</button></div><div class="wfv-bar wfv-howto-bar" id="wfv-howto-slot"></div></div>'
  + '<button id="ws-howto-btn" type="button">How workspaces work</button>';

function boot({ status = { guidesSeen: {} }, postResult = {} } = {}) {
  const dom = trackDom(new JSDOM(`<!doctype html><body>${BAR_HTML}</body>`, { url: 'http://localhost/', pretendToBeVisual: true }));
  const { window } = dom;
  const doc = window.document;
  const state = { status, posts: [], tours: [], logs: [], sets: 0 };
  const hiw = createHowItWorks({
    doc,
    getStatus: () => state.status,
    setStatus: (next) => { state.status = next; state.sets += 1; },
    postPrefs: async (patch) => { state.posts.push(patch); if (postResult instanceof Error) throw postResult; return postResult; },
    startTour: (id) => state.tours.push({ id, modalOpen: !!doc.getElementById('how-it-works-modal') }),
    log: (...a) => state.logs.push(a),
  });
  hiw.mount();
  // The page's own button: the one its slot was given (the Chats list's follows the route, so it is found by slot).
  const page = (area) => doc.querySelector(`[data-howto-slot="${area}"] > .page-howto`);
  return { window, doc, state, hiw, page, wf: doc.getElementById('wfv-howto-btn'), ws: doc.getElementById('ws-howto-btn'), modal: () => doc.getElementById('how-it-works-modal') };
}

describe('howto button', () => {
  test('the page form is a quiet icon button named for its page, with the New mark (said in the accessible name) and no level gate', () => {
    const dom = trackDom(new JSDOM('<!doctype html><body></body>'));
    const doc = dom.window.document;
    doc.body.innerHTML = howtoButtonHtml({ cls: 'page-howto', area: 'runs', label: 'How Runs works', size: 'sm' });
    const b = doc.querySelector('button');
    assert.deepEqual([...b.classList], ['btn', 'btn-quiet', 'btn-icon', 'btn-sm', 'page-howto']);
    assert.equal(b.type, 'button');
    assert.equal(b.hasAttribute('id'), false, 'a page button has no id: Settings holds one per section');
    assert.equal(b.hasAttribute('data-min-level'), false, 'inside a page, shown at every level means no attribute (Marketplace: nothing on the page is gated)');
    assert.equal(b.dataset.howtoArea, 'runs');
    assert.equal(b.textContent, '', 'no words');
    assert.equal(b.querySelector('svg').getAttribute('width'), '16');
    assert.equal(b.querySelector('svg').getAttribute('height'), '16');
    assert.equal(b.title, 'How Runs works');
    assert.equal(b.getAttribute('aria-label'), 'How Runs works');
    assert.equal(b.querySelector('.howto-label'), null);
    assert.equal(b.querySelector('.howto-new').hidden, true);
    // No text in the dot: it would count as a word of the label and as text on the dot's slate.
    assert.equal(b.querySelector('.howto-new').textContent, '');
    assert.equal(b.querySelector('.howto-new').getAttribute('aria-hidden'), 'true');
    paintHowtoMark(b, true);
    assert.equal(b.dataset.new, 'true');
    assert.equal(b.querySelector('.howto-new').hidden, false);
    assert.equal(b.getAttribute('aria-label'), 'How Runs works, new');
    paintHowtoMark(b, false);
    assert.equal(b.dataset.new, 'false');
    assert.equal(b.querySelector('.howto-new').hidden, true);
    assert.equal(b.getAttribute('aria-label'), 'How Runs works');
    // 32px, for a row whose buttons are 32px: no btn-sm.
    doc.body.innerHTML = howtoButtonHtml({ cls: 'page-howto', area: 'models', label: 'How Models works' });
    assert.deepEqual([...doc.querySelector('button').classList], ['btn', 'btn-quiet', 'btn-icon', 'page-howto']);
  });

  test('without an area it is the Workflows editor\'s button, as before', () => {
    const dom = trackDom(new JSDOM('<!doctype html><body></body>'));
    const doc = dom.window.document;
    doc.body.innerHTML = howtoButtonHtml({ id: 'i-btn', cls: 'wfv-howto' });
    const i = doc.getElementById('i-btn');
    assert.deepEqual([...i.classList], ['btn', 'btn-quiet', 'btn-icon', 'wfv-howto']);
    assert.equal(i.dataset.minLevel, 'simple');
    assert.equal(i.title, 'How this area works');
    assert.equal(i.getAttribute('aria-label'), 'How it works');
    assert.equal(i.querySelector('svg').getAttribute('width'), '14');
    assert.equal(i.hasAttribute('data-howto-area'), false);
    assert.equal(i.textContent, '');
    paintHowtoMark(i, true);
    assert.equal(i.getAttribute('aria-label'), 'How it works, new');
    assert.doesNotThrow(() => paintHowtoMark(null, true));
  });
});

describe('How it works controller', () => {
  test('mount leaves the top bar alone, puts one button in each page slot and the Workflows one in its bar; twice is the same', () => {
    const c = boot();
    c.hiw.mount();
    assert.deepEqual([...c.doc.querySelector('.topnav-r').children].map((e) => e.id), ['topnav-ask'], 'nothing in the top bar');
    assert.equal(c.doc.getElementById('howto-btn'), null);
    for (const area of ['runs', 'chat', 'models']) {
      const slot = c.doc.querySelector(`[data-howto-slot="${area}"]`);
      assert.equal(slot.children.length, 1, `${area}: one button, also after a second mount`);
      assert.equal(slot.firstElementChild.dataset.howtoArea, area);
    }
    assert.equal(c.page('runs').classList.contains('btn-sm'), true, '28px by default');
    assert.equal(c.page('models').classList.contains('btn-sm'), false, 'data-howto-size="md" is the 32px button');
    assert.equal(c.page('runs').title, 'How Runs works');
    assert.equal(c.page('models').getAttribute('aria-label'), 'How Models works, new');
    assert.equal(c.doc.querySelector('[data-howto-slot="profile"]').children.length, 0, 'an area without a guide gets no button');
    assert.equal(c.doc.querySelectorAll('#wfv-howto-btn').length, 1);
    assert.deepEqual([...c.doc.getElementById('wfv-howto-slot').children].map((e) => e.id), ['wfv-howto-btn']);
    assert.notEqual(c.doc.getElementById('wfv-lib-toggle').previousElementSibling.id, 'wfv-howto-btn', 'no longer beside the Library toggle');
  });

  test('button(area) hands out a wired, painted button; null for an area without a guide', () => {
    const c = boot({ status: { guidesSeen: { stats: true } } });
    assert.equal(c.hiw.button('profile'), null);
    const b = c.hiw.button('connectors', { size: 'md' });
    assert.deepEqual([...b.classList], ['btn', 'btn-quiet', 'btn-icon', 'page-howto']);
    assert.equal(b.title, 'How Connectors works');
    assert.equal(b.dataset.new, 'true', 'painted when made');
    assert.equal(c.hiw.button('stats').dataset.new, 'false');
    assert.equal(c.hiw.button('stats').classList.contains('btn-sm'), true, '28px unless asked');
    assert.notEqual(c.hiw.button('connectors'), b, 'a new button each call');
    c.doc.body.append(b);
    click(c.window, b);
    assert.equal(c.modal().dataset.area, 'connectors');
    assert.equal(b.dataset.new, 'false');
  });

  test('a slot that appears after mount is filled by the next route sync, once', () => {
    const c = boot();
    const late = c.doc.createElement('span');
    late.dataset.howtoSlot = 'stats';
    c.doc.body.append(late);
    c.hiw.syncRoute('stats');
    assert.equal(late.children.length, 1);
    assert.equal(late.firstElementChild.title, 'How Statistics works');
    c.hiw.syncRoute('runs');
    assert.equal(late.children.length, 1);
  });

  test('paintMarks: each page button carries its own area\'s mark, whatever the route; unknown prefs show none (also on #ws-howto-btn)', () => {
    const c = boot({ status: { guidesSeen: { chat: true } } });
    c.hiw.syncRoute('runs');
    assert.equal(c.page('chat').dataset.new, 'false');
    assert.equal(c.page('runs').dataset.new, 'true');
    assert.equal(c.page('runs').querySelector('.howto-new').hidden, false);
    assert.equal(c.page('runs').getAttribute('aria-label'), 'How Runs works, new');
    assert.equal(c.ws.dataset.new, 'true');
    assert.equal(c.wf.dataset.new, 'true');
    c.state.status = { guidesSeen: {}, workspaceGuideSeen: true };
    c.hiw.paintMarks();
    assert.equal(c.ws.dataset.new, 'false');
    assert.equal(c.page('chat').dataset.new, 'true');
    c.state.status = null;
    c.hiw.paintMarks();
    for (const b of [c.page('runs'), c.page('chat'), c.page('models'), c.wf, c.ws]) assert.equal(b.dataset.new, 'false');
  });

  test('open shows the explainer, posts guidesSeen once, marks the area seen at once and ignores a second open', async () => {
    const c = boot();
    c.hiw.syncRoute('chat');
    const before = c.state.status;
    c.hiw.open('chat');
    c.hiw.open('chat');
    assert.equal(c.doc.querySelectorAll('#how-it-works-modal').length, 1);
    assert.equal(c.modal().dataset.area, 'chat');
    assert.equal(c.modal().querySelector('.wg-title').textContent, guideFor('chat').steps[0].title);
    assert.deepEqual(c.state.posts, [{ guidesSeen: { chat: true } }]);
    assert.deepEqual(before, { guidesSeen: {} }, 'the status it was given is not mutated');
    assert.equal(c.state.status.guidesSeen.chat, true);
    assert.equal(c.page('chat').dataset.new, 'false', 'mark gone on open, not on close');
  });

  test('markSeen sends exactly the legacy flag for workspaces and the map for other areas', async () => {
    const c = boot();
    await c.hiw.markSeen('workspaces');
    await c.hiw.markSeen('runs');
    assert.deepEqual(c.state.posts, [{ workspaceGuideSeen: true }, { guidesSeen: { runs: true } }]);
    assert.equal(c.state.status.workspaceGuideSeen, true);
    assert.equal(c.state.status.guidesSeen.runs, true);
  });

  test("'tour' starts the guide's tour only after the modal is gone; other closes start none", () => {
    const c = boot();
    c.hiw.syncRoute('chat');
    c.hiw.open('chat');
    const q = (sel) => c.doc.querySelector(`#how-it-works-modal ${sel}`);
    c.doc.querySelector('#how-it-works-modal .wg-next').focus();
    const steps = guideFor('chat').steps.length;
    for (let i = 1; i < steps; i += 1) click(c.window, q('.wg-next'));
    assert.equal(q('.wg-tour').textContent, 'Show me in the product');
    click(c.window, q('.wg-tour'));
    assert.deepEqual(c.state.tours, [{ id: guideFor('chat').tour, modalOpen: false }]);
    c.hiw.open('chat');
    key(c.window, q('.wg-next'), 'Escape');
    assert.equal(c.state.tours.length, 1);
    c.hiw.open('design');
    assert.equal(q('.wg-tour'), null, 'a guide without a tour never shows the button');
  });

  test('syncRoute: the Workflows button shows on workflows only; a page button is never hidden by the route', () => {
    const c = boot();
    for (const r of ['runs', 'running', 'history', 'new', 'chat', 'workspaces', 'workspace-create', 'getting-started', 'profile']) {
      c.hiw.syncRoute(r);
      assert.equal(c.wf.hidden, true, r);
      assert.equal(c.page('runs').hidden, false, r);
    }
    c.hiw.syncRoute('workflows');
    assert.equal(c.wf.hidden, false);
    assert.equal(c.page('runs').hidden, false);
  });

  test('a click opens the button\'s own area, whatever the route; the Workflows one opens the route\'s', () => {
    const c = boot();
    c.hiw.syncRoute('chat');
    click(c.window, c.page('runs'));
    assert.equal(c.modal().dataset.area, 'runs');
    c.hiw.syncRoute('workflows');
    assert.equal(c.modal(), null, 'the route change closed the first explainer');
    click(c.window, c.wf);
    assert.equal(c.modal().dataset.area, 'workflows');
  });

  test('the Chats list button follows Chat and Design: its name, its mark and its guide are the route\'s', () => {
    const c = boot();
    const b = c.page('chat');
    c.hiw.syncRoute('design');
    assert.equal(b.dataset.howtoArea, 'design');
    assert.equal(b.title, 'How Design works');
    assert.equal(b.getAttribute('aria-label'), 'How Design works, new');
    click(c.window, b);
    assert.equal(c.modal().dataset.area, 'design');
    assert.equal(b.dataset.new, 'false');
    c.hiw.syncRoute('stats');
    assert.equal(b.dataset.howtoArea, 'design', 'another page leaves it as it was');
    c.hiw.syncRoute('chat');
    assert.equal(b.dataset.howtoArea, 'chat');
    assert.equal(b.title, 'How Chat works');
    assert.equal(b.dataset.new, 'true', 'Chat is still new');
    assert.equal(b.getAttribute('aria-label'), 'How Chat works, new');
    c.hiw.syncRoute('design');
    assert.equal(b.dataset.new, 'false', 'Design was opened');
    assert.equal(c.page('runs').title, 'How Runs works', 'the other buttons keep their page');
    assert.equal(c.page('models').dataset.howtoArea, 'models');
  });

  test('a route change closes an open explainer; the same route does not', () => {
    const c = boot();
    c.hiw.syncRoute('chat');
    c.hiw.open('chat');
    c.hiw.syncRoute('chat');
    assert.ok(c.modal());
    c.hiw.syncRoute('runs');
    assert.equal(c.modal(), null);
    assert.deepEqual(c.state.tours, []);
  });

  for (const [name, fail] of [['resolves null', null], ['throws', new Error('boom')]]) {
    test(`a failed post (${name}) keeps the optimistic state, logs, and never surfaces`, async () => {
      const c = boot({ postResult: fail });
      c.hiw.syncRoute('chat');
      assert.doesNotThrow(() => c.hiw.open('chat'));
      await new Promise((r) => setTimeout(r, 0));
      assert.equal(c.page('chat').dataset.new, 'false');
      assert.equal(c.state.logs.length, 1);
      assert.ok(c.modal());
      assert.equal(c.doc.querySelector('.toast, .rc-toast'), null);
    });
  }

  test('sample art renders as a captioned figure; open ignores an unknown area', () => {
    const c = boot();
    c.hiw.open('runs');
    c.modal().querySelector('.wg-next');
    const list = guideFor('runs').steps.findIndex((s) => s.art);
    for (let i = 0; i < list; i += 1) click(c.window, c.modal().querySelector('.wg-next'));
    assert.equal(c.modal().querySelectorAll('.wg-art li').length, guideFor('runs').steps[list].art.items.length);
    assert.equal(c.modal().querySelector('.wg-art .wg-caption').textContent, 'Made-up examples, not yours.');
    c.modal().querySelector('.wg-close').click();
    c.hiw.open('profile');
    assert.equal(c.modal(), null);
    assert.equal(c.state.posts.length, 1);
  });
});
