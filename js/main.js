// App entry: tab routing (kept in the URL hash so it works inside an iframe
// without needing browser storage) and one-time setup for each module.

import { $, $$, initTooltips, initDownloads } from './ui.js';
import * as oneVar from './modules/one-var.js';
import * as twoVar from './modules/two-var.js';
import * as categorical from './modules/categorical.js';
import * as normal from './modules/normal.js';
import * as simulation from './modules/simulation.js';

const modules = { 'one-var': oneVar, 'two-var': twoVar, categorical, normal, simulation };
const started = new Set();

function show(view) {
  if (!modules[view]) view = 'one-var';
  for (const btn of $$('.tabs button')) {
    const on = btn.dataset.view === view;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
  }
  for (const id of Object.keys(modules)) $(`#${id}`).hidden = id !== view;
  if (!started.has(view)) {
    modules[view].init($(`#${view}`));
    started.add(view);
  }
}

$('.tabs').addEventListener('click', e => {
  const btn = e.target.closest('button[data-view]');
  if (!btn) return;
  history.replaceState(null, '', `#${btn.dataset.view}`);
  show(btn.dataset.view);
});

// Arrow keys move between tabs.
$('.tabs').addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const tabs = $$('.tabs button');
  const i = tabs.indexOf(document.activeElement);
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  next.focus();
  next.click();
});

window.addEventListener('hashchange', () => show(location.hash.slice(1)));

initTooltips();
initDownloads();
show(location.hash.slice(1));
