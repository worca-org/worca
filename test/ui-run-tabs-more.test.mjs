// test/ui-run-tabs-more.test.mjs — the run pages' tab line: every tab on it, "More" only for those it cannot hold
// (initDetailTabs opts.overflow), the tool icons at its end, across both pages, the interface levels, git and the kinds
// of run; and the plain header's CSS. The engine itself is covered by test/ui-detail-tabs.test.mjs. These boot the real
// app.js: the matrix is which tabs each page's own table, level, git and repaint paths leave on the line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bootApp, helloRun } from './helpers/run-page-boot.mjs';
import { bootDetail, openDetail, ROW, KEY, RESULTS, TABS_DETAIL, ok, click } from './helpers/history-detail-boot.mjs';
import { checkRows } from './helpers/rows.mjs';
import { applyLevel } from '../ui/public/ui-level.mjs';
import { applyGit } from '../ui/public/git-gate.mjs';
import { applyFlags } from '../ui/public/flags.mjs';
import { careRunPlan } from '../src/shared/shape/feature-record.mjs';

const RANK = { simple: 0, advanced: 1, expert: 2 };

/** One run screen's tab row, read the way the CSS draws it (jsdom applies no stylesheet). */
function page(window, prefix) {
  const doc = window.document;
  const host = prefix === 'rd' ? '#run-detail' : '#hist-detail';
  const bar = () => doc.querySelector(`${host} .${prefix}-tabs`);
  const btn = (k) => bar().querySelector(`.${prefix}-tab[data-sec="${k}"]`);
  const gated = (b) => RANK[b.dataset.minLevel || 'simple'] > RANK[doc.documentElement.dataset.level || 'expert']
    || (doc.documentElement.dataset.git === 'off' && 'needsGit' in b.dataset);
  const row = () => [...bar().querySelectorAll('[role="tab"]')]
    .filter((b) => !b.hidden && !gated(b) && (!b.hasAttribute('data-overflow') || b.classList.contains('active')))
    .map((b) => b.dataset.sec);
  const more = () => bar().querySelector('.tab-more');
  const menuEl = () => doc.querySelector('body > .wfv-menu');
  const read = () => [...menuEl().querySelectorAll('.menu-item')].map((i) => {
    const hint = i.querySelector('.wfv-menu-hint');
    return `${i.getAttribute('aria-checked') === 'true' ? '✓ ' : ''}${i.querySelector('.wfv-menu-l').textContent}${hint ? ` ${hint.textContent}` : ''}`;
  });
  /** The menu's rows (open, read, close); null without More. */
  const menu = () => {
    if (!more()) return null;
    click(window, more());
    const rows = read();
    click(window, more());
    assert.equal(menuEl(), null);
    return rows;
  };
  const item = (label) => [...menuEl().querySelectorAll('.menu-item')].find((i) => i.querySelector('.wfv-menu-l').textContent === label);
  const pick = (label) => { click(window, more()); click(window, item(label)); };
  const active = () => {
    const on = [...bar().querySelectorAll('[role="tab"][aria-selected="true"]')];
    assert.equal(on.length, 1, 'exactly one selected tab');
    assert.ok(row().includes(on[0].dataset.sec), `the selected tab ${on[0].dataset.sec} is rendered`);
    return on[0].dataset.sec;
  };
  return { window, doc, bar, btn, row, more, menu, menuEl, item, pick, active };
}

const ARTIFACT_FRAMES = [
  { type: 'artifact', kind: 'plan', path: 'plans/plan.md', nodeId: null, executionId: null, cycle: null },
  { type: 'artifact', kind: 'result', path: 'result.diff', nodeId: null, executionId: null, cycle: null },
];
const stateFrame = (over = {}) => ({ type: 'state', runId: 'r1', id: 'p1', status: 'running', steps: [], subAgents: [],
  sessionHosts: { s1: {} }, branch: { source: 'main', feature: 'worca-cc/dark-p1', worktreeDir: '/tmp/wt' }, ...over });

/** The four tool icons' width: 28px each, 2px apart. */
const ICONS = 118;

/** jsdom does no layout: a width for every run-page tab, its More button and the tool icons, a bar as wide as the test
 *  says, and a ResizeObserver and frames the test drives. All ten tabs draw 700px, 818px with the icons. */
function fakeLayout(window) {
  const widths = { overview: 80, task: 50, diff: 70, artifacts: 100, qa: 55, clarify: 55, logs: 55, actions: 70, workflow: 80, sessions: 80, agents: 60 };
  let room = 0;
  let icons = ICONS;
  const bars = (node) => node.classList.contains('rd-tabs') || node.classList.contains('hd-tabs');
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return bars(this) ? room : 0; } });
  const rect = window.Element.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    return this.classList.contains('tool-icons') ? { width: icons } : rect.call(this);
  };
  window.HTMLButtonElement.prototype.getBoundingClientRect = function () {
    return { width: this.classList.contains('tab-more') ? 60 : widths[this.dataset.sec] || 0 };
  };
  const observers = [];
  window.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.targets = []; this.live = true; observers.push(this); }
    observe(el) { this.targets.push(el); }
    unobserve() {}
    disconnect() { this.live = false; }
  };
  const frames = [];
  window.requestAnimationFrame = (fn) => frames.push(fn);
  window.cancelAnimationFrame = () => {};
  /** The bar is now `px` wide (and its icons `iconsPx`; 0 = hidden): its observer reports it, and the frame runs. */
  const resize = (bar, px, iconsPx = ICONS) => {
    room = px;
    icons = iconsPx;
    const watching = observers.filter((o) => o.live && o.targets.includes(bar));
    assert.equal(watching.length, 1, 'one live observer on the bar');
    watching[0].cb([]);
    for (const fn of frames.splice(0)) fn(0);
  };
  return { resize };
}

/** A live git run with two artifacts and one session, open on its page. */
async function openLive({ level = 'expert', route = 'running/r1', hello = {}, state = {}, git = 'on', frames = ARTIFACT_FRAMES, layout = false } = {}) {
  const ctx = await bootApp();
  const fake = layout ? fakeLayout(ctx.window) : null;
  const root = ctx.window.document.documentElement;
  root.dataset.level = level;
  if (git === 'off') root.dataset.git = 'off';
  helloRun(ctx, { runId: 'r1', pipelineId: 'p1', ...hello });
  ctx.dispatch(stateFrame(state));
  for (const a of frames) ctx.dispatch({ ...a, runId: 'r1' });
  ctx.dispatch(stateFrame(state));                        // a full repaint: the badges read the artifacts
  ctx.go(route);
  await ctx.settle(8);
  const p = page(ctx.window, 'rd');
  return { ctx, ...p, resize: (px, icons) => fake.resize(p.bar(), px, icons) };
}

const SAVED = {
  ...TABS_DETAIL,
  state: { ...TABS_DETAIL.state, sessionHosts: { s1: {} } },
  artifacts: [{ kind: 'live-log', relPath: 'live-log.ndjson' }, { kind: 'plan', relPath: 'plans/plan.md' }, { kind: 'result', relPath: 'result.diff' }],
};

/** The saved twin of openLive. */
async function openSaved({ level = 'expert', route = 'details/overview', detail = SAVED, row = ROW, git = 'on', arms = null, layout = false } = {}) {
  const ctx = await bootDetail({ detail, rows: [row], arms });
  const fake = layout ? fakeLayout(ctx.window) : null;
  const root = ctx.window.document.documentElement;
  root.dataset.level = level;
  if (git === 'off') root.dataset.git = 'off';
  await openDetail(ctx, route);
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
  const p = page(ctx.window, 'hd');
  return { ctx, ...p, resize: (px, icons) => fake.resize(p.bar(), px, icons) };
}

// Table order, as both pages draw it when nothing folds.
const LIVE_ROW = ['overview', 'task', 'diff', 'artifacts', 'actions', 'workflow', 'qa', 'logs', 'sessions', 'agents'];
const SAVED_ROW = ['overview', 'task', 'diff', 'artifacts', 'actions', 'workflow', 'clarify', 'logs', 'sessions', 'agents'];
const without = (row, ...keys) => row.filter((k) => !keys.includes(k));
/** Every shown tab is on the line, and there is no More. */
function allOnLine(p, row) {
  assert.deepEqual(p.row(), row);
  assert.equal(p.more(), null);
  assert.equal(p.bar().querySelector('[data-overflow]'), null);
}

test('the line per interface level, live and saved: every shown tab in table order, no More', async () => {
  await checkRows([
    { name: 'live, Expert', run: async () => {
      const p = await openLive();
      allOnLine(p, LIVE_ROW);
      assert.equal(p.active(), 'overview');
    } },
    { name: 'live, Advanced: Agents is gone', run: async () => {
      allOnLine(await openLive({ level: 'advanced' }), without(LIVE_ROW, 'agents'));
    } },
    { name: 'live, Simple', run: async () => {
      allOnLine(await openLive({ level: 'simple' }), ['overview', 'task', 'diff', 'workflow', 'qa']);
    } },
    { name: 'saved, Expert', run: async () => {
      allOnLine(await openSaved(), SAVED_ROW);
    } },
    { name: 'saved, Advanced: the saved Logs tab is Expert, so it is gone', run: async () => {
      allOnLine(await openSaved({ level: 'advanced' }), without(SAVED_ROW, 'logs', 'agents'));
    } },
    { name: 'saved, Simple', run: async () => {
      allOnLine(await openSaved({ level: 'simple' }), ['overview', 'task', 'diff', 'workflow', 'clarify']);
    } },
  ]);
});

test('git off: Diff and Actions are not on the line', async () => {
  await checkRows([
    { name: 'live, Expert', run: async () => {
      allOnLine(await openLive({ git: 'off' }), without(LIVE_ROW, 'diff', 'actions'));
    } },
    { name: 'live, Simple', run: async () => {
      allOnLine(await openLive({ git: 'off', level: 'simple' }), ['overview', 'task', 'workflow', 'qa']);
    } },
    { name: 'saved, Expert', run: async () => {
      allOnLine(await openSaved({ git: 'off' }), without(SAVED_ROW, 'diff', 'actions'));
    } },
    { name: 'git goes missing while the page is open, with a git tab open', run: async () => {
      const p = await openLive({ route: 'running/r1/details/actions' });
      assert.equal(p.active(), 'actions');
      applyGit({ available: false }, p.doc);
      await p.ctx.settle(6);
      assert.equal(p.active(), 'overview');
      allOnLine(p, without(LIVE_ROW, 'diff', 'actions'));
      applyGit({ available: true }, p.doc);
      await p.ctx.settle(6);
      allOnLine(p, LIVE_ROW);
    } },
  ]);
});

const FOLDER_LIVE = ['overview', 'task', 'changes', 'artifacts', 'workflow', 'qa', 'logs', 'sessions', 'agents'];
const FOLDER_SAVED = ['overview', 'task', 'changes', 'artifacts', 'workflow', 'clarify', 'logs', 'sessions', 'agents'];

test('a folder run: Changes on the line in place of Diff, no Actions', async () => {
  await checkRows([
    { name: 'live', run: async () => {
      allOnLine(await openLive({ hello: { workMode: 'folder', projectDir: '/tmp/tax' }, state: { workMode: 'folder', branch: { workMode: 'folder', copyDir: '/tmp/copy' } } }), FOLDER_LIVE);
    } },
    { name: 'saved', run: async () => {
      const detail = { ...SAVED, results: null, state: { ...SAVED.state, workMode: 'folder', branch: { workMode: 'folder' } } };
      allOnLine(await openSaved({ detail, row: { ...ROW, workMode: 'folder', branch: null } }), FOLDER_SAVED);
    } },
  ]);
});

test('a run without a project: Artifacts opens first, in its table place', async () => {
  await checkRows([
    { name: 'live, Expert', run: async () => {
      const p = await openLive({ hello: { workMode: 'none' }, state: { workMode: 'none', branch: { workMode: 'none' } } });
      allOnLine(p, without(FOLDER_LIVE, 'changes'));
      assert.equal(p.active(), 'overview', 'the run route opens Overview');
    } },
    { name: 'live, Details with no tab named opens Artifacts first, at Simple too', run: async () => {
      const p = await openLive({ level: 'simple', route: 'running/r1/details/artifacts', hello: { workMode: 'none' }, state: { workMode: 'none', branch: { workMode: 'none' } } });
      assert.equal(p.active(), 'artifacts');
      allOnLine(p, ['overview', 'task', 'artifacts', 'workflow', 'qa']);
    } },
    { name: 'saved', run: async () => {
      const detail = { ...SAVED, results: null, state: { ...SAVED.state, workMode: 'none', branch: { workMode: 'none' } } };
      allOnLine(await openSaved({ detail, row: { ...ROW, workMode: 'none', branch: null }, route: 'details' }), without(FOLDER_SAVED, 'changes'));
    } },
  ]);
});

/** A menu row's name, without its count and check. */
const names = (rows) => rows.map((r) => r.replace(/^✓ /, '').replace(/ \d+$/, ''));

test('a deep link into the last tab: lit in its place when wide, drawn just before More when narrow', async () => {
  await checkRows([
    { name: 'live', open: openLive, route: 'running/r1/details/agents', row: LIVE_ROW, hash: '#running/r1/details/logs' },
    { name: 'saved', open: openSaved, route: 'details/agents', row: SAVED_ROW, hash: null },
  ].map(({ name, open, route, row, hash }) => ({ name, run: async () => {
    const p = await open({ route, layout: true });
    p.resize(1200);
    assert.equal(p.active(), 'agents');
    allOnLine(p, row);
    p.resize(NARROW, 0);
    assert.equal(p.active(), 'agents');
    assert.deepEqual(p.row(), ['overview', 'task', 'agents']);
    assert.ok(!names(p.menu()).includes('Agents'), 'it is on the line, so it is not under More');
    p.pick('Logs');
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(p.row(), ['overview', 'task', 'logs']);
    assert.ok(names(p.menu()).includes('Agents'));
    if (hash) assert.equal(p.window.location.hash, hash);
  } })));
});

test('a click on the live graph opens Workflow in its table place', async () => {
  const p = await openLive();
  click(p.window, p.doc.querySelector('#run-detail .rd-live'));
  await p.ctx.settle(6);
  assert.equal(p.active(), 'workflow');
  allOnLine(p, LIVE_ROW);
});

test('a menu pick opens the tab, puts it in the address and focuses it; Esc returns to More', async () => {
  const p = await openLive({ layout: true });
  p.resize(NARROW, 0);
  const more = p.more();
  assert.equal(more.getAttribute('aria-haspopup'), 'menu');
  assert.equal(more.getAttribute('role'), null);
  click(p.window, more);
  assert.equal(p.menuEl().parentElement, p.doc.body, 'never clipped by the tab line');
  for (const label of ['Artifacts', 'Actions', 'Workflow', 'Sessions', 'Agents']) assert.ok(p.item(label).querySelector('svg'), `${label} has its icon`);
  click(p.window, p.item('Sessions'));
  await p.ctx.settle(6);
  assert.equal(p.active(), 'sessions');
  assert.equal(p.window.location.hash, '#running/r1/details/sessions');
  assert.equal(p.doc.activeElement, p.btn('sessions'));
  click(p.window, p.more());
  p.doc.activeElement.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(p.menuEl(), null);
  assert.equal(p.doc.activeElement, p.more());
});

test('counts update: the menu reads the badge when it opens, and every tab keeps its button on the line', async () => {
  const p = await openLive({ layout: true });
  p.resize(NARROW, 0);
  assert.equal(p.btn('artifacts').querySelector('.rd-tab-badge').textContent, '2');
  p.ctx.dispatch({ type: 'artifact', runId: 'r1', kind: 'review', path: 'reviews/review.md', nodeId: null, executionId: null, cycle: null });
  p.ctx.dispatch(stateFrame({ subAgents: [{ id: 'a1', label: 'Explore', status: 'running' }] }));
  await p.ctx.settle(6);
  assert.ok(p.menu().includes('Agents 1'));
  for (const k of ['artifacts', 'actions', 'workflow', 'sessions', 'agents']) assert.ok(p.btn(k), k);
  assert.equal(p.btn('artifacts').querySelector('.rd-tab-badge').textContent, '3');
  assert.equal(p.btn('actions').dataset.needsGit, '');
  assert.equal(p.btn('agents').dataset.minLevel, 'expert');
});

test('the Actions dot still lands on the Actions button under More', async () => {
  const running = [{ instanceId: `act:${ROW.id}:${KEY}:run`, runId: ROW.id, member: KEY, actionId: 'run', label: 'Run', kind: 'service',
    status: 'ready', ports: { PORT: 4417 }, url: 'http://localhost:4417', startedAt: Date.now(), histKey: KEY, workspaceId: null, runTitle: 'Log UX' }];
  const p = await openSaved({ detail: { ...SAVED, results: RESULTS }, arms: (url) => (url.endsWith('/api/actions/running') ? ok(running) : null), layout: true });
  p.resize(NARROW, 0);
  p.ctx.wsBox.ws.dispatch('message', { data: JSON.stringify({ type: 'actions-changed', action: 'start' }) });
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
  assert.ok(p.btn('actions').hasAttribute('data-overflow'));
  assert.ok(p.btn('actions').querySelector('.tab-dot'));
});

test('a level change while the page is open: the open tab gives way and More follows the fold', async () => {
  const p = await openLive({ route: 'running/r1/details/agents', layout: true });
  p.resize(400, 0);
  assert.equal(p.active(), 'agents');
  assert.ok(p.more());
  applyLevel('simple', p.doc);                            // the five Simple tabs draw 335px
  await p.ctx.settle(6);
  assert.equal(p.active(), 'overview');
  allOnLine(p, ['overview', 'task', 'diff', 'workflow', 'qa']);
  applyLevel('expert', p.doc);
  await p.ctx.settle(6);
  assert.ok(p.more());
  assert.deepEqual(p.row(), ['overview', 'task', 'diff', 'artifacts']);
  assert.equal(p.active(), 'overview');
});

test('a tab hidden while the page is open leaves the line: a Care run merges Agents away', async () => {
  const agent = (id, key) => ({ id, kind: 'agent', key, label: key });
  const p = await openLive();                               // no manifest yet, so no careRun
  applyFlags({ shaperSmallRuns: true }, p.doc);
  allOnLine(p, LIVE_ROW);
  click(p.window, p.btn('agents'));
  assert.equal(p.active(), 'agents');
  const careRun = careRunPlan('balanced', { runRoles: ['product'] });
  p.ctx.dispatch(stateFrame({ stepper: { version: 2, template: { id: 'wf_shape_slice_req' }, careRun,
    graph: { nodes: [agent('n_plan', 'planner'), agent('n_impl', 'implementer')], wires: [] } } }));
  await p.ctx.settle(8);
  assert.equal(p.btn('agents').hidden, true);
  assert.equal(p.active(), 'overview');
  allOnLine(p, without(LIVE_ROW, 'agents'));
});

// --- the width fit (tab-fold.mjs) --------------------------------------------

// A 375px screen leaves the bar 311px inside the page's 32px gutters; the icons are hidden there (terminal-pane.css).
const NARROW = 311;
const PAGES = [
  { name: 'live', open: openLive, route: 'running/r1/details/logs', row: LIVE_ROW, qa: 'qa' },
  { name: 'saved', open: openSaved, route: 'details/logs', row: SAVED_ROW, qa: 'clarify' },
];

test('wide: every tab on the line in table order, no More', async () => {
  await checkRows(PAGES.map(({ name, open, row }) => ({ name, run: async () => {
    const p = await open({ layout: true });
    p.resize(1200);
    allOnLine(p, row);
    assert.equal(p.menu(), null);
    p.resize(780);                                          // 700 of tabs fit; the icons' 118 do not leave the room
    assert.deepEqual(p.row(), without(row, 'sessions', 'agents'));
    p.resize(780, 0);
    allOnLine(p, row);
  } })));
});

test('narrow (375px): the tabs fold from the right end, Overview and the open tab stay, widening removes More', async () => {
  await checkRows(PAGES.map(({ name, open, route, row, qa }) => ({ name, run: async () => {
    const p = await open({ route, layout: true });
    assert.equal(p.active(), 'logs');
    p.resize(NARROW, 0);
    assert.deepEqual(p.row(), ['overview', 'task', 'logs']);
    assert.equal(p.active(), 'logs');
    assert.deepEqual(names(p.menu()), ['Diff', 'Artifacts', 'Actions', 'Workflow', 'Q&A', 'Sessions', 'Agents']);
    assert.ok(p.menu().includes('Artifacts 2'), 'a folded tab keeps its count');
    p.resize(1, 0);
    assert.deepEqual(p.row(), ['overview', 'logs']);
    assert.ok(p.more());
    p.resize(360, 0);
    assert.deepEqual(p.row(), ['overview', 'task', 'diff', 'logs'], 'back in reverse order');
    assert.ok(p.btn('artifacts').hasAttribute('data-overflow') && p.btn(qa).hasAttribute('data-overflow'));
    p.resize(1200);
    allOnLine(p, row);
  } })));
});

test('open a folded tab from More: it joins the line, lit, and another gives way', async () => {
  await checkRows(PAGES.map(({ name, open }) => ({ name, run: async () => {
    const p = await open({ layout: true });
    p.resize(NARROW, 0);
    assert.deepEqual(p.row(), ['overview', 'task', 'diff']);
    p.pick('Artifacts');
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
    assert.equal(p.active(), 'artifacts');
    assert.deepEqual(p.row(), ['overview', 'task', 'artifacts']);
    assert.equal(p.doc.activeElement, p.btn('artifacts'));
  } })));
});

test('the tool icons end the tab line on both pages, the header bar has none', async () => {
  await checkRows(PAGES.map(({ name, open }) => ({ name, run: async () => {
    const p = await open({ layout: true });
    const prefix = p.bar().classList.contains('rd-tabs') ? 'rd' : 'hd';
    const host = p.bar().querySelector(':scope > .tool-icons');
    assert.ok(host?.hasAttribute('data-tool-icons'));
    assert.equal(host.getAttribute('role'), 'group');
    assert.equal(host.getAttribute('aria-label'), 'Tools');
    assert.equal(p.bar().lastElementChild, host);
    assert.ok(host.querySelectorAll('button.tool-icon').length >= 3, 'the tool panel filled it');
    const bar = p.bar().closest(`.${prefix}`).querySelector('.rd-bar-end');
    assert.equal(bar.querySelector('.tool-icons, .tool-icon'), null);
    p.resize(1);
    assert.equal(p.bar().lastElementChild, host);
    assert.equal(host.previousElementSibling, p.more());
  } })));
});

// --- the plain header (CSS) ------------------------------------------------

const css = (file) => readFileSync(new URL(`../ui/public/${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of the rule whose selector list is exactly `selector` (the first one in the file). */
function rule(file, selector) {
  const hit = [...css(file).matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].trim() === selector);
  assert.ok(hit, `${file}: a rule for ${selector}`);
  return Object.fromEntries(hit[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
}

test('the run headers have no box and sit on the body\'s edges; .pd-header keeps its box; overflow tabs are hidden', () => {
  for (const [file, selector] of [['runs/running-detail-header.css', '.rd-header'], ['history/detail-header.css', '.hd-header']]) {
    const r = rule(file, selector);
    for (const k of Object.keys(r)) assert.doesNotMatch(k, /^(background|border)/, `${selector}: ${k}`);
    assert.equal(r.padding, '0', selector);
    assert.match(r.margin, /^\d+px 32px 0$/, selector);
  }
  assert.equal(rule('runs/running-detail-header.css', '.rd-header').margin, rule('history/detail-header.css', '.hd-header').margin, 'no jump from live to saved');
  assert.match(rule('runs/running-detail-header.css', '.rd-body').padding, /^0 32px /);
  assert.doesNotMatch(css('history/detail-header.css'), /\.hd-header,\s*\.pd-header/, 'the shared box rule is split');
  const pd = rule('history/detail-header.css', '.pd-header');
  assert.deepEqual([pd.background, pd.border, pd['border-radius'], pd.padding], ['var(--panel)', '1px solid var(--line)', 'var(--r-card)', '20px 24px 18px']);
  const panel = rule('chat/chat-run-panel.css', '.crp :is(.rd-header,.hd-header)');
  assert.equal(panel.padding, '0');
  assert.match(panel.margin, /^\d+px 16px 0$/);
  assert.equal(rule('runs/running-detail-tab.css', '.tabs > .tab[data-overflow]:not(.active)').display, 'none');
  const icons = rule('runs/running-detail-tab.css', '.tabs > .tool-icons');
  assert.deepEqual([icons['margin-left'], icons['align-self'], icons.position, icons.top], ['auto', 'center', 'relative', '-3px']);
  assert.equal(rule('runs/running-detail-tab.css', '.tabs:is(.rd-tabs,.hd-tabs)')['overflow-x'], 'hidden');
  // The last icon sits on the clipping line's edge: its focus ring is drawn inward, as a tab's is.
  assert.equal(rule('runs/running-detail-tab.css', '.tabs > .tool-icons > .btn:focus-visible')['outline-offset'], '-2px');
  // The group and feature pages wear .rd-tabs too, and never fold: their line keeps its scroll.
  assert.equal(rule('runs/running-detail-tab.css', '.tabs.gpage-tabs')['overflow-x'], 'auto');
});
