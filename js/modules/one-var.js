// One quantitative variable: summary stats, shape, outliers, plots, z-scores,
// percentiles, a resistance demo, and comparing up to 3 groups.

import { parseNumbers, summary, quartiles, guessShape, percentileOf, stemplot, fmt, zScore } from '../stats.js';
import { dotplot, histogram, boxplot, defaultBins, esc } from '../plots.js';
import { $, $$, card, interp, seg, wireSegs, debounce, context, downloadButton, sampleSelect, wireSamples } from '../ui.js';
import { meanWork, medianWork, quartileWork, sdWork, fenceWork, zWork, zDescribe, formula } from '../explain.js';
import { oneVarSamples } from '../../data/samples.js';

const MAX_GROUPS = 3;

export function init(root) {
  const state = {
    groups: [{ name: '', text: '' }],
    plot: 'dotplot',
    bins: null, // { binWidth, start } once the student edits them
    relative: false,
    split: false,
  };

  root.innerHTML = `
    <div class="inputs">
      <h2>One Quantitative Variable</h2>
      <p class="hint">Type or paste numbers separated by spaces, commas, or new lines. You can paste a column straight from Google Sheets.</p>
      ${sampleSelect(oneVarSamples)}
      <div class="row">
        <label class="field">Variable name <span class="sub">(optional)</span><input type="text" id="ov-name" placeholder="e.g. quiz score"></label>
        <label class="field">Units <span class="sub">(optional)</span><input type="text" id="ov-units" placeholder="e.g. points"></label>
      </div>
      <div id="ov-groups"></div>
      <div class="row">
        <button type="button" class="btn" id="ov-add">+ Add a group to compare</button>
        <button type="button" class="btn link" id="ov-clear">Clear all</button>
      </div>
    </div>
    <div class="results" aria-live="polite">
      <div class="empty" id="ov-empty">Enter at least 2 numbers to see statistics and graphs.</div>
      <div id="ov-out" hidden>
        <div id="ov-stats"></div>
        <div class="card" id="ov-plot-card" style="margin-top:14px">
          <h3><span>Graph</span>${downloadButton('graph')}</h3>
          <div class="plot-controls">
            ${seg('plot', [
              { value: 'dotplot', label: 'Dotplot' },
              { value: 'histogram', label: 'Histogram' },
              { value: 'boxplot', label: 'Boxplot' },
              { value: 'stemplot', label: 'Stemplot' },
            ], state.plot)}
            <span id="ov-hist-opts" hidden>
              <label>Bin width <input type="number" id="ov-bw" step="any" min="0"></label>
              <label>Start at <input type="number" id="ov-bs" step="any"></label>
              <label class="check" style="margin:0"><input type="checkbox" id="ov-rel"> Relative frequency</label>
            </span>
            <span id="ov-stem-opts" hidden>
              <label class="check" style="margin:0"><input type="checkbox" id="ov-split"> Split stems</label>
            </span>
          </div>
          <div id="ov-plot"></div>
        </div>
        <div id="ov-shape" style="margin-top:14px"></div>
        <div id="ov-outliers" style="margin-top:14px"></div>
        <div id="ov-compare" style="margin-top:14px"></div>
        <div class="card" style="margin-top:14px">
          <h3><span>z-scores and percentiles</span></h3>
          <div class="row" id="ov-z-group-row"></div>
          <div class="row">
            <label class="field">Value <input type="number" id="ov-z-x" step="any" placeholder="e.g. 85"></label>
            <label class="field">or a z-score <input type="number" id="ov-z-z" step="any" placeholder="e.g. 1.5"></label>
          </div>
          <div id="ov-z-out"><p class="note">Enter a value to find its z-score and percentile, or enter a z-score to find the value.</p></div>
        </div>
        <div class="card" style="margin-top:14px">
          <h3><span>What if one value changed? (resistance)</span></h3>
          <p class="note" style="margin:0 0 10px">Pick a value, change it, and see which statistics move a lot and which barely change.</p>
          <div class="row">
            <label class="field" id="ov-r-group-wrap">Group <select id="ov-r-group"></select></label>
            <label class="field">Change this value <select id="ov-r-pick"></select></label>
            <label class="field">to <input type="number" id="ov-r-new" step="any"></label>
          </div>
          <div id="ov-r-out"></div>
        </div>
      </div>
    </div>`;

  const groupsEl = $('#ov-groups', root);

  function renderGroupInputs() {
    const multi = state.groups.length > 1;
    groupsEl.innerHTML = state.groups.map((g, i) => `
      <div class="group-box" style="--gc: var(--series-${multi ? i + 1 : 1})">
        <div class="group-head">
          ${multi
            ? `<input type="text" data-gname="${i}" value="${esc(g.name)}" placeholder="Group ${i + 1} name" aria-label="Group ${i + 1} name">
               <button type="button" class="btn small" data-gremove="${i}" aria-label="Remove group ${i + 1}">Remove</button>`
            : '<b style="font-size:14px">Data</b>'}
        </div>
        <label class="sr-only" for="ov-data-${i}">Data for group ${i + 1}</label>
        <textarea id="ov-data-${i}" data-gtext="${i}" rows="4" placeholder="e.g. 72 85 90 64 88">${esc(g.text)}</textarea>
        <p class="error" data-gerr="${i}"></p>
      </div>`).join('');
    $('#ov-add', root).disabled = state.groups.length >= MAX_GROUPS;
  }

  const update = debounce(recompute, 250);

  groupsEl.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.gname !== undefined) state.groups[t.dataset.gname].name = t.value;
    if (t.dataset.gtext !== undefined) state.groups[t.dataset.gtext].text = t.value;
    update();
  });
  groupsEl.addEventListener('click', e => {
    const b = e.target.closest('[data-gremove]');
    if (!b) return;
    state.groups.splice(Number(b.dataset.gremove), 1);
    renderGroupInputs();
    recompute();
  });
  $('#ov-add', root).addEventListener('click', () => {
    if (state.groups.length >= MAX_GROUPS) return;
    state.groups.push({ name: '', text: '' });
    renderGroupInputs();
    $(`#ov-data-${state.groups.length - 1}`, root).focus();
  });
  $('#ov-clear', root).addEventListener('click', () => {
    state.groups = [{ name: '', text: '' }];
    $('#ov-name', root).value = '';
    $('#ov-units', root).value = '';
    state.bins = null;
    renderGroupInputs();
    recompute();
  });
  $('#ov-name', root).addEventListener('input', update);
  $('#ov-units', root).addEventListener('input', update);

  wireSamples(root, oneVarSamples, s => {
    state.groups = s.groups.map(g => ({ name: g.name, text: g.values }));
    $('#ov-name', root).value = s.name;
    $('#ov-units', root).value = s.units;
    state.bins = null;
    renderGroupInputs();
    recompute();
  });

  wireSegs($('#ov-plot-card', root), (name, value) => {
    state.plot = value;
    drawPlot();
  });
  $('#ov-bw', root).addEventListener('input', () => {
    const bw = Number($('#ov-bw', root).value);
    if (bw > 0) { state.bins = { binWidth: bw, start: Number($('#ov-bs', root).value) || 0 }; drawPlot(); }
  });
  $('#ov-bs', root).addEventListener('input', () => {
    const bw = Number($('#ov-bw', root).value);
    const bs = $('#ov-bs', root).value;
    if (bw > 0 && bs !== '') { state.bins = { binWidth: bw, start: Number(bs) }; drawPlot(); }
  });
  $('#ov-rel', root).addEventListener('change', e => { state.relative = e.target.checked; drawPlot(); });
  $('#ov-split', root).addEventListener('change', e => { state.split = e.target.checked; drawPlot(); });

  // z-score tool: typing in one box clears the other.
  $('#ov-z-x', root).addEventListener('input', () => { $('#ov-z-z', root).value = ''; drawZ(); });
  $('#ov-z-z', root).addEventListener('input', () => { $('#ov-z-x', root).value = ''; drawZ(); });
  root.addEventListener('change', e => {
    if (e.target.id === 'ov-z-group') drawZ();
    if (e.target.id === 'ov-r-group') { fillResistPicker(); drawResist(); }
    if (e.target.id === 'ov-r-pick') { setDefaultNewValue(); drawResist(); }
  });
  $('#ov-r-new', root).addEventListener('input', drawResist);

  // ---------- Computation ----------

  let data = []; // [{ name, values, st }]
  let ctx = context('', '');

  function recompute() {
    ctx = context($('#ov-name', root).value, $('#ov-units', root).value);
    data = [];
    state.groups.forEach((g, i) => {
      const { values, bad } = parseNumbers(g.text);
      const err = $(`[data-gerr="${i}"]`, root);
      if (err) err.textContent = bad.length ? `Ignored (not numbers): ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? '…' : ''}` : '';
      if (values.length >= 2) data.push({ name: g.name.trim() || (state.groups.length > 1 ? `Group ${i + 1}` : ''), values, st: summary(values) });
    });
    const ok = data.length > 0;
    $('#ov-empty', root).hidden = ok;
    $('#ov-out', root).hidden = !ok;
    if (!ok) return;
    if (!state.bins) {
      const all = data.flatMap(d => d.values);
      const b = defaultBins(all);
      $('#ov-bw', root).value = fmt(b.binWidth).replace('−', '-');
      $('#ov-bs', root).value = fmt(b.start).replace('−', '-');
    }
    drawStats();
    drawPlot();
    drawShape();
    drawOutliers();
    drawCompare();
    fillGroupSelects();
    drawZ();
    drawResist();
  }

  const multi = () => data.length > 1;
  const label = d => (d.name ? esc(d.name) : '');

  function drawStats() {
    const rows = [
      ['n', 'Sample size', d => d.st.n],
      ['x̄', 'Mean', d => fmt(d.st.mean)],
      ['s<sub>x</sub>', 'Standard deviation (sample)', d => fmt(d.st.sx)],
      ['σ<sub>x</sub>', 'Standard deviation (population)', d => fmt(d.st.sigma)],
      ['s²', 'Variance (sample)', d => fmt(d.st.varSample)],
      ['Min', 'Minimum', d => fmt(d.st.min)],
      ['Q1', 'First quartile', d => fmt(d.st.q1)],
      ['Med', 'Median', d => fmt(d.st.median)],
      ['Q3', 'Third quartile', d => fmt(d.st.q3)],
      ['Max', 'Maximum', d => fmt(d.st.max)],
      ['Range', 'Max − Min', d => fmt(d.st.range)],
      ['IQR', 'Q3 − Q1', d => fmt(d.st.iqr)],
    ];
    const table = `<div class="table-scroll"><table class="stats">
      <thead><tr><th>Statistic</th>${data.map(d => `<th>${multi() ? label(d) : 'Value'}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(([sym, name, get]) => `<tr><td class="lbl"><b>${sym}</b> · ${name}</td>${data.map(d => `<td>${get(d)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;

    const d0 = data[0];
    const meaning = multi()
      ? '<p>Use the comparison card below to compare the groups.</p>'
      : `<p><b>Mean:</b> The mean ${ctx.name} is ${fmt(d0.st.mean, 2)}${ctx.units}.</p>
         <p><b>Median:</b> The median ${ctx.name} is ${fmt(d0.st.median, 2)}${ctx.units}, so about half of the ${ctx.plural} are at or below ${fmt(d0.st.median, 2)}${ctx.units} and about half are at or above it.</p>
         <p><b>Standard deviation:</b> ${ctx.Name} typically varies by about ${fmt(d0.st.sx, 2)}${ctx.units} from the mean of ${fmt(d0.st.mean, 2)}${ctx.units}.</p>
         <p><b>IQR:</b> The middle 50% of the ${ctx.plural} have a range of ${fmt(d0.st.iqr, 2)}${ctx.units}.</p>`;

    const work = data.map(d => {
      const { lower, upper } = quartiles(d.values);
      const body = meanWork(d.values) + medianWork(d.values) + quartileWork(d.st, lower, upper) + sdWork(d.values);
      return multi() ? `<details class="work"><summary>${label(d)}</summary><div class="inner">${body}</div></details>` : body;
    }).join('');

    $('#ov-stats', root).innerHTML = card('Summary statistics', table, { meaning, work });
  }

  function drawPlot() {
    if (!data.length) return;
    $$('.seg[data-seg="plot"] button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === state.plot)));
    $('#ov-hist-opts', root).hidden = state.plot !== 'histogram';
    $('#ov-stem-opts', root).hidden = state.plot !== 'stemplot';
    const title = `${ctx.hasName ? ctx.name : 'Value'}${ctx.units ? ` (${ctx.units.trim()})` : ''}`;
    const groups = data.map(d => ({ name: d.name, values: d.values }));
    const out = $('#ov-plot', root);
    $('[data-download]', $('#ov-plot-card', root)).dataset.download = `${state.plot} of ${ctx.name}`;
    $('[data-download]', $('#ov-plot-card', root)).hidden = state.plot === 'stemplot';

    if (state.plot === 'dotplot') out.innerHTML = dotplot(groups, { title });
    if (state.plot === 'boxplot') {
      out.innerHTML = boxplot(groups, { title }) + '<p class="note">Outliers (by the 1.5 × IQR rule) are drawn as open circles. Whiskers go to the smallest and largest values that are not outliers.</p>';
    }
    if (state.plot === 'histogram') {
      const binWidth = Number($('#ov-bw', root).value);
      const start = Number($('#ov-bs', root).value);
      if (!(binWidth > 0) || !Number.isFinite(start)) { out.innerHTML = '<p class="error">Enter a bin width greater than 0.</p>'; return; }
      const max = Math.max(...groups.flatMap(g => g.values));
      const min = Math.min(...groups.flatMap(g => g.values));
      if ((max - start) / binWidth > 300) { out.innerHTML = '<p class="error">That bin width makes too many bars. Try a bigger bin width.</p>'; return; }
      out.innerHTML = groups.map(g => `${g.name ? `<h4>${esc(g.name)}</h4>` : ''}${histogram(g.values, { binWidth, start, max, relative: state.relative, title })}`).join('')
        + (start > min ? '<p class="error">Some values are below the starting point and are not shown. Lower “Start at”.</p>' : '')
        + (multi() ? '<p class="note">Each group uses the same bins and scale so you can compare them. Download saves the first graph.</p>' : '');
    }
    if (state.plot === 'stemplot') {
      out.innerHTML = `<div class="grid-2">${groups.map(g => stemplotHtml(g)).join('')}</div>`;
    }
  }

  function stemplotHtml(g) {
    const { rows, leafUnit } = stemplot(g.values, { split: state.split });
    const ex = rows.find(r => r.leaves.length);
    const keyStem = ex ? ex.label : '1';
    const keyLeaf = ex ? ex.leaves[0] : 2;
    const keyVal = (ex?.neg ? -1 : 1) * (Math.abs(Number(keyStem)) * 10 + keyLeaf) * leafUnit;
    return `<div>${g.name ? `<h4>${esc(g.name)}</h4>` : ''}
      <table class="stemplot" aria-label="Stemplot">${rows.map(r => `<tr><td class="stem">${r.label}</td><td class="leaves">${r.leaves.join('')}</td></tr>`).join('')}</table>
      <p class="note">Key: ${keyStem} | ${keyLeaf} = ${fmt(keyVal)}${ctx.units}</p></div>`;
  }

  function drawShape() {
    const items = data.map(d => {
      const g = guessShape(d.values);
      return `<p>${multi() ? `<b>${label(d)}:</b> ` : ''}<span class="pill">${g.label}</span> ${g.reason}</p>`;
    }).join('');
    const d0 = data[0];
    const g0 = guessShape(d0.values);
    const skewed = g0.label.startsWith('skewed');
    const outs = [...d0.st.lowOutliers, ...d0.st.highOutliers];
    const center = skewed ? `a median of ${fmt(d0.st.median, 2)}${ctx.units}` : `a mean of ${fmt(d0.st.mean, 2)}${ctx.units}`;
    const spread = skewed ? `an IQR of ${fmt(d0.st.iqr, 2)}${ctx.units}` : `a standard deviation of ${fmt(d0.st.sx, 2)}${ctx.units}`;
    const meaning = multi()
      ? '<p>Look at each group’s graph to check the shape. See the comparison card below.</p>'
      : `<p><b>Describe the distribution (SOCV):</b> The distribution of ${ctx.name} is <b>${g0.label}</b> with ${center} and ${spread}. ${outs.length ? `There ${outs.length === 1 ? 'is an outlier' : 'are outliers'} at ${outs.map(v => fmt(v)).join(', ')}${ctx.units}.` : 'There are no outliers.'}</p>
         <p class="note">${skewed
           ? 'Because the shape is skewed, the median and IQR are better choices for center and variability. They are resistant to the long tail.'
           : 'Because the shape is roughly symmetric, the mean and standard deviation are good choices for center and variability.'}</p>`;
    $('#ov-shape', root).innerHTML = card('Shape', `${items}<p class="note">This is the computer’s best guess. Always check it against the graph.</p>`, { meaning });
  }

  function drawOutliers() {
    const body = data.map(d => {
      const outs = [...d.st.lowOutliers, ...d.st.highOutliers];
      return `<p>${multi() ? `<b>${label(d)}:</b> ` : ''}${outs.length ? `Outliers: <b>${outs.map(v => fmt(v)).join(', ')}</b>` : 'No outliers'} (fences ${fmt(d.st.lowFence)} and ${fmt(d.st.highFence)})</p>`;
    }).join('');
    const work = data.map(d => (multi() ? `<h4>${label(d)}</h4>` : '') + fenceWork(d.st)).join('');
    $('#ov-outliers', root).innerHTML = card('Outliers (1.5 × IQR rule)', body, { work });
  }

  function drawCompare() {
    const el = $('#ov-compare', root);
    if (!multi()) { el.innerHTML = ''; return; }
    const by = key => [...data].sort((a, b) => b.st[key] - a.st[key]);
    const med = by('median');
    const iqr = by('iqr');
    const shapes = data.map(d => `${label(d)} appears ${guessShape(d.values).label}`).join('; ');
    const outs = data.map(d => {
      const o = [...d.st.lowOutliers, ...d.st.highOutliers];
      return `${label(d)} has ${o.length ? `outlier${o.length > 1 ? 's' : ''} at ${o.map(v => fmt(v)).join(', ')}` : 'no outliers'}`;
    }).join('; ');
    const body = `
      <p><b>Shape:</b> ${shapes}.</p>
      <p><b>Center:</b> The median ${ctx.name} for ${label(med[0])} (${fmt(med[0].st.median, 2)}${ctx.units}) is ${med[0].st.median === med[med.length - 1].st.median ? 'the same as' : 'greater than'} the median for ${label(med[med.length - 1])} (${fmt(med[med.length - 1].st.median, 2)}${ctx.units}).</p>
      <p><b>Variability:</b> The ${ctx.plural} for ${label(iqr[0])} are more variable (IQR = ${fmt(iqr[0].st.iqr, 2)}${ctx.units}) than for ${label(iqr[iqr.length - 1])} (IQR = ${fmt(iqr[iqr.length - 1].st.iqr, 2)}${ctx.units}).</p>
      <p><b>Outliers:</b> ${outs}.</p>`;
    el.innerHTML = card('Comparing the groups', interp(body, 'Sentence frames: compare SOCV'), {});
  }

  function fillGroupSelects() {
    const opts = data.map((d, i) => `<option value="${i}">${label(d) || 'Data'}</option>`).join('');
    const zRow = $('#ov-z-group-row', root);
    const prevZ = $('#ov-z-group', root)?.value || '0';
    zRow.innerHTML = multi() ? `<label class="field">Group <select id="ov-z-group">${opts}</select></label>` : '';
    if (multi()) $('#ov-z-group', root).value = Math.min(Number(prevZ), data.length - 1);
    const rSel = $('#ov-r-group', root);
    const prevR = rSel.value || '0';
    rSel.innerHTML = opts;
    rSel.value = Math.min(Number(prevR), data.length - 1);
    $('#ov-r-group-wrap', root).hidden = !multi();
    fillResistPicker();
  }

  function drawZ() {
    const d = data[Number($('#ov-z-group', root)?.value || 0)];
    const out = $('#ov-z-out', root);
    if (!d) return;
    const xs = $('#ov-z-x', root).value;
    const zs = $('#ov-z-z', root).value;
    const { mean: m, sx: s } = d.st;
    if (xs !== '') {
      const x = Number(xs);
      const z = zScore(x, m, s);
      const p = percentileOf(d.values, x);
      out.innerHTML = `
        <div class="grid-2">
          <div><div class="note">z-score</div><div class="big">${fmt(z, 4)}</div></div>
          <div><div class="note">Percentile</div><div class="big">${fmt(p.less, 1)}%</div></div>
        </div>
        ${interp(`<p>${zDescribe(z, x, ctx)}</p><p>${fmt(p.less, 1)}% of the ${ctx.plural} are less than ${fmt(x)}${ctx.units}, so ${fmt(x)} is at about the ${ordinal(Math.round(p.less))} percentile.</p>`)}
        <details class="work"><summary>Show work</summary><div class="inner">
          ${zWork(x, m, s)}
          ${formula(`Percentile = <span class="eq">(number of values less than ${fmt(x)}) ÷ n</span> = ${p.countLess} ÷ ${d.st.n} = <b>${fmt(p.less, 1)}%</b>`)}
          <p class="note">Some books count values “less than or equal to.” That would give ${p.countAtOrBelow} ÷ ${d.st.n} = ${fmt(p.atOrBelow, 1)}%.</p>
        </div></details>`;
    } else if (zs !== '') {
      const z = Number(zs);
      const x = m + z * s;
      out.innerHTML = `
        <div class="note">Value</div><div class="big">${fmt(x, 4)}${ctx.units}</div>
        ${interp(`<p>A ${ctx.name} that is ${fmt(Math.abs(z))} standard deviation${Math.abs(z) === 1 ? '' : 's'} ${z >= 0 ? 'above' : 'below'} the mean is ${fmt(x, 2)}${ctx.units}.</p>`)}
        <details class="work"><summary>Show work</summary><div class="inner">
          ${formula(`value = <span class="eq">x̄ + z · s</span> = ${fmt(m)} + (${fmt(z)})(${fmt(s)}) = <b>${fmt(x)}</b>`)}
        </div></details>`;
    } else {
      out.innerHTML = '<p class="note">Enter a value to find its z-score and percentile, or enter a z-score to find the value.</p>';
    }
  }

  function fillResistPicker() {
    const d = data[Number($('#ov-r-group', root).value || 0)];
    if (!d) return;
    const pick = $('#ov-r-pick', root);
    const prev = pick.value;
    const sortedVals = [...d.values].sort((a, b) => a - b);
    pick.innerHTML = sortedVals.map((v, i) => `<option value="${i}">${fmt(v)}${i === sortedVals.length - 1 ? ' (largest)' : i === 0 ? ' (smallest)' : ''}</option>`).join('');
    pick.value = prev !== '' && Number(prev) < sortedVals.length ? prev : String(sortedVals.length - 1);
    if (prev === '' || $('#ov-r-new', root).value === '') setDefaultNewValue();
  }

  function setDefaultNewValue() {
    const d = data[Number($('#ov-r-group', root).value || 0)];
    if (!d) return;
    const sortedVals = [...d.values].sort((a, b) => a - b);
    const v = sortedVals[Number($('#ov-r-pick', root).value)];
    // Suggest a dramatic change so the effect is easy to see.
    $('#ov-r-new', root).value = Number((v + 3 * d.st.range || v + 10).toPrecision(6));
  }

  function drawResist() {
    const d = data[Number($('#ov-r-group', root).value || 0)];
    const out = $('#ov-r-out', root);
    if (!d) return;
    const nv = $('#ov-r-new', root).value;
    if (nv === '') { out.innerHTML = ''; return; }
    const sortedVals = [...d.values].sort((a, b) => a - b);
    const idx = Number($('#ov-r-pick', root).value);
    const changed = sortedVals.map((v, i) => (i === idx ? Number(nv) : v));
    const a = d.st;
    const b = summary(changed);
    const rows = [['Mean', 'mean'], ['Standard deviation', 'sx'], ['Median', 'median'], ['IQR', 'iqr']];
    const pct = (x, y) => (x === 0 ? (y === 0 ? 0 : Infinity) : Math.abs((y - x) / x) * 100);
    out.innerHTML = `<div class="table-scroll"><table class="stats">
      <thead><tr><th>Statistic</th><th>Original</th><th>Changed</th><th>Change</th></tr></thead>
      <tbody>${rows.map(([n, k]) => `<tr><td class="lbl"><b>${n}</b></td><td>${fmt(a[k])}</td><td>${fmt(b[k])}</td><td>${fmt(b[k] - a[k])} (${fmt(pct(a[k], b[k]), 1)}%)</td></tr>`).join('')}</tbody>
    </table></div>
    ${interp('<p>The <b>mean and standard deviation</b> use every value, so one unusual value can pull them a lot. They are <b>not resistant</b>.</p><p>The <b>median and IQR</b> only depend on the middle of the ordered data, so they barely change. They are <b>resistant</b> to outliers.</p>', 'Notice')}`;
  }

  renderGroupInputs();
  recompute();
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
