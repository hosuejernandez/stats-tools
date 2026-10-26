// Small DOM helpers shared by every module.

import { esc } from './plots.js';

export { esc };

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// A result card. `work` and `meaning` are optional HTML strings.
export function card(title, body, { work, meaning, actions = '', id = '' } = {}) {
  return `<div class="card"${id ? ` id="${id}"` : ''}>
    <h3><span>${title}</span>${actions}</h3>
    ${body}
    ${meaning ? interp(meaning) : ''}
    ${work ? `<details class="work"><summary>Show work</summary><div class="inner">${work}</div></details>` : ''}
  </div>`;
}

export function interp(html, tag = 'What does this mean?') {
  return `<div class="interp"><span class="tag">${tag}</span>${html}</div>`;
}

// Segmented control. options: [{ value, label }]
export function seg(name, options, selected) {
  return `<div class="seg" role="group" data-seg="${name}">${options
    .map(o => `<button type="button" data-value="${o.value}" aria-pressed="${o.value === selected}">${o.label}</button>`)
    .join('')}</div>`;
}

// Wires every segmented control inside root; calls onChange(name, value).
export function wireSegs(root, onChange) {
  root.addEventListener('click', e => {
    const btn = e.target.closest('.seg button');
    if (!btn || !root.contains(btn)) return;
    const group = btn.closest('.seg');
    $$('button', group).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    onChange(group.dataset.seg, btn.dataset.value);
  });
}

export const segValue = (root, name) => $(`.seg[data-seg="${name}"] button[aria-pressed="true"]`, root)?.dataset.value;

// Context helpers: turns "", "" into sensible defaults for sentence frames.
export function context(name, units) {
  const n = (name || '').trim();
  const u = (units || '').trim();
  // Names are singular ("quiz score"); `plural` is for frames like "50% of the quiz score values".
  return {
    name: n || 'value',
    Name: n ? n[0].toUpperCase() + n.slice(1) : 'Value',
    plural: n ? `${n} values` : 'values',
    units: u ? ` ${u}` : '',
    hasName: Boolean(n),
  };
}

// ---------- Tooltips ----------

export function initTooltips() {
  const tip = $('#tip');
  const show = (el, x, y) => {
    tip.textContent = el.getAttribute('data-tip');
    tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    let left = x + 14;
    let top = y - r.height - 10;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 18;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${top}px`;
  };
  const hide = () => { tip.style.display = 'none'; };
  document.addEventListener('pointermove', e => {
    const el = e.target.closest?.('[data-tip]');
    if (el) show(el, e.clientX, e.clientY);
    else hide();
  });
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest?.('[data-tip]');
    if (el && e.pointerType !== 'mouse') show(el, e.clientX, e.clientY);
  });
  document.addEventListener('scroll', hide, true);
}

// ---------- Download a plot as PNG ----------

const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-size', 'font-weight', 'font-family'];

export function downloadSvg(svg, filename = 'graph') {
  const clone = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll('*')];
  const dst = [clone, ...clone.querySelectorAll('*')];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    for (const p of STYLE_PROPS) dst[i].style.setProperty(p, cs.getPropertyValue(p));
  });
  const vb = svg.viewBox.baseVal;
  const k = 2; // export at 2x for crisp printing
  clone.setAttribute('width', vb.width * k);
  clone.setAttribute('height', vb.height * k);
  const data = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = vb.width * k;
    canvas.height = vb.height * k;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filename.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'graph'}.png`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }, 'image/png');
  };
  img.src = url;
}

export const downloadButton = name => `<button type="button" class="btn small" data-download="${esc(name)}">Download graph</button>`;

// One listener for every "Download graph" button: downloads the first svg in the same card.
export function initDownloads() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-download]');
    if (!btn) return;
    const svg = btn.closest('.card')?.querySelector('svg.plot');
    if (svg) downloadSvg(svg, btn.dataset.download);
  });
}

// Fills a <select> with sample datasets and calls onPick(sample) when one is chosen.
export function sampleSelect(samples) {
  return `<label class="field">Try a sample dataset
    <select data-samples>
      <option value="">— Choose a sample —</option>
      ${samples.map((s, i) => `<option value="${i}">${esc(s.title)}</option>`).join('')}
    </select></label>`;
}

export function wireSamples(root, samples, onPick) {
  const sel = $('[data-samples]', root);
  sel.addEventListener('change', () => {
    if (sel.value === '') return;
    onPick(samples[Number(sel.value)]);
    sel.value = '';
  });
}
