// The "How it works" controller: gives every page its button (a quiet ? at the end of the page's own top row,
// and the Workflows editor's in its bar), opens an area's explainer, records "seen" the moment it opens and
// starts the matching tour. A page's static markup holds an empty slot ([data-howto-slot="<area>"]) that mount()
// fills; a header built in JS is handed its button by button(area). It builds no markup of its own: the button
// comes from howto-button.mjs and the dialog from guide-dialog.mjs.
import { openGuideDialog } from './guide-dialog.mjs';
import { guideFor, areaOfRoute } from './area-guides.mjs';
import { howtoButtonElement, nameHowtoButton, paintHowtoMark } from './howto-button.mjs';
import { isGuideSeen } from '../../../src/shared/how-it-works/areas.mjs';
import { pageTitle } from '../topnav.mjs';

const MODAL_ID = 'how-it-works-modal';
const TOUR_LABEL = 'Show me in the product';
const PAGE_CLASS = 'page-howto';
const WORKFLOWS_ID = 'wfv-howto-btn';
const WORKSPACES_BTN_ID = 'ws-howto-btn';
// One Chats list serves Chat and Design, so its one button is the showing route's.
const LIST_AREAS = new Set(['chat', 'design']);

/** A page button's name: "How Runs works". */
const nameOf = (area) => `How ${pageTitle(area)} works`;

// The patch POST /api/onboarding takes: the legacy flag for Workspaces, the map for the rest.
function seenPatch(areaId) {
  return areaId === 'workspaces' ? { workspaceGuideSeen: true } : { guidesSeen: { [areaId]: true } };
}

// The status with the area marked seen, as a new object.
function withSeen(status, areaId) {
  if (areaId === 'workspaces') return { ...status, workspaceGuideSeen: true };
  return { ...status, guidesSeen: { ...status.guidesSeen, [areaId]: true } };
}

// A sample figure: made-up items under a caption. The shell asks for art through this builder.
function buildArt(doc, art) {
  if (!art || art.kind !== 'sample') return [];
  const fig = doc.createElement('figure');
  fig.className = 'wg-art';
  const ul = doc.createElement('ul');
  for (const text of art.items) {
    const li = doc.createElement('li');
    li.textContent = text;
    ul.append(li);
  }
  const cap = doc.createElement('figcaption');
  cap.className = 'wg-caption';
  cap.textContent = art.caption;
  fig.append(ul, cap);
  return [fig];
}

export function createHowItWorks({ doc, getStatus, setStatus, postPrefs, startTour, log = console.error }) {
  let route = null;
  let handle = null;
  let workflows = null;

  const currentArea = () => areaOfRoute(route);
  const byId = (id) => doc.getElementById(id);
  const isNew = (area) => !!area && isGuideSeen(getStatus(), area) === false;
  const pageButtons = () => [...doc.querySelectorAll(`.${PAGE_CLASS}[data-howto-area]`)];

  /** A page's button for `area`: a new one each call, wired and with its mark painted. null when the area has no
   *  guide. `size`: 'sm' (28px, the default) or 'md' (32px, for a row whose buttons are 32px). */
  function button(area, { size = 'sm' } = {}) {
    if (!guideFor(area)) return null;
    const el = howtoButtonElement(doc, { cls: PAGE_CLASS, area, label: nameOf(area), size: size === 'md' ? 'md' : 'sm' });
    el.addEventListener('click', () => open(el.dataset.howtoArea));
    paintHowtoMark(el, isNew(area));
    return el;
  }

  // Every slot that holds no button yet gets one. Safe to run again: a page built after mount() is filled on the
  // next route.
  function fillSlots() {
    for (const slot of doc.querySelectorAll('[data-howto-slot]')) {
      if (slot.querySelector(`.${PAGE_CLASS}`)) continue;
      const el = button(slot.dataset.howtoSlot, { size: slot.dataset.howtoSize });
      if (el) slot.append(el);
    }
  }

  function mount() {
    fillSlots();
    if (!byId(WORKFLOWS_ID)) {
      const host = byId('wfv-howto-slot');   // an icon in its own bar, after the zoom menu
      if (host) {
        const el = howtoButtonElement(doc, { id: WORKFLOWS_ID, cls: 'wfv-howto' });
        el.hidden = true;
        el.addEventListener('click', () => { const a = currentArea(); if (a) open(a); });
        host.append(el);
      }
    }
    workflows = byId(WORKFLOWS_ID);
  }

  function paintMarks() {
    for (const btn of pageButtons()) paintHowtoMark(btn, isNew(btn.dataset.howtoArea));
    paintHowtoMark(workflows, isNew('workflows'));
    paintHowtoMark(byId(WORKSPACES_BTN_ID), isNew('workspaces'));
  }

  function syncRoute(name) {
    if (name !== route && handle) handle.close('close');
    route = name;
    const area = currentArea();
    fillSlots();
    if (LIST_AREAS.has(area)) {
      for (const btn of pageButtons()) {
        if (!LIST_AREAS.has(btn.dataset.howtoArea) || btn.dataset.howtoArea === area) continue;
        btn.dataset.howtoArea = area;
        nameHowtoButton(btn, nameOf(area));
      }
    }
    if (workflows) workflows.hidden = area !== 'workflows';
    paintMarks();
  }

  async function markSeen(areaId) {
    const status = getStatus();
    if (status) setStatus(withSeen(status, areaId));
    try {
      const result = await postPrefs(seenPatch(areaId));
      if (result == null) log(`how-it-works: could not record "${areaId}" as seen`);
    } catch (err) {
      log(`how-it-works: could not record "${areaId}" as seen`, err);
    }
  }

  function open(areaId) {
    const guide = guideFor(areaId);
    if (!guide || handle) return;
    handle = openGuideDialog({
      doc,
      id: MODAL_ID,
      steps: guide.steps,
      buildArt,
      tour: guide.tour ? { label: TOUR_LABEL } : null,
      dataset: { area: areaId },
      onClose: (how) => {
        handle = null;
        if (how === 'tour' && guide.tour) {
          Promise.resolve(startTour(guide.tour)).catch((err) => log(`how-it-works: could not start the "${guide.tour}" tour`, err));
        }
      },
    });
    markSeen(areaId);
    paintMarks();
  }

  return { mount, syncRoute, paintMarks, open, markSeen, button };
}
