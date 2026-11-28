// ui/public/tab-fold.mjs — which tabs of a detail screen's tab line go under "More" at the width the line has (app.js
// initDetailTabs `overflow`). Pure: measured widths in, the fold out.

const px = (n) => (Number.isFinite(n) ? n : 0);

/**
 * @param {object} o
 * @param {{key:string, width:number}[]} o.tabs  every shown tab, in drawn (table) order
 * @param {?string} o.active  the open tab: always drawn, never folded
 * @param {number} o.avail    the bar's inner width; not above 0 means unmeasured, which folds nothing
 * @param {number} o.gap      the flex column gap
 * @param {number} o.more     More's width, counted only once something folds
 * @param {number} [o.end]    the trailing node's width (the tool icons); 0 = none or hidden
 * @returns {string[]}  the folded keys, right to left; empty = nothing folds, no More. A narrower bar only ever adds
 *   to what a wider one folds.
 */
export function foldTabs({ tabs, active, avail, gap, more, end = 0 }) {
  const folded = [];
  if (!(avail > 0)) return folded;
  const fits = () => {
    const widths = tabs.filter((t) => !folded.includes(t.key)).map((t) => px(t.width));
    if (folded.length) widths.push(px(more));
    if (px(end) > 0) widths.push(end);
    const drawn = widths.reduce((sum, w) => sum + w, 0) + px(gap) * (widths.length - 1);
    return drawn <= avail + 0.5;   // sub-pixel rounding
  };
  // The tabs give way from the right end of the line. Overview and the open tab stay.
  for (const { key } of tabs.filter((t) => t.key !== 'overview' && t.key !== active).reverse()) {
    if (fits()) break;
    folded.push(key);
  }
  return folded;
}
