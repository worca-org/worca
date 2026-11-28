// test/ui-how-it-works-app.test.mjs — the "How it works" explainers in the real app.js boot: the
// button per route, nothing opens by itself, one quiet POST on open, the mark, Show me, the level
// confirm, Settings reset and the Workspaces hookup.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { useDomRelease } from './helpers/jsdom-release.mjs';
import { confirmDialog, cancelDialog } from './helpers/confirm-modal.mjs';
import { bootApp, settle, click, WS_ONE } from './helpers/onboarding-app-boot.mjs';
import { AREA_GUIDES } from '../ui/public/how-it-works/area-guides.mjs';
import { pageTitle } from '../ui/public/topnav.mjs';

const trackDom = useDomRelease(afterEach);
const boot = (opts = {}) => bootApp({ trackDom, flags: ['design', 'requirements'], ...opts });

// The route each area's button is shown on. Runs owns four list routes; the rest are their own.
const ROUTE_OF = { runs: 'history' };
const hashOf = (area) => ROUTE_OF[area] || area;
const AREAS = Object.keys(AREA_GUIDES);
const modal = (doc) => doc.getElementById('how-it-works-modal');
// The How it works buttons a person can see now: each page's own (Workspaces' included) and the Workflows editor's,
// not hidden themselves and inside nothing hidden: another view, another Settings section, or the folded Chats list
// (jsdom reads no stylesheet, so chat-shell.css's `[data-history="closed"] .chat-history{display:none}` is said here).
const shownHowto = (doc) => [...doc.querySelectorAll('.page-howto, #wfv-howto-btn')]
  .filter((b) => !b.hidden && !b.closest('.hidden, [hidden], .chat-page[data-history="closed"] .chat-history'));
// The explainer's own Done button, whichever step it is on.
const finishGuide = (win, doc) => { const next = () => modal(doc).querySelector('.wg-next'); while (next().textContent !== 'Done') click(win, next()); click(win, next()); };

test('every area shows one How it works button, on its own page and never in the top bar; nothing opens by itself (R-po-1, R-po-5, I-1)', async () => {
  const { doc, show } = await boot();
  assert.equal(doc.getElementById('howto-btn'), null, 'the top-bar button is gone');
  for (const area of AREAS) {
    await show(hashOf(area));
    assert.equal(modal(doc), null, `${area}: no modal on a first visit`);
    assert.equal(doc.querySelector('.topnav .page-howto, .topnav [data-howto-slot], .topnav [id*="howto"]'), null, `${area}: nothing in the top bar`);
    const shown = shownHowto(doc);
    assert.equal(shown.length, 1, `${area}: exactly one button`);
    const [btn] = shown;
    assert.equal(btn.textContent.trim(), '', `${area}: an icon, no words`);
    assert.equal(btn.dataset.new, 'true', `${area}: new until opened`);
    if (area === 'workspaces') {
      assert.equal(btn.id, 'ws-howto-btn', 'Workspaces keeps its own button');
      assert.equal(btn.getAttribute('aria-label'), 'How workspaces work, new');
    } else if (area === 'workflows') {
      assert.equal(btn.id, 'wfv-howto-btn', 'Workflows shows its own button');
      assert.equal(btn.parentElement.id, 'wfv-howto-slot', 'bottom right, in its bar');
      assert.equal(doc.getElementById('wfv-howto-slot').previousElementSibling.querySelector('button').id, 'wfv-zoom', 'after the zoom menu');
    } else {
      assert.equal(btn.dataset.howtoArea, area, `${area}: the page's own guide`);
      assert.equal(btn.title, `How ${pageTitle(area)} works`, `${area}: the tooltip names the page`);
      assert.equal(btn.getAttribute('aria-label'), `How ${pageTitle(area)} works, new`);
    }
  }
  await show('getting-started');
  assert.deepEqual(shownHowto(doc), [], 'a page without an explainer has no button');
});

test('Settings shows one How it works button on each section, at its line\'s end; in Simple mode too (R-po-1)', async () => {
  const { doc, show } = await boot({ flags: ['design', 'requirements', 'gitAutomations'] });   // Automations is behind its flag
  const pane = () => doc.querySelector('[data-view="settings"] .settings-pane:not(.hidden)');
  const reached = [];
  for (const tab of ['general', 'tags', 'presets', 'automations', 'runs', 'experimental', 'ask', 'guardrails', 'memory']) {
    await show(tab === 'general' ? 'settings' : `settings/${tab}`);
    reached.push(pane().dataset.tab);
    const shown = shownHowto(doc);
    assert.equal(shown.length, 1, `${tab}: exactly one button`);
    assert.equal(shown[0].closest('.settings-pane'), pane(), `${tab}: the shown section's own`);
    assert.equal(shown[0].dataset.howtoArea, 'settings');
    assert.equal(shown[0].title, 'How Settings works');
  }
  assert.deepEqual(reached, ['general', 'tags', 'presets', 'automations', 'runs', 'experimental', 'ask', 'guardrails', 'memory'], 'every section was really shown');
  const simple = await boot({ level: 'simple' });
  for (const hash of ['settings', 'settings/experimental', 'settings/guardrails']) {
    await simple.show(hash);
    assert.equal(shownHowto(simple.doc).length, 1, `Simple, ${hash}: exactly one button`);
  }
});

test('click opens that area\'s explainer; the steps and every close path work (R-po-2, R-po-7)', async () => {
  const { window, doc, show } = await boot();
  for (const area of ['chat', 'schedules', 'models', 'requirements']) {
    await show(area);
    click(window, shownHowto(doc)[0]);
    assert.equal(modal(doc).dataset.area, area);
    assert.equal(modal(doc).querySelector('.wg-step-of').textContent, `1 of ${AREA_GUIDES[area].steps.length}`);
    click(window, modal(doc).querySelector('.wg-next'));
    assert.equal(modal(doc).querySelector('.wg-step-of').textContent, `2 of ${AREA_GUIDES[area].steps.length}`);
    click(window, modal(doc).querySelector('.wg-back'));
    click(window, modal(doc).querySelector('.wg-close'));
    assert.equal(modal(doc), null, `${area}: × closes`);
  }
  await show('stats');
  click(window, shownHowto(doc)[0]);
  click(window, modal(doc).querySelector('.wg-skip'));
  assert.equal(modal(doc), null, 'Skip closes on the first screen');
});

test('Chat keeps exactly one button whether its list shows or is folded: the list\'s, else the chat head\'s', async () => {
  const { window, doc, show } = await boot();
  await show('chat');
  const page = doc.querySelector('.chat-page');
  const where = () => shownHowto(doc).map((b) => (b.closest('.chat-history') ? 'list' : b.closest('.chat-head') ? 'head' : 'elsewhere'));
  const want = () => [page.dataset.history === 'open' ? 'list' : 'head'];
  assert.deepEqual(where(), want());
  click(window, doc.querySelector('.chat-history-toggle'));
  assert.deepEqual(where(), want(), 'after a toggle');
  click(window, doc.querySelector('.chat-history-toggle'));
  assert.deepEqual(where(), want(), 'and back');
  await show('chat/new/design');
  assert.deepEqual(shownHowto(doc).map((b) => b.title), ['How Design works'], 'both follow the route');
  assert.deepEqual([...doc.querySelectorAll('.chat-page .page-howto')].map((b) => b.dataset.howtoArea), ['design', 'design']);
});

test('the design start opens the Design guide, not the Chat one', async () => {
  const { window, doc, show } = await boot();
  await show('chat/new/design');
  click(window, shownHowto(doc)[0]);
  assert.equal(modal(doc).dataset.area, 'design');
});

test('a design chat reloaded on its address is Design once its design shows: the button says so and opens the Design guide; when the design goes it is Chat again', async () => {
  const TID = 'ask_00000001';
  const DID = 'd_0000000000a1';
  // The chats list has no row for it yet (this stub lists none), so the route paints Chat and Design comes only once the
  // chat loads and its design mounts. A boot on the address routes once (show() would route twice: its own event and
  // the address's, the second after the design mounted).
  const answer = (url, opts = {}) => {
    if ((opts.method || 'GET') !== 'GET') return null;
    if (url === `/api/ask/threads/${TID}`) return { thread: { id: TID, mode: 'design', title: 'Landing page', designId: DID }, messages: [], attachments: [], runLinks: [], inFlight: null };
    if (url === `/api/design/${DID}`) return { design: { id: DID, kind: 'web', title: 'Landing page', version: 0, threadId: TID }, plan: null, sections: [], versions: [], build: null };
    return null;
  };
  const { window, doc, frame } = await boot({ answer, hash: `chat/${TID}` });
  await settle();
  assert.equal(window.location.hash, `#chat/${TID}`, 'precondition: still on the design chat');
  const lit = () => [...doc.querySelectorAll('.nav button.active')].map((b) => b.dataset.nav);
  assert.deepEqual(lit(), ['design'], 'precondition: the mounted design lights Design');
  assert.equal(doc.getElementById('topnav-title').textContent, 'Design');
  assert.deepEqual(shownHowto(doc).map((b) => b.title), ['How Design works'], 'the button follows the sidebar');
  click(window, shownHowto(doc)[0]);
  assert.equal(modal(doc).dataset.area, 'design');
  click(window, modal(doc).querySelector('.wg-close'));
  // The design leaves the chat (setDesign(thread, null), as a deleted design's onDeleted calls it): Chat again.
  frame({ type: 'design-attached', threadId: TID, designId: null });
  await settle();
  assert.deepEqual(lit(), ['chat'], 'precondition: the design is gone and Chat is lit');
  assert.deepEqual(shownHowto(doc).map((b) => b.title), ['How Chat works']);
  click(window, shownHowto(doc)[0]);
  assert.equal(modal(doc).dataset.area, 'chat');
});

test('opening, stepping and closing send one quiet POST, change no route and lose no typing (I-2, R-po-9)', async () => {
  const { window, doc, show, posts, requests } = await boot();
  await show('new');
  const title = doc.getElementById('title');
  title.value = 'Fix the login bug';
  const before = requests.length;
  const hash = window.location.hash;
  click(window, shownHowto(doc)[0]);
  await settle();
  click(window, modal(doc).querySelector('.wg-next'));
  click(window, modal(doc).querySelector('.wg-close'));
  await settle();
  const sent = requests.slice(before);
  assert.deepEqual(sent.map((r) => `${r.method} ${r.url.split('?')[0]}`), ['POST /api/onboarding'], 'only the seen POST');
  assert.deepEqual(posts, [{ guidesSeen: { new: true } }]);
  assert.equal(window.location.hash, hash, 'no route change');
  assert.equal(title.value, 'Fix the login bug', 'the typed title survives');
  assert.equal(doc.getElementById('gsSettingsMsg').textContent.includes('error'), false);
  await show('workflows');
  const name = doc.getElementById('wfv-name');
  name.value = 'My flow';
  click(window, doc.getElementById('wfv-howto-btn'));
  click(window, modal(doc).querySelector('.wg-close'));
  assert.equal(name.value, 'My flow', 'a Workflows entry survives');
});

test('the mark shows until the first open; after a reload with the server\'s status it stays gone (R-po-8)', async () => {
  const first = await boot();
  await first.show('schedules');
  const mark = (ctx) => shownHowto(ctx.doc)[0].dataset.new;
  assert.equal(mark(first), 'true', 'new until opened');
  assert.equal(shownHowto(first.doc)[0].querySelector('.howto-new').hidden, false);
  click(first.window, shownHowto(first.doc)[0]);
  await settle();
  assert.equal(mark(first), 'false', 'gone as soon as it opens');
  click(first.window, modal(first.doc).querySelector('.wg-close'));
  const second = await boot({ guidesSeen: first.server.guidesSeen });
  await second.show('schedules');
  assert.equal(mark(second), 'false', 'a reload keeps it gone');
  await second.show('stats');
  assert.equal(mark(second), 'true', 'another area is still new');
});

test('Show me starts the tour after the modal is gone, even when the step is done (R-po-10)', async () => {
  // "project" is done in the stub's status (so its tour starts even when the step is done); "run" is not.
  for (const area of ['projects', 'new']) {
    const { window, doc, show } = await boot();
    await show(hashOf(area));
    click(window, shownHowto(doc)[0]);
    while (modal(doc).querySelector('.wg-next').textContent !== 'Done') click(window, modal(doc).querySelector('.wg-next'));
    const tour = modal(doc).querySelector('.wg-tour');
    assert.equal(tour?.textContent, 'Show me in the product', `${area}: the last screen offers the tour`);
    assert.equal(doc.querySelector('.guide-layer'), null, 'no tour yet');
    click(window, tour);
    assert.equal(modal(doc), null, `${area}: the modal is gone first`);
    await settle();
    const layer = doc.querySelector('.guide-layer.spotlight');
    assert.ok(layer, `${area}: the guide started with a spotlight`);
    assert.ok(layer.dataset.target, `${area}: the spotlight names its target`);
    assert.ok(doc.querySelector(layer.dataset.target), `${area}: the first-hop target exists on the page`);
  }
});

test('a tour that needs a higher mode shows the level confirm first (R-13, A-5)', async () => {
  const { window, doc, show } = await boot({ level: 'simple' });
  await show('team-policy');
  click(window, shownHowto(doc)[0]);
  while (modal(doc).querySelector('.wg-next').textContent !== 'Done') click(window, modal(doc).querySelector('.wg-next'));
  click(window, modal(doc).querySelector('.wg-tour'));
  await settle();
  assert.equal(modal(doc), null);
  const confirm = doc.getElementById('confirm-modal');
  assert.equal(confirm.classList.contains('hidden'), false, 'the confirm opens');
  assert.match(confirm.textContent, /Switch to Expert/);
  await cancelDialog(window);
});

test('Runs ends on Done and closes; every Runs route shows the same explainer (R-po-4)', async () => {
  const { window, doc, show } = await boot();
  await show('history');
  click(window, shownHowto(doc)[0]);
  const texts = [...modal(doc).querySelectorAll('.wg-title')].map((t) => t.textContent);
  finishGuide(window, doc);
  assert.equal(modal(doc), null, 'Done closes it');
  const again = await boot();
  await again.show('running');
  click(again.window, shownHowto(again.doc)[0]);
  assert.deepEqual([...modal(again.doc).querySelectorAll('.wg-title')].map((t) => t.textContent), texts);
  assert.equal(modal(again.doc).dataset.area, 'runs');
});

test('an onboarding-changed frame repaints the marks (R-po-12)', async () => {
  const ctx = await boot();
  await ctx.show('stats');
  const btn = shownHowto(ctx.doc)[0];
  assert.equal(btn.dataset.new, 'true');
  ctx.server.guidesSeen.stats = true;                  // another tab opened it
  ctx.frame({ type: 'onboarding-changed' });
  await new Promise((r) => setTimeout(r, 400));
  await settle();
  assert.equal(btn.dataset.new, 'false');
});

test('Workspaces: its button opens the shared dialog with Show me; the tour goes nowhere near the wizard (R-po-13)', async () => {
  const { window, doc, show, posts } = await boot({ seen: true, workspaces: WS_ONE });
  await show('workspaces');
  click(window, doc.getElementById('ws-howto-btn'));
  await settle();
  const m = doc.getElementById('workspace-guide-modal');
  assert.ok(m, 'the walkthrough opened');
  assert.deepEqual(posts.at(-1), { workspaceGuideSeen: true }, 'the same body as before');
  while (m.querySelector('.wg-next').textContent !== 'Done') click(window, m.querySelector('.wg-next'));
  const tour = m.querySelector('.wg-tour');
  assert.ok(tour, 'Show me is offered on the last screen');
  click(window, tour);
  await settle();
  assert.equal(doc.getElementById('workspace-guide-modal'), null);
  assert.notEqual(window.location.hash, '#workspace-create', 'the tour does not route to the wizard');
});

test('deleting the last workspace keeps the Workspaces explainer seen in the guide map (D-5)', async () => {
  const ctx = await boot({ seen: true, guidesSeen: { workspaces: true }, workspaces: WS_ONE });
  await ctx.show('workspaces/wks-alpha-00000001');
  click(ctx.window, ctx.doc.querySelector('#ws-detail .ws-delete'));
  await confirmDialog(ctx.window);
  await settle();
  assert.equal(ctx.server.guidesSeen.workspaces, true);
  assert.equal(ctx.doc.getElementById('ws-howto-btn').dataset.new, 'false', 'the mark does not return');
});

test('Settings › Getting started "Show again" resets the guides, and says so (D-7)', async () => {
  const { window, doc, posts, server } = await bootApp({ trackDom, guidesSeen: { chat: true, runs: true }, hidden: true });
  assert.match(doc.querySelector('#getting-started-card .gs-settings-text').textContent, /How it works/);
  click(window, doc.getElementById('gsShowAgain'));
  await settle();
  assert.deepEqual(posts[0], { guidesReset: true, hidden: false });
  assert.deepEqual(server.guidesSeen, {});
  assert.equal(window.location.hash, '#getting-started');
  const open = await bootApp({ trackDom, guidesSeen: { chat: true } });
  click(open.window, open.doc.getElementById('gsShowAgain'));
  await settle();
  assert.deepEqual(open.posts[0], { guidesReset: true });
});
