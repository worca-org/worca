// test/ui-workflows-markup.test.mjs — the Workflows view's static shell (index.html) and its CSS hooks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readIndexHtml } from '../src/core/read-index-html.mjs';
import { readStyleCss } from '../src/core/read-style-css.mjs';

const html = readIndexHtml();
const css = readStyleCss();
const doc = new JSDOM(html).window.document;

test('one workflows view; the composer, agents, scripts and agent-create views are gone', () => {
  assert.equal(doc.querySelectorAll('[data-view="workflows"]').length, 1);
  for (const v of ['composer', 'agents', 'scripts', 'agent-create']) assert.equal(doc.querySelector(`[data-view="${v}"]`), null, v);
});

test('top bar: Back, Workflows ▾, name, Canvas · Tests · Versions | the status bar (badge, chip), Open (the Library toggle), Save version, Save — and nothing else', () => {
  const tl = doc.querySelector('.wfv-tl .wfv-bar');
  assert.deepEqual([...tl.querySelectorAll('button, input')].map((e) => e.id), ['wfv-back', 'wfv-wf-menu', 'wfv-name', 'wfv-page-canvas', 'wfv-page-tests', 'wfv-page-versions', 'wfv-import-file']);
  assert.equal(tl.querySelector('#wfv-doc, #wfv-errors'), null, 'the badge and the chip left the top-left bar');
  assert.equal(doc.getElementById('wfv-name').placeholder, 'Untitled pipeline');
  const tr = doc.querySelector('.wfv-tr');
  assert.deepEqual([...tr.querySelectorAll('button')].map((e) => e.id), ['wfv-errors', 'wfv-status-more', 'wfv-lib-toggle', 'wfv-saveversion', 'wfv-save']);
  assert.equal(doc.getElementById('wfv-save').textContent.trim(), 'Save');
});

test('top right: the status bar, then Open, Save version and Save as separate buttons 8px apart, in no shared bar; the Save reason is never text on the canvas', () => {
  const tr = doc.querySelector('.wfv-tr');
  assert.deepEqual([...tr.children].map((e) => e.id), ['wfv-status', 'wfv-lib-toggle', 'wfv-saveversion', 'wfv-savewrap']);
  for (const id of ['wfv-lib-toggle', 'wfv-saveversion', 'wfv-save']) assert.equal(doc.getElementById(id).closest('.wfv-bar'), null, `${id} is in no bar`);
  for (const id of ['wfv-lib-toggle', 'wfv-saveversion']) {
    const b = doc.getElementById(id);
    assert.ok(b.classList.contains('btn') && !b.classList.contains('btn-quiet'), `${id} is a secondary .btn: a quiet one has no surface on the canvas`);
  }
  assert.ok(doc.getElementById('wfv-save').classList.contains('btn-primary'));
  assert.match(css, /\n\.wfv-tr\{top:12px;right:12px;display:flex;align-items:center;gap:8px;height:40px;\}/, '8px between them, centred on the 40px top-left bar');
  assert.match(css, /\n\.wfv-tr > \*\{flex:0 0 auto;\}/, 'nothing in the group shrinks: top-fit.mjs reads its own width, then folds the status bar');
  assert.match(css, /\n\.wfv-tr \.btn\[aria-pressed="true"\]\{background:var\(--hover\);\}/, 'the open Library keeps its tint');
  const lib = doc.getElementById('wfv-lib-toggle');
  assert.deepEqual([...lib.children].map((e) => e.tagName.toLowerCase()), ['svg', 'span'], 'the folder, then the word');
  assert.equal(lib.textContent.trim(), 'Open');
  assert.equal(lib.classList.contains('btn-icon'), false);
  assert.equal(lib.getAttribute('aria-label'), 'Open Library', 'the name holds the word on the button');
  assert.equal(lib.title, 'Library');
  assert.match(css, /\n\.wfv-bar \.btn:not\(\.btn-icon\) svg,\.wfv-tr \.btn:not\(\.btn-icon\) svg\{width:15px;height:15px;\}/, 'the folder svg has no size of its own');
  assert.match(css, /\n\.wfv-bar \.btn-icon svg\{width:16px;height:16px;\}/);
  assert.match(css, /\n\.wfv-savewrap\{display:inline-flex;\}/, 'no margin of its own: the gap spaces it');
  assert.ok(doc.getElementById('wfv-save-reason').hidden, 'the reason is Save\'s description, not text');
  assert.doesNotMatch(css, /\.wfv-save-reason/);
});

test('the status bar: the document badge and the validation chip in a bar of their own, left of Open; nothing shown = no bar', () => {
  const status = doc.getElementById('wfv-status');
  assert.deepEqual([...status.classList], ['wfv-bar', 'wfv-status']);
  assert.equal(status.nextElementSibling.id, 'wfv-lib-toggle', 'left of Open');
  assert.deepEqual([...status.children].map((e) => e.id), ['wfv-doc', 'wfv-errors', 'wfv-status-more']);
  const badge = doc.getElementById('wfv-doc');
  assert.equal(badge.getAttribute('role'), 'status');
  assert.ok(badge.hidden && doc.getElementById('wfv-errors').hidden, 'both start hidden');
  assert.match(css, /\n\.wfv-status:not\(:has\(> :not\(\[hidden\]\)\)\)\{display:none;\}/, 'no empty bar on a blank canvas');
});

test('the status bar folds (top-fit.mjs sets data-compact): one "!" in the chip\'s dress stands for the badge and the chip; the top-left bar takes what the right group leaves', () => {
  const status = doc.getElementById('wfv-status');
  assert.equal(status.dataset.compact, 'false', 'open until measured');
  const more = doc.getElementById('wfv-status-more');
  assert.deepEqual([...more.classList], ['btn', 'btn-sm', 'btn-danger', 'btn-icon', 'wfv-errchip', 'wfv-status-more'], 'the chip\'s skin and tones, as an icon');
  assert.ok(more.hidden, 'only top-fit.mjs shows it');
  assert.equal(more.getAttribute('aria-haspopup'), 'menu');
  assert.equal(more.getAttribute('aria-expanded'), 'false');
  assert.equal(more.textContent.trim(), '', 'a glyph, not a typed "!"');
  assert.match(more.innerHTML, /<svg [^>]*aria-hidden="true"[^>]*><path d="M12 6\.8v6\.6"><\/path><path d="M12 17\.6h\.01"><\/path><\/svg>/, 'the shared alert glyph (icons.mjs)');
  assert.match(css, /\n\.wfv-status-more\{margin:0 2px;\}/);
  assert.match(css, /\n\.wfv-status\[data-compact="true"\] > \.wfv-errchip:not\(\.wfv-status-more\)\{display:none;\}/, 'the chip is in the menu');
  const sr = css.match(/\n\.wfv-status\[data-compact="true"\] > \.wfv-doc,\.wfv-status\[data-compact="true"\]:has\(> \.wfv-status-more\[hidden\]\)\{([^}]*)\}/);
  assert.ok(sr, 'the folded badge, and the bar when the badge is all it holds');
  assert.match(sr[1], /clip-path:inset\(50%\);/, 'screen readers keep the document status');
  assert.match(sr[1], /border:0;/, 'the bar leaves no 1px frame behind');
  assert.doesNotMatch(sr[1], /display:none/);
  assert.match(css, /\n\.wfv-tl\{top:12px;left:12px;max-width:calc\(100% - 32px - var\(--wfv-tr-w,0px\)\);\}/, '12 + 12 inset and the 8px gap');
  assert.match(css, /\n\.wfv-tl \.wfv-bar\{max-width:100%;\}/, 'the name gives way (min 56px)');
});

test('dock = black "+", the Auto-layout icon in its own bar, the chat root; bottom-right = zoom, then the How it works slot', () => {
  const dock = [...doc.querySelectorAll('#wfv-dock > *')];
  assert.deepEqual(dock.map((e) => e.id || e.className), ['wfv-add', 'wfv-bar', 'wfc']);
  const auto = doc.getElementById('wfv-autolayout');
  assert.deepEqual([...dock[1].children], [auto], 'alone in its bar');
  assert.deepEqual([...auto.classList], ['btn', 'btn-quiet', 'btn-icon']);
  assert.equal(auto.textContent.trim(), '', 'an icon, no word');
  assert.ok(auto.querySelector('svg'));
  assert.equal(auto.getAttribute('aria-label'), 'Auto-layout');
  assert.equal(auto.title, 'Auto-layout');
  assert.match(css, /\n\.wfv-dock > \.wfv-bar\{flex:0 0 auto;\}/, 'the chat gives way, not the tile');
  const br = [...doc.querySelectorAll('#wfv-br > *')];
  assert.deepEqual(br.map((e) => e.id || e.className), ['wfv-bar', 'wfv-howto-slot']);
  assert.deepEqual([...br[0].querySelectorAll('button')].map((e) => e.id), ['wfv-zoom']);
  assert.deepEqual([...br[1].classList], ['wfv-bar', 'wfv-howto-bar']);
  assert.equal(br[1].children.length, 0, 'how-it-works.mjs puts its button here');
  assert.match(css, /\n\.wfv-howto-bar:not\(:has\(> \.btn:not\(\[hidden\]\)\)\)\{display:none;\}/, 'no empty tile');
  assert.match(css, /\n\.wfv-stage:has\(> \.wfv-versions:not\(\[hidden\]\)\) > \.wfv-dock,\.wfv-stage:has\(> \.wfv-versions:not\(\[hidden\]\)\) > \.wfv-br > :not\(\.wfv-howto-bar\)\{display:none;\}/,
    'the Versions page keeps How it works');
});

test('the dock "+" is the large icon button (40px, in line with the chat pill), the only .btn-lg in the view', () => {
  assert.deepEqual([...doc.getElementById('wfv-add').classList], ['btn', 'btn-lg', 'btn-primary', 'btn-icon', 'wfv-plus']);
  assert.deepEqual([...doc.querySelectorAll('[data-view="workflows"] .btn-lg')].map((e) => e.id), ['wfv-add']);
});

test('the agent + script editors live in the view\'s sheet with their old ids', () => {
  const sheet = doc.getElementById('wfv-sheet');
  assert.equal(sheet.getAttribute('aria-modal'), 'true');
  for (const id of ['agents-list', 'agents-msg', 'agent-card-tpl', 'agw-step-1', 'agw-step-2', 'agw-step-3', 'agw-name', 'agw-close', 'scripts-host', 'scripts-msg']) {
    assert.ok(sheet.querySelector(`#${id}`), `#${id} inside the sheet`);
  }
});

test('the canvas-keys fence covers every non-canvas surface', () => {
  for (const id of ['wfv-library', 'wfc', 'wfv-overlay', 'wfv-sheet']) assert.equal(doc.getElementById(id).dataset.canvasKeys, 'off', id);
  // The top bars, the dock and the bottom-right bar too: Space on a focused Save, "+" or zoom button activates IT
  // (the canvas Space-pan would cancel the press) and Delete / arrows never edit the selected card from there.
  const floats = [...doc.querySelectorAll('.wfv-float')];
  assert.equal(floats.length, 4);
  for (const f of floats) assert.equal(f.dataset.canvasKeys, 'off', f.className);
});

test('full screen: the sidebar and the top bar are hidden on the view', () => {
  assert.match(css, /body\.view-workflows \.sidebar,body\.view-workflows #topnav\{display:none !important;\}/);
  assert.match(css, /body\.view-workflows \.main\{padding:0;overflow:hidden;display:flex;flex-direction:column;\}/);
  assert.match(css, /\.view\[data-view="workflows"\]\{flex:1 1 auto;min-height:0;position:relative;\}/);
});

test('narrow screens: the top-right buttons step under the bar, the zoom keeps its %, and the selection toolbar stays on the stage', () => {
  assert.match(css, /@media \(max-width:760px\)\{\.wfv-tr\{top:58px;\}\.wfv-sheet\{padding:8px;\}\}/);
  assert.doesNotMatch(css, /#wfv-autolayout/, 'Auto-layout is an icon at every width: no rule of its own');
  assert.doesNotMatch(css, /\.wfv-br \.wfv-btn span\{display:none;\}/, 'that rule also hid #wfv-zoom-label');
  assert.match(css, /\.wfv-tb\{[^}]*max-width:calc\(100% - 16px\);overflow-x:auto;/);
});

test('versions (flag workflowTests): Canvas / Versions switch, the status line, Save version and the hidden page', () => {
  const pages = doc.getElementById('wfv-pages');
  assert.ok(pages, '#wfv-pages');
  assert.equal(pages.dataset.flag, 'workflowTests');
  assert.ok(pages.classList.contains('seg'));
  assert.deepEqual([...pages.querySelectorAll('button')].map((b) => b.textContent.trim()), ['Canvas', 'Tests', 'Versions']);
  assert.deepEqual([...pages.querySelectorAll('button')].map((b) => b.dataset.page), ['canvas', 'tests', 'versions']);
  // The Labs chip sits inside the Versions tab label (A4), never as a link in the strip.
  assert.equal(pages.querySelector('[data-page="versions"]').dataset.flagChip, 'workflowTests');
  assert.equal(pages.hasAttribute('data-flag-chip'), false);
  const status = doc.getElementById('wfv-vstatus');
  assert.equal(status.dataset.flag, 'workflowTests');
  assert.ok(status.hidden);
  const save = doc.getElementById('wfv-saveversion');
  assert.equal(save.textContent.trim(), 'Save version');
  assert.equal(save.dataset.flag, 'workflowTests');
  const page = doc.getElementById('wfv-versions');
  assert.ok(page, '#wfv-versions');
  assert.ok(page.hidden);
  assert.equal(page.dataset.flag, 'workflowTests');
  // Under the floating top bars (so Canvas stays reachable) and fenced from the canvas keys (Delete never edits the hidden graph).
  assert.equal(page.parentElement.id, 'wfv-stage');
  assert.equal(page.dataset.canvasKeys, 'off');
  // Focusable, so a click on its text keeps the focus inside the fence (not on <body>).
  assert.equal(page.getAttribute('tabindex'), '-1');
  // The tablist names what each tab shows.
  assert.equal(page.getAttribute('role'), 'tabpanel');
  assert.equal(page.getAttribute('aria-labelledby'), 'wfv-page-versions');
  assert.equal(doc.getElementById('wfv-page-versions').getAttribute('aria-controls'), 'wfv-versions');
  assert.equal(doc.getElementById('wfv-page-canvas').getAttribute('aria-controls'), 'wfv-canvas');
});

test('tests (flag workflowTests, Part 2): the Tests page sits on the stage like the Versions page', () => {
  const page = doc.getElementById('wfv-tests');
  assert.ok(page, '#wfv-tests');
  assert.ok(page.hidden);
  assert.equal(page.dataset.flag, 'workflowTests');
  assert.equal(page.parentElement.id, 'wfv-stage');
  assert.equal(page.dataset.canvasKeys, 'off');
  assert.equal(page.getAttribute('tabindex'), '-1');
  assert.equal(page.getAttribute('role'), 'tabpanel');
  assert.equal(page.getAttribute('aria-labelledby'), 'wfv-page-tests');
  assert.ok(page.classList.contains('wfv-versions'), 'shares the page placement and the dock rule');
  assert.equal(doc.getElementById('wfv-page-tests').getAttribute('aria-controls'), 'wfv-tests');
});

test('narrow screens: the top-left bar shrinks inside the stage instead of pushing Canvas · Versions off-screen', () => {
  const m = css.match(/@media \(max-width:760px\)\{\.wfv-tl\{.*\}/);
  assert.ok(m, 'a <=760px rule for .wfv-tl');
  assert.match(m[0], /\.wfv-tl\{[^}]*max-width:calc\(100% - 24px\)/);
  assert.match(m[0], /\.wfv-tl \.wfv-bar\{[^}]*max-width:100%/);
  assert.match(m[0], /\.wfv-name\{[^}]*min-width:0/);
  assert.match(m[0], /\.wfv-vstatus\{[^}]*clip/, 'the status stays for screen readers (visually hidden, not display:none)');
  assert.doesNotMatch(m[0], /\.wfv-vstatus\{[^}]*display:none/);
  assert.match(m[0], /\.wfv-menu-btn > span\{[^}]*clip/, 'Workflows goes icon-only but keeps its name for screen readers');
  assert.match(css, /\.wfv-stage\{[^}]*overflow:hidden/);
});

test('versions table: the fourth (actions) column has a fixed width so Used lines up across rows', () => {
  assert.match(css, /\.wfv-vt-draft,\.wfv-vt-row\{display:grid;grid-template-columns:64px minmax\(0,1fr\) 120px 320px;/);
});

test('style.css closes every block (an unclosed @media turns every later rule into a narrow-screen-only rule)', () => {
  let depth = 0;
  for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; assert.ok(depth >= 0, 'a } without its {'); }
  }
  assert.equal(depth, 0);
});

test('versions table: the draft row keeps Save version in the actions column; the narrow page clears the second-row Save bar', () => {
  assert.match(css, /\.wfv-vt-draft > \.btn\{grid-column:4;justify-self:end;\}/);
  // At <=760px .wfv-tr drops to top:58px (40px tall), so the page's first line starts below it, with a 16px gutter.
  // Mock browser check, finding 15: the space above the page is its own top border, so what scrolls never passes under the bars.
  assert.match(css, /\.wfv-versions\{[^}]*overflow:auto;[^}]*border-top:64px solid var\(--bg\);padding:8px 32px 48px;/);
  assert.match(css, /@media \(max-width:760px\)\{\.wfv-versions\{border-top-width:112px;padding:0 16px 32px;\}\}/);
});

test('phone width (finding 15): Canvas · Tests · Versions fit in the top-left bar; the status bar folds by measure, not by a width rule', () => {
  const m = css.match(/@media \(max-width:760px\)\{\.wfv-tl\{.*\}/);
  assert.match(m[0], /\.wfv-tl \.wfv-pages button\{padding:0 8px;\}/, 'the three buttons are narrower');
  assert.match(m[0], /\.wfv-tl\{max-width:calc\(100% - 24px\);\}/, 'its own row: the right group takes none of it');
  assert.doesNotMatch(css, /@media \(max-width:480px\)\{[^\n]*\.wfv-doc[,{]/, 'no <=480px rule for the document status any more');
});

// UI nits #3: at 390 px the switch squeezed the name to one letter ("F"). With the flag on, the switch is compact and the
// rest of the bar keeps its size, so the name has what is left ("Fix a bu…"); every rule is scoped to the flag, so with the
// flag off the bar is exactly dev's.
test('phone width (ui nits #3): with the switch shown the name keeps its room; every rule is scoped to the flag', () => {
  const F = ':root[data-flags~="workflowTests"]';
  const p = css.match(/@media \(max-width:480px\)\{:root\[data-flags~="workflowTests"\] [^\n]*\}\}/);
  assert.ok(p, 'a <=480px rule for the flag');
  const rules = [...p[0].slice('@media (max-width:480px){'.length).matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => [m[1], m[2]]);
  assert.ok(rules.length >= 5);
  for (const [sel] of rules) assert.ok(sel.startsWith(`${F} .wfv-tl `), `flag-scoped: ${sel}`);
  const decl = (sel) => (rules.find(([s]) => s === `${F} .wfv-tl ${sel}`) || [])[1];
  assert.equal(decl('.wfv-bar > :not(.wfv-name)'), 'flex-shrink:0;', 'only the name gives way');
  assert.equal(decl('.wfv-name'), 'text-overflow:ellipsis;');
  assert.equal(decl('.wfv-sep[data-flag]'), 'display:none;', 'no separator before the switch');
  assert.equal(decl('.wfv-chev'), 'display:none;', 'the Workflows menu button is its icon');
  assert.match(decl('.wfv-pages button'), /^padding:0 4px;font-size:var\(--fs-meta\);$/);
});
