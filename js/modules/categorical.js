// Categorical data: one-variable frequency tables, bar and pie charts, and
// two-way tables with marginal/conditional distributions.

import { parseLabels, fmt } from '../stats.js';
import { barChart, pieChart, segmentedBar, sideBySideBar, legend, esc, MAX_CATEGORY_COLORS } from '../plots.js';
import { $, $$, card, interp, seg, wireSegs, segValue, debounce, downloadButton } from '../ui.js';
import { categoricalSamples, twoWaySamples } from '../../data/samples.js';

const MAX_ROWS = 8;
const MAX_COLS = MAX_CATEGORY_COLORS;

export function init(root) {
  const tw = {
    rowName: '',
    colName: '',
    rows: ['Group A', 'Group B'],
    cols: ['Yes', 'No'],
    counts: [[0, 0], [0, 0]],
  };

  root.innerHTML = `
    <div class="inputs">
      <h2>Categorical Data</h2>
      <div style="margin:6px 0 14px">${seg('cmode', [{ value: 'one', label: 'One variable' }, { value: 'two', label: 'Two-way table' }], 'one')}</div>

      <div id="ct-one">
        <label class="field">Try a sample dataset
          <select id="ct-sample1"><option value="">— Choose a sample —</option>${categoricalSamples.map((s, i) => `<option value="${i}">${esc(s.title)}</option>`).join('')}</select></label>
        <label class="field">Variable name <span class="sub">(optional)</span><input type="text" id="ct-name" placeholder="e.g. favorite pizza topping"></label>
        <label class="field">How is your data entered?</label>
        <div style="margin:-6px 0 12px">${seg('entry', [{ value: 'counts', label: 'Counts' }, { value: 'raw', label: 'Raw responses' }], 'counts')}</div>
        <p class="hint" id="ct-entry-hint"></p>
        <textarea id="ct-data" rows="8" aria-label="Categorical data"></textarea>
        <p class="error" id="ct-err"></p>
      </div>

      <div id="ct-two" hidden>
        <label class="field">Try a sample dataset
          <select id="ct-sample2"><option value="">— Choose a sample —</option>${twoWaySamples.map((s, i) => `<option value="${i}">${esc(s.title)}</option>`).join('')}</select></label>
        <div class="row">
          <label class="field">Row variable <span class="sub">(explanatory)</span><input type="text" id="tw-rowname" placeholder="e.g. grade level"></label>
          <label class="field">Column variable <span class="sub">(response)</span><input type="text" id="tw-colname" placeholder="e.g. preferred app"></label>
        </div>
        <p class="hint">Type the category names in the shaded boxes and the counts in the white boxes.</p>
        <div class="tw-editor" id="tw-editor"></div>
        <div class="row">
          <button type="button" class="btn small" id="tw-addrow">+ Row</button>
          <button type="button" class="btn small" id="tw-delrow">− Row</button>
          <button type="button" class="btn small" id="tw-addcol">+ Column</button>
          <button type="button" class="btn small" id="tw-delcol">− Column</button>
        </div>
      </div>
    </div>
    <div class="results" aria-live="polite"><div id="ct-out" class="stack"></div></div>`;

  const update = debounce(draw, 250);
  // Chart choices live in the results, so keep them across redraws.
  const view = { oneChart: 'count', twoChart: 'segmented' };

  wireSegs(root, (name, value) => {
    if (name === 'cmode') {
      $('#ct-one', root).hidden = value !== 'one';
      $('#ct-two', root).hidden = value !== 'two';
    }
    if (name === 'entry') entryHint();
    if (name === 'onechart') view.oneChart = value;
    if (name === 'twochart') view.twoChart = value;
    draw();
  });

  function entryHint() {
    const counts = segValue(root, 'entry') === 'counts';
    $('#ct-entry-hint', root).textContent = counts
      ? 'Put each category on its own line followed by its count, like “Pepperoni, 14”.'
      : 'Put each person’s answer on its own line (or separate them with commas), like “Bus”. You can paste a column from Google Sheets.';
    $('#ct-data', root).placeholder = counts ? 'Pepperoni, 14\nCheese, 9\nSausage, 5' : 'Bus\nCar\nCar\nWalk\nBus';
  }

  $('#ct-data', root).addEventListener('input', update);
  $('#ct-name', root).addEventListener('input', update);
  $('#ct-sample1', root).addEventListener('change', e => {
    const s = categoricalSamples[Number(e.target.value)];
    e.target.value = '';
    if (!s) return;
    $('#ct-name', root).value = s.name;
    $('#ct-data', root).value = s.counts;
    $$('.seg[data-seg="entry"] button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === 'counts')));
    entryHint();
    draw();
  });

  // ---------- Two-way editor ----------

  function renderEditor() {
    $('#tw-rowname', root).value = tw.rowName;
    $('#tw-colname', root).value = tw.colName;
    $('#tw-editor', root).innerHTML = `<table>
      <tr><td></td>${tw.cols.map((c, j) => `<td><input class="head" data-col="${j}" value="${esc(c)}" aria-label="Column ${j + 1} name"></td>`).join('')}</tr>
      ${tw.rows.map((r, i) => `<tr><td><input class="head" data-row="${i}" value="${esc(r)}" aria-label="Row ${i + 1} name"></td>${tw.cols.map((_, j) => `<td><input type="number" min="0" step="1" data-cell="${i},${j}" value="${tw.counts[i][j] || ''}" placeholder="0" aria-label="Count for ${esc(r)}, ${esc(tw.cols[j])}"></td>`).join('')}</tr>`).join('')}
    </table>`;
    $('#tw-addrow', root).disabled = tw.rows.length >= MAX_ROWS;
    $('#tw-delrow', root).disabled = tw.rows.length <= 2;
    $('#tw-addcol', root).disabled = tw.cols.length >= MAX_COLS;
    $('#tw-delcol', root).disabled = tw.cols.length <= 2;
  }

  $('#tw-editor', root).addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.col !== undefined) tw.cols[t.dataset.col] = t.value;
    if (t.dataset.row !== undefined) tw.rows[t.dataset.row] = t.value;
    if (t.dataset.cell) {
      const [i, j] = t.dataset.cell.split(',').map(Number);
      tw.counts[i][j] = Math.max(0, Number(t.value) || 0);
    }
    update();
  });
  $('#tw-rowname', root).addEventListener('input', e => { tw.rowName = e.target.value; update(); });
  $('#tw-colname', root).addEventListener('input', e => { tw.colName = e.target.value; update(); });
  $('#tw-addrow', root).addEventListener('click', () => {
    tw.rows.push(`Group ${String.fromCharCode(65 + tw.rows.length)}`);
    tw.counts.push(tw.cols.map(() => 0));
    renderEditor(); draw();
  });
  $('#tw-delrow', root).addEventListener('click', () => { tw.rows.pop(); tw.counts.pop(); renderEditor(); draw(); });
  $('#tw-addcol', root).addEventListener('click', () => {
    tw.cols.push(`Option ${tw.cols.length + 1}`);
    tw.counts.forEach(r => r.push(0));
    renderEditor(); draw();
  });
  $('#tw-delcol', root).addEventListener('click', () => { tw.cols.pop(); tw.counts.forEach(r => r.pop()); renderEditor(); draw(); });
  $('#ct-sample2', root).addEventListener('change', e => {
    const s = twoWaySamples[Number(e.target.value)];
    e.target.value = '';
    if (!s) return;
    Object.assign(tw, { rowName: s.rowName, colName: s.colName, rows: [...s.rows], cols: [...s.cols], counts: s.counts.map(r => [...r]) });
    renderEditor();
    draw();
  });


  function draw() {
    if (segValue(root, 'cmode') === 'one') drawOne();
    else drawTwo();
  }

  // ---------- One variable ----------

  function readOne() {
    const text = $('#ct-data', root).value;
    const bad = [];
    const map = new Map();
    if (segValue(root, 'entry') === 'counts') {
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const m = line.match(/^(.*?)[\s,:;\t]+(\d+(?:\.\d+)?)\s*$/);
        if (!m || !m[1].trim()) { bad.push(line.trim()); continue; }
        const key = m[1].trim();
        map.set(key, (map.get(key) || 0) + Number(m[2]));
      }
    } else {
      for (const lab of parseLabels(text)) map.set(lab, (map.get(lab) || 0) + 1);
    }
    return { labels: [...map.keys()], counts: [...map.values()], bad };
  }

  function drawOne() {
    const out = $('#ct-out', root);
    const { labels, counts, bad } = readOne();
    $('#ct-err', root).textContent = bad.length ? `Couldn’t read: ${bad.slice(0, 3).join(' · ')}. Use “Category, count”.` : '';
    const total = counts.reduce((a, b) => a + b, 0);
    if (labels.length === 0 || total === 0) {
      out.innerHTML = '<div class="empty">Enter categories and counts (or one response per line) to see a frequency table and graphs.</div>';
      return;
    }
    const name = $('#ct-name', root).value.trim();
    const varName = name || 'category';
    const rel = counts.map(c => c / total);
    const order = counts.map((c, i) => i).sort((a, b) => counts[b] - counts[a]);
    const top = order[0];
    const tied = order.filter(i => counts[i] === counts[top]);

    const table = `<div class="table-scroll"><table class="stats">
      <thead><tr><th>${esc(name || 'Category')}</th><th>Frequency</th><th>Relative frequency</th></tr></thead>
      <tbody>${labels.map((l, i) => `<tr><td>${esc(l)}</td><td>${fmt(counts[i])}</td><td>${fmt(rel[i], 4)} (${fmt(rel[i] * 100, 1)}%)</td></tr>`).join('')}
        <tr class="total"><td>Total</td><td>${fmt(total)}</td><td>1 (100%)</td></tr></tbody>
    </table></div>`;
    const meaning = `<p>The most common ${esc(varName)} was <b>${tied.map(i => esc(labels[i])).join(' and ')}</b> (${fmt(rel[top] * 100, 1)}%${tied.length > 1 ? ' each' : ''}).</p>
      <p>${labels.map((l, i) => `${fmt(rel[i] * 100, 1)}% ${esc(l)}`).join(', ')}.</p>`;
    const work = `<p>Relative frequency = <b>count ÷ total</b>. For example, ${esc(labels[top])}: ${fmt(counts[top])} ÷ ${fmt(total)} = ${fmt(rel[top], 4)}.</p>`;

    const relative = view.oneChart === 'percent';
    let pieLabels = labels;
    let pieCounts = counts;
    if (labels.length > MAX_CATEGORY_COLORS) {
      const keep = order.slice(0, MAX_CATEGORY_COLORS - 1).sort((a, b) => a - b);
      pieLabels = [...keep.map(i => labels[i]), 'Other'];
      pieCounts = [...keep.map(i => counts[i]), counts.reduce((s, c, i) => (keep.includes(i) ? s : s + c), 0)];
    }

    out.innerHTML =
      card('Frequency table', table, { meaning, work }) +
      card('Bar chart', `<div class="plot-controls">${seg('onechart', [{ value: 'count', label: 'Counts' }, { value: 'percent', label: 'Percents' }], view.oneChart)}</div>
        ${barChart(labels, relative ? rel : counts, { relative, title: name })}`, { actions: downloadButton(`bar chart of ${varName}`) }) +
      card('Pie chart', `${pieChart(pieLabels, pieCounts, { title: name })}${legend(pieLabels)}
        ${labels.length > MAX_CATEGORY_COLORS ? '<p class="note">The smallest categories are combined into “Other” so each slice has its own color.</p>' : ''}`, { actions: downloadButton(`pie chart of ${varName}`) });
  }

  // ---------- Two-way table ----------

  function drawTwo() {
    const out = $('#ct-out', root);
    const R = tw.rows.map(r => r.trim() || '—');
    const C = tw.cols.map(c => c.trim() || '—');
    const rowTot = tw.counts.map(r => r.reduce((a, b) => a + b, 0));
    const colTot = C.map((_, j) => tw.counts.reduce((s, r) => s + r[j], 0));
    const grand = rowTot.reduce((a, b) => a + b, 0);
    if (grand === 0) {
      out.innerHTML = '<div class="empty">Fill in the counts in the two-way table to see distributions and graphs.</div>';
      return;
    }
    const rowVar = tw.rowName.trim() || 'row variable';
    const colVar = tw.colName.trim() || 'column variable';
    const pct = (a, b) => (b ? `${fmt((100 * a) / b, 1)}%` : '—');

    const counts = `<div class="table-scroll"><table class="stats">
      <thead><tr><th>${esc(tw.rowName || '')}</th>${C.map(c => `<th>${esc(c)}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${R.map((r, i) => `<tr><td><b>${esc(r)}</b></td>${tw.counts[i].map(v => `<td>${fmt(v)}</td>`).join('')}<td><b>${fmt(rowTot[i])}</b></td></tr>`).join('')}
        <tr class="total"><td>Total</td>${colTot.map(v => `<td>${fmt(v)}</td>`).join('')}<td>${fmt(grand)}</td></tr></tbody>
    </table></div>`;

    const marginal = `
      <h4>Marginal distribution of ${esc(colVar)}</h4>
      <p>${C.map((c, j) => `${esc(c)}: ${fmt(colTot[j])} ÷ ${fmt(grand)} = <b>${pct(colTot[j], grand)}</b>`).join(' · ')}</p>
      <h4>Marginal distribution of ${esc(rowVar)}</h4>
      <p>${R.map((r, i) => `${esc(r)}: ${fmt(rowTot[i])} ÷ ${fmt(grand)} = <b>${pct(rowTot[i], grand)}</b>`).join(' · ')}</p>`;

    const cond = `<p class="note" style="margin-top:0">Each row is divided by its own row total, so each row adds to 100%.</p>
      <div class="table-scroll"><table class="stats">
      <thead><tr><th>${esc(tw.rowName || '')}</th>${C.map(c => `<th>${esc(c)}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${R.map((r, i) => `<tr><td><b>${esc(r)}</b></td>${tw.counts[i].map(v => `<td>${pct(v, rowTot[i])}</td>`).join('')}<td>${rowTot[i] ? '100%' : '—'}</td></tr>`).join('')}</tbody>
    </table></div>`;

    // Biggest gap between groups for any one response category, in percentage points.
    let best = { gap: -1 };
    C.forEach((c, j) => {
      const ps = R.map((_, i) => (rowTot[i] ? tw.counts[i][j] / rowTot[i] : null)).filter(p => p !== null);
      if (ps.length < 2) return;
      const hiI = R.findIndex((_, i) => rowTot[i] && tw.counts[i][j] / rowTot[i] === Math.max(...ps));
      const loI = R.findIndex((_, i) => rowTot[i] && tw.counts[i][j] / rowTot[i] === Math.min(...ps));
      const gap = (Math.max(...ps) - Math.min(...ps)) * 100;
      if (gap > best.gap) best = { gap, j, hiI, loI };
    });
    const assoc = best.gap >= 10;
    const meaning = best.gap < 0 ? '' : `
      <p><b>${pct(tw.counts[best.hiI][best.j], rowTot[best.hiI])}</b> of the “${esc(R[best.hiI])}” group are in the “${esc(C[best.j])}” category, compared with <b>${pct(tw.counts[best.loI][best.j], rowTot[best.loI])}</b> of the “${esc(R[best.loI])}” group.</p>
      <p>${assoc
        ? `Because the conditional distributions of ${esc(colVar)} are <b>different</b> for each ${esc(rowVar)}, there <b>appears to be an association</b> between ${esc(rowVar)} and ${esc(colVar)} in this sample.`
        : `Because the conditional distributions of ${esc(colVar)} are <b>about the same</b> for each ${esc(rowVar)}, there <b>appears to be little or no association</b> between ${esc(rowVar)} and ${esc(colVar)} in this sample.`}</p>
      <p class="note">This uses a rough rule (a difference of 10 or more percentage points). Use the graph and your judgment too.</p>`;

    const chartFn = view.twoChart === 'segmented' ? segmentedBar : sideBySideBar;
    out.innerHTML =
      card('Two-way table', counts, {}) +
      card(`Conditional distributions of ${esc(colVar)} for each ${esc(rowVar)}`, cond, { meaning }) +
      card('Graph', `<div class="plot-controls">${seg('twochart', [{ value: 'segmented', label: 'Segmented bar' }, { value: 'side', label: 'Side-by-side bar' }], view.twoChart)}</div>
        ${legend(C)}${chartFn(R, C, tw.counts, { xTitle: tw.rowName })}`, { actions: downloadButton(`${view.twoChart} bar chart`) }) +
      card('Marginal distributions', marginal, {});
  }

  entryHint();
  renderEditor();
  draw();
}
