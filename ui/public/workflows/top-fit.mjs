// ui/public/workflows/top-fit.mjs
// The Workflows view's top row: the top-left bar (Back · Workflows ▾ · name) and the top-right group (the status
// bar · Open · Save) never meet. CSS cannot know both widths, so this measures them: when the full layout does not fit
// the stage, the status bar folds its badge and chip into one "!" button (a menu shows them; picking the problem is the
// chip's own click), and the top-left bar is given what is left (--wfv-tr-w on the stage: the name gives way). At
// <= 760px the right group has a row of its own, so only its width counts. Pure DOM over the elements app.js hands in;
// jsdom has no layout and no ResizeObserver, so the tests set the widths and call fit().
import { toggleMenu, closeMenus } from './menu.mjs';

const GAP = 8;        // between the two groups
const INSET = 24;     // 12px each side of the stage (.wfv-tl's left, .wfv-tr's right)
const TONES = ['is-incomplete', 'is-warning'];   // the chip's quiet and amber dress; neither = its own red

/**
 * @param {object} o
 * @param {Document} o.doc
 * @param {object} o.els  {stage: #wfv-stage, tl: .wfv-tl, tr: .wfv-tr, status: #wfv-status, more: #wfv-status-more,
 *   badge: #wfv-doc, chip: #wfv-errors}
 * @returns {{fit: Function, destroy: Function}}  no-ops when an element is missing
 */
export function createTopFit({ doc, els }) {
  const { stage, tl, tr, status, more, badge, chip } = els || {};
  if (!stage || !tl || !tr || !status || !more || !chip) return { fit() {}, destroy() {} };
  const win = doc.defaultView;
  const folded = () => status.dataset.compact === 'true';
  const menuOpen = () => more.getAttribute('aria-expanded') === 'true';
  const stacked = () => typeof win.matchMedia === 'function' && win.matchMedia('(max-width:760px)').matches;
  const words = (el) => (el && !el.hidden ? el.textContent.trim() : '');

  /** The "!" stands for the chip: it shows only while the bar is folded with a chip to show, in the chip's tone, and
   *  says the chip's words. */
  function sync() {
    more.hidden = !(folded() && !chip.hidden);
    for (const t of TONES) more.classList.toggle(t, chip.classList.contains(t));
    const problem = words(chip);
    more.setAttribute('aria-label', problem ? `${problem}. Show details` : 'Show details');
    more.title = problem;
    if (more.hidden && menuOpen()) closeMenus();
  }

  /** Decide on the open layout every time (a folded bar would otherwise never open again), then tell the top-left bar
   *  how wide the right group ended up. */
  function fit() {
    const room = stage.clientWidth - INSET;
    if (!(room > 0)) return;                                  // the view is not laid out
    stage.style.setProperty('--wfv-tr-w', '0px');             // both groups at their own width
    status.dataset.compact = 'false';
    more.hidden = true;
    const need = stacked() ? tr.offsetWidth : tl.offsetWidth + GAP + tr.offsetWidth;
    status.dataset.compact = need > room ? 'true' : 'false';
    sync();
    stage.style.setProperty('--wfv-tr-w', `${tr.offsetWidth}px`);
  }

  function openMenu() {
    const holds = words(badge);
    toggleMenu({ doc, anchor: more, align: 'end', label: 'Status', items: [
      ...(holds ? [{ header: holds }] : []),
      { label: words(chip), title: 'Show the first one', onSelect: () => chip.click() },
    ] });
  }

  more.addEventListener('click', openMenu);
  win.addEventListener('resize', fit);
  // A browser reports every size change (the window, the Library, a longer name, a new chip); the chip's tone and
  // words change without one, so those are watched too.
  const ro = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(() => fit()) : null;
  if (ro) for (const el of [stage, tl, tr]) ro.observe(el);
  const mo = typeof win.MutationObserver === 'function' ? new win.MutationObserver(() => fit()) : null;
  if (mo) for (const el of [chip, badge]) if (el) mo.observe(el, { attributes: true, attributeFilter: ['hidden', 'class'], childList: true, characterData: true, subtree: true });

  return {
    fit,
    destroy() {
      more.removeEventListener('click', openMenu);
      win.removeEventListener('resize', fit);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      if (menuOpen()) closeMenus();
      status.dataset.compact = 'false';
      more.hidden = true;
      stage.style.removeProperty('--wfv-tr-w');
    },
  };
}
