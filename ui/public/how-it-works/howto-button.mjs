// The "How it works" button and its "New" mark: a quiet icon .btn with a question icon and a trailing hidden
// "New" dot. No words: the name is its title and its accessible name. The controller (how-it-works.mjs) places it.
// The dot carries no text: a visually hidden "New" inside the button would count as a word of its label and as
// text on the dot's slate. The accessible name says it instead ("How Runs works, new").

const LABEL = 'How it works';
const TIP = 'How this area works';
const questionIcon = (px) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" `
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.8 9a3.2 3.2 0 1 1 5 2.7c-1.2.8-1.8 1.4-1.8 2.8"></path>'
  + '<path d="M12 18.5h.01"></path></svg>';
const MARK = '<span class="howto-new" aria-hidden="true" hidden></span>';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The button's HTML: a quiet icon button with the question icon and a trailing hidden "New" mark.
 *  With `area` it is a page's own button (its top row): `label` names the page ("How Runs works") as the title and
 *  the accessible name, the icon is 16px like the app's other icon buttons, and `size: 'sm'` makes it 28px for a
 *  row of small buttons. It carries no data-min-level: inside a page, shown at every level means no gate at all.
 *  Without `area` it is the Workflows editor's (its bar, after the zoom menu), with the level hook it has always had. */
export function howtoButtonHtml({ id, cls, area, label = LABEL, size = 'md' }) {
  const classes = ['btn', 'btn-quiet', 'btn-icon', size === 'sm' ? 'btn-sm' : '', cls].filter(Boolean).join(' ');
  const attrs = [
    'type="button"', `class="${esc(classes)}"`, `title="${esc(area ? label : TIP)}"`,
    id ? `id="${esc(id)}"` : '', area ? `data-howto-area="${esc(area)}"` : '',
    area ? '' : 'data-min-level="simple"', `data-howto-label="${esc(label)}"`, `aria-label="${esc(label)}"`,
  ].filter(Boolean).join(' ');
  return `<button ${attrs}>${questionIcon(area ? 16 : 14)}${MARK}</button>`;
}

/** The button as an element, for a page that builds elements. */
export function howtoButtonElement(doc, opts) {
  const t = doc.createElement('template');
  t.innerHTML = howtoButtonHtml(opts);
  return t.content.firstElementChild;
}

/** Name a page button again (the Chats list's serves Chat and Design): the title, and the accessible name with
 *  its ", new" kept. */
export function nameHowtoButton(btn, label) {
  btn.dataset.howtoLabel = label;
  btn.title = label;
  btn.setAttribute('aria-label', btn.dataset.new === 'true' ? `${label}, new` : label);
}

/** Show or hide the "New" mark on a button, and say it in the accessible name; a missing button is a no-op. */
export function paintHowtoMark(btn, isNew) {
  if (!btn) return;
  btn.dataset.new = isNew ? 'true' : 'false';
  const mark = btn.querySelector('.howto-new');
  if (mark) mark.hidden = !isNew;
  const label = btn.dataset.howtoLabel;
  if (label) btn.setAttribute('aria-label', isNew ? `${label}, new` : label);
}
