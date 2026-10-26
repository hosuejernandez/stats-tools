// Simulation-based significance: one proportion (chance model), and
// difference in means / proportions (re-randomizing group labels).
// Students choose how many simulations to run; runs add to the existing results.

import { parseNumbers, mean, binomialDraw, shuffleInPlace, fmt } from '../stats.js';
import { dotplot, esc } from '../plots.js';
import { $, $$, card, interp, seg, wireSegs, segValue, downloadButton, sampleSelect, wireSamples } from '../ui.js';
import { formula } from '../explain.js';
import { simulationSamples } from '../../data/samples.js';

const MAX_PER_RUN = 10000;
const MAX_TOTAL = 20000;
const EPS = 1e-9;

export function init(root) {
  root.innerHTML = `
    <div class="inputs">
      <h2>Simulation: Is it statistically significant?</h2>
      <p class="hint">Simulate what would happen by chance alone, then see how often chance gives a result as extreme as yours.</p>
      ${sampleSelect(simulationSamples)}
      <label class="field">What are you testing?</label>
      <div style="margin:-6px 0 14px">${seg('smode', [
        { value: 'one-prop', label: 'One proportion' },
        { value: 'diff-means', label: 'Two means' },
        { value: 'diff-props', label: 'Two proportions' },
      ], 'one-prop')}</div>

      <div id="sm-one" data-mode="one-prop">
        <label class="field">What counts as a success? <input type="text" id="sm-success" placeholder="e.g. correct guesses"></label>
        <div class="row">
          <label class="field">Claimed proportion (p) <input type="number" id="sm-p0" step="any" min="0" max="1" value="0.5"></label>
          <label class="field">Sample size (n) <input type="number" id="sm-n" step="1" min="1" value="20"></label>
          <label class="field">Observed successes <input type="number" id="sm-obs" step="1" min="0" value="15"></label>
        </div>
        <label class="field">Show the statistic as</label>
        <div style="margin:-6px 0 14px">${seg('stat', [{ value: 'count', label: 'Count' }, { value: 'prop', label: 'Proportion (p̂)' }], 'count')}</div>
      </div>

      <div id="sm-means" data-mode="diff-means" hidden>
        <label class="field">What was measured? <input type="text" id="sm-measure" placeholder="e.g. words remembered"></label>
        <div class="group-box" style="--gc: var(--series-1)">
          <label class="field">Group A name <input type="text" id="sm-aname" value="Group A"></label>
          <label class="field">Group A values <textarea id="sm-a" rows="3" placeholder="12 15 9 14"></textarea></label>
        </div>
        <div class="group-box" style="--gc: var(--series-2)">
          <label class="field">Group B name <input type="text" id="sm-bname" value="Group B"></label>
          <label class="field">Group B values <textarea id="sm-b" rows="3" placeholder="10 8 11 9"></textarea></label>
        </div>
      </div>

      <div id="sm-props" data-mode="diff-props" hidden>
        <label class="field">What counts as a success? <input type="text" id="sm-psuccess" placeholder="e.g. yawned"></label>
        <div class="group-box" style="--gc: var(--series-1)">
          <label class="field">Group A name <input type="text" id="sm-paname" value="Group A"></label>
          <div class="row">
            <label class="field">Successes <input type="number" id="sm-pax" min="0" step="1"></label>
            <label class="field">Group size <input type="number" id="sm-pan" min="1" step="1"></label>
          </div>
        </div>
        <div class="group-box" style="--gc: var(--series-2)">
          <label class="field">Group B name <input type="text" id="sm-pbname" value="Group B"></label>
          <div class="row">
            <label class="field">Successes <input type="number" id="sm-pbx" min="0" step="1"></label>
            <label class="field">Group size <input type="number" id="sm-pbn" min="1" step="1"></label>
          </div>
        </div>
      </div>

      <label class="field" id="sm-dir-label"></label>
      <div style="margin:-6px 0 14px" id="sm-dir-wrap"></div>
      <label class="field">Significance level (α) <input type="number" id="sm-alpha" step="any" min="0" max="1" value="0.05"></label>
      <p class="error" id="sm-err"></p>
    </div>
    <div class="results" aria-live="polite">
      <div id="sm-setup"></div>
      <div class="card" id="sm-sim-card" style="margin-top:14px">
        <h3><span>Run the simulation</span>${downloadButton('simulation dotplot')}</h3>
        <div class="sim-buttons">
          <span class="note" style="margin:0">Run</span>
          <button type="button" class="btn small" data-run="1">1</button>
          <button type="button" class="btn small" data-run="10">10</button>
          <button type="button" class="btn small" data-run="100">100</button>
          <button type="button" class="btn small" data-run="1000">1000</button>
          <span class="note" style="margin:0 0 0 6px">or</span>
          <input type="number" id="sm-custom" min="1" max="${MAX_PER_RUN}" step="1" placeholder="how many?" style="width:110px" aria-label="Number of simulations">
          <button type="button" class="btn small primary" id="sm-run-custom">Run</button>
          <button type="button" class="btn small" id="sm-reset">Reset</button>
        </div>
        <p class="sim-count" id="sm-count"></p>
        <div id="sm-plot"></div>
        <div id="sm-result"></div>
      </div>
      <div id="sm-conclusion" style="margin-top:14px"></div>
    </div>`;

  let sims = []; // simulated statistics (for one-prop: counts)
  let model = null;

  const mode = () => segValue(root, 'smode');

  function dirOptions() {
    return [
      { value: 'greater', label: 'Greater (&gt;)' },
      { value: 'less', label: 'Less (&lt;)' },
      { value: 'two', label: 'Different (≠)' },
    ];
  }

  function renderDir(selected) {
    const cur = selected || segValue(root, 'dir') || 'greater';
    $('#sm-dir-wrap', root).innerHTML = seg('dir', dirOptions(), cur);
    $('#sm-dir-label', root).textContent = mode() === 'one-prop'
      ? 'Alternative hypothesis: the true proportion is…'
      : 'Alternative hypothesis: compared with Group B, Group A’s true value is…';
  }

  wireSegs(root, name => {
    if (name === 'smode') {
      $$('[data-mode]', root).forEach(el => { el.hidden = el.dataset.mode !== mode(); });
      renderDir();
    }
    if (name === 'stat' || name === 'dir') { draw(); return; } // same model, so keep the simulations
    rebuild();
  });
  $$('.inputs input, .inputs textarea', root).forEach(el => el.addEventListener('input', () => {
    if (el.id === 'sm-alpha') { draw(); return; }
    rebuild();
  }));

  wireSamples(root, simulationSamples, s => {
    $$('.seg[data-seg="smode"] button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === s.mode)));
    $$('[data-mode]', root).forEach(el => { el.hidden = el.dataset.mode !== s.mode; });
    if (s.mode === 'one-prop') {
      $('#sm-success', root).value = s.success;
      $('#sm-p0', root).value = s.p0;
      $('#sm-n', root).value = s.n;
      $('#sm-obs', root).value = s.observed;
    } else if (s.mode === 'diff-means') {
      $('#sm-aname', root).value = s.aName;
      $('#sm-bname', root).value = s.bName;
      $('#sm-a', root).value = s.a;
      $('#sm-b', root).value = s.b;
      $('#sm-measure', root).value = s.measure;
    } else {
      $('#sm-paname', root).value = s.aName;
      $('#sm-pbname', root).value = s.bName;
      $('#sm-pax', root).value = s.aSuccess;
      $('#sm-pan', root).value = s.aSize;
      $('#sm-pbx', root).value = s.bSuccess;
      $('#sm-pbn', root).value = s.bSize;
      $('#sm-psuccess', root).value = s.success;
    }
    renderDir(s.direction);
    rebuild();
  });

  $$('[data-run]', root).forEach(b => b.addEventListener('click', () => run(Number(b.dataset.run))));
  $('#sm-run-custom', root).addEventListener('click', () => run(Number($('#sm-custom', root).value)));
  $('#sm-custom', root).addEventListener('keydown', e => { if (e.key === 'Enter') run(Number($('#sm-custom', root).value)); });
  $('#sm-reset', root).addEventListener('click', () => { sims = []; draw(); });

  // ---------- Model ----------

  function readModel() {
    const m = mode();
    if (m === 'one-prop') {
      const p0 = Number($('#sm-p0', root).value);
      const n = Number($('#sm-n', root).value);
      const obs = Number($('#sm-obs', root).value);
      if (!(p0 > 0 && p0 < 1)) return { error: 'The claimed proportion must be between 0 and 1.' };
      if (!Number.isInteger(n) || n < 1 || n > 5000) return { error: 'The sample size must be a whole number from 1 to 5000.' };
      if ($('#sm-obs', root).value === '' || !Number.isInteger(obs) || obs < 0 || obs > n) return { error: `The observed successes must be a whole number from 0 to ${n}.` };
      const success = $('#sm-success', root).value.trim() || 'successes';
      return { m, p0, n, obs, success, center: n * p0, simulate: () => binomialDraw(n, p0) };
    }
    if (m === 'diff-means') {
      const a = parseNumbers($('#sm-a', root).value).values;
      const b = parseNumbers($('#sm-b', root).value).values;
      if (a.length < 2 || b.length < 2) return { error: 'Enter at least 2 values in each group.' };
      const pooled = [...a, ...b];
      const nA = a.length;
      return {
        m, a, b,
        aName: $('#sm-aname', root).value.trim() || 'Group A',
        bName: $('#sm-bname', root).value.trim() || 'Group B',
        measure: $('#sm-measure', root).value.trim() || 'response',
        obs: mean(a) - mean(b),
        center: 0,
        simulate: () => {
          shuffleInPlace(pooled);
          return mean(pooled.slice(0, nA)) - mean(pooled.slice(nA));
        },
      };
    }
    const ax = Number($('#sm-pax', root).value);
    const an = Number($('#sm-pan', root).value);
    const bx = Number($('#sm-pbx', root).value);
    const bn = Number($('#sm-pbn', root).value);
    if (![ax, an, bx, bn].every(Number.isInteger) || $('#sm-pan', root).value === '' || $('#sm-pbn', root).value === '' || an < 1 || bn < 1) return { error: 'Enter whole-number successes and group sizes for both groups.' };
    if (ax > an || bx > bn || ax < 0 || bx < 0) return { error: 'Successes can’t be more than the group size.' };
    if (an + bn > 20000) return { error: 'The groups are too big to simulate here.' };
    const pooled = [...Array(ax + bx).fill(1), ...Array(an + bn - ax - bx).fill(0)];
    return {
      m, ax, an, bx, bn,
      aName: $('#sm-paname', root).value.trim() || 'Group A',
      bName: $('#sm-pbname', root).value.trim() || 'Group B',
      success: $('#sm-psuccess', root).value.trim() || 'success',
      obs: ax / an - bx / bn,
      center: 0,
      simulate: () => {
        shuffleInPlace(pooled);
        let s = 0;
        for (let i = 0; i < an; i++) s += pooled[i];
        return s / an - (ax + bx - s) / bn;
      },
    };
  }

  function rebuild() {
    model = readModel();
    sims = [];
    draw();
  }

  function run(k) {
    if (!model || model.error) return;
    if (!(k >= 1)) return;
    k = Math.min(Math.floor(k), MAX_PER_RUN, MAX_TOTAL - sims.length);
    for (let i = 0; i < k; i++) sims.push(model.simulate());
    draw();
  }

  // Does a simulated statistic count as "at least as extreme" as what was observed?
  function extreme(v) {
    const dir = segValue(root, 'dir');
    if (dir === 'greater') return v >= model.obs - EPS;
    if (dir === 'less') return v <= model.obs + EPS;
    return Math.abs(v - model.center) >= Math.abs(model.obs - model.center) - EPS;
  }

  // ---------- Drawing ----------

  function draw() {
    const err = $('#sm-err', root);
    const setup = $('#sm-setup', root);
    const simCard = $('#sm-sim-card', root);
    const concl = $('#sm-conclusion', root);
    if (!model) model = readModel();
    if (model.error) {
      err.textContent = model.error;
      setup.innerHTML = `<div class="empty">${esc(model.error)}</div>`;
      simCard.hidden = true;
      concl.innerHTML = '';
      return;
    }
    err.textContent = '';
    simCard.hidden = false;
    const dir = segValue(root, 'dir');
    const alpha = Number($('#sm-alpha', root).value) || 0.05;
    const sign = { greater: '&gt;', less: '&lt;', two: '≠' }[dir];
    const asProp = model.m === 'one-prop' && segValue(root, 'stat') === 'prop';
    const show = v => (asProp ? v / model.n : v);
    const statName = model.m === 'one-prop' ? (asProp ? 'p̂' : 'count') : model.m === 'diff-means' ? 'x̄<sub>A</sub> − x̄<sub>B</sub>' : 'p̂<sub>A</sub> − p̂<sub>B</sub>';
    const statPlain = model.m === 'one-prop' ? (asProp ? 'proportion of ' + model.success : 'number of ' + model.success) : model.m === 'diff-means' ? `difference in mean ${model.measure} (${model.aName} − ${model.bName})` : `difference in proportion who ${model.success} (${model.aName} − ${model.bName})`;

    // Setup card: hypotheses, observed statistic, and how one trial works.
    let hyp;
    let how;
    let obsLine;
    if (model.m === 'one-prop') {
      hyp = `H₀: p = ${fmt(model.p0)}<br>Hₐ: p ${sign} ${fmt(model.p0)}`;
      obsLine = asProp
        ? `p̂ = ${model.obs} ÷ ${model.n} = <b>${fmt(model.obs / model.n, 4)}</b>`
        : `Observed count = <b>${model.obs}</b> ${esc(model.success)} out of ${model.n}`;
      how = `Each dot is one simulated sample of ${model.n} trials where every trial has a ${fmt(model.p0)} chance of being a success, the way it would be if H₀ were true. The dot shows how many ${esc(model.success)} that sample got${asProp ? ' (as a proportion)' : ''}.`;
    } else if (model.m === 'diff-means') {
      hyp = `H₀: μ<sub>A</sub> − μ<sub>B</sub> = 0<br>Hₐ: μ<sub>A</sub> − μ<sub>B</sub> ${sign} 0`;
      obsLine = `x̄<sub>A</sub> − x̄<sub>B</sub> = ${fmt(mean(model.a))} − ${fmt(mean(model.b))} = <b>${fmt(model.obs, 4)}</b>`;
      how = `If H₀ is true, the group a person was in doesn’t matter. Each dot shuffles all ${model.a.length + model.b.length} values, deals them back into groups of ${model.a.length} and ${model.b.length} at random, and records the difference in means.`;
    } else {
      hyp = `H₀: p<sub>A</sub> − p<sub>B</sub> = 0<br>Hₐ: p<sub>A</sub> − p<sub>B</sub> ${sign} 0`;
      obsLine = `p̂<sub>A</sub> − p̂<sub>B</sub> = ${model.ax}/${model.an} − ${model.bx}/${model.bn} = ${fmt(model.ax / model.an, 4)} − ${fmt(model.bx / model.bn, 4)} = <b>${fmt(model.obs, 4)}</b>`;
      how = `If H₀ is true, the group doesn’t matter. Each dot shuffles the ${model.ax + model.bx} ${esc(model.success)} results and ${model.an + model.bn - model.ax - model.bx} non-results, deals them back into groups of ${model.an} and ${model.bn} at random, and records the difference in proportions.`;
    }
    const legendLine = model.m === 'one-prop' ? '' : `<p class="note">A = ${esc(model.aName)}, B = ${esc(model.bName)}</p>`;
    setup.innerHTML = card('The setup', `
      <div class="grid-2">
        <div><h4 style="margin-top:0">Hypotheses</h4><div class="formula">${hyp}</div>${legendLine}</div>
        <div><h4 style="margin-top:0">Observed statistic</h4><div class="formula">${obsLine}</div></div>
      </div>
      ${interp(`<p>${how}</p>`, 'How the simulation works')}`);

    // Simulation results
    const N = sims.length;
    $('#sm-count', root).innerHTML = N ? `<b>${N.toLocaleString()}</b> simulation${N === 1 ? '' : 's'} so far${N >= MAX_TOTAL ? ` (the maximum is ${MAX_TOTAL.toLocaleString()})` : ''}.` : 'No simulations yet. Click a button to run some.';
    $$('[data-run], #sm-run-custom', root).forEach(b => { b.disabled = N >= MAX_TOTAL; });
    const obsShown = show(model.obs);
    if (N === 0) {
      $('#sm-plot', root).innerHTML = '';
      $('#sm-result', root).innerHTML = '';
      concl.innerHTML = '';
      return;
    }
    const k = sims.filter(extreme).length;
    const pval = k / N;
    const tailWords = dir === 'greater' ? `greater than or equal to ${fmt(obsShown, 4)}` : dir === 'less' ? `less than or equal to ${fmt(obsShown, 4)}` : `at least as far from ${fmt(show(model.center), 4)} as ${fmt(obsShown, 4)} (in either direction)`;
    $('#sm-plot', root).innerHTML = dotplot([{ name: '', values: sims.map(show) }], {
      title: `Simulated ${statPlain}`,
      highlight: v => extreme(asProp ? v * model.n : v),
      marker: { value: obsShown, label: `Observed: ${fmt(obsShown, 3)}` },
    }) + `<div class="legend"><span><i style="background:var(--hot)"></i>As extreme as observed</span><span><i style="background:var(--series-1)"></i>Not as extreme</span></div>`;
    $('#sm-result', root).innerHTML = `
      <dl class="kv">
        <dt>Simulations as extreme as observed</dt><dd>${k.toLocaleString()} of ${N.toLocaleString()}</dd>
        <dt>Approximate p-value</dt><dd>${fmt(pval, 4)}${k === 0 ? ` (less than 1/${N.toLocaleString()})` : ''}</dd>
      </dl>
      ${formula(`p-value ≈ <span class="eq">(simulations ${dir === 'two' ? 'as extreme as' : dir === 'greater' ? '≥' : '≤'} observed) ÷ (total simulations)</span> = ${k} ÷ ${N} = <b>${fmt(pval, 4)}</b>`)}
      <p class="note">A simulated ${statName} counts as “as extreme” if it is ${tailWords}. Your p-value will change a little each time because the simulation is random.</p>
      ${N < 100 ? '<div class="warn">Run at least 100 (better: 1000) simulations before making a conclusion.</div>' : ''}`;

    // Conclusion
    const reject = pval < alpha;
    let nullWords;
    let altWords;
    if (model.m === 'one-prop') {
      nullWords = `the true proportion of ${esc(model.success)} is ${fmt(model.p0)}`;
      altWords = `the true proportion of ${esc(model.success)} is ${dir === 'greater' ? 'greater than' : dir === 'less' ? 'less than' : 'different from'} ${fmt(model.p0)}`;
    } else if (model.m === 'diff-means') {
      nullWords = `there is no difference in the true mean ${esc(model.measure)} for ${esc(model.aName)} and ${esc(model.bName)}`;
      altWords = `the true mean ${esc(model.measure)} for ${esc(model.aName)} is ${dir === 'greater' ? 'greater than' : dir === 'less' ? 'less than' : 'different from'} the true mean for ${esc(model.bName)}`;
    } else {
      nullWords = `there is no difference in the true proportion who ${esc(model.success)} for ${esc(model.aName)} and ${esc(model.bName)}`;
      altWords = `the true proportion who ${esc(model.success)} for ${esc(model.aName)} is ${dir === 'greater' ? 'greater than' : dir === 'less' ? 'less than' : 'different from'} that for ${esc(model.bName)}`;
    }
    concl.innerHTML = N < 100 ? '' : card('Conclusion', interp(`
      <p><b>Interpret the p-value:</b> Assuming ${nullWords}, there is about a <b>${fmt(pval, 4)}</b> probability of getting a ${statPlain.replace(/^./, c => c.toLowerCase())} ${tailWords} by chance alone.</p>
      <p><b>Conclusion:</b> Because the p-value of ${fmt(pval, 4)} is ${reject ? 'less than' : 'not less than'} α = ${fmt(alpha)}, we <b>${reject ? 'reject' : 'fail to reject'} H₀</b>. We ${reject ? '<b>have</b>' : '<b>do not have</b>'} convincing evidence that ${altWords}.</p>
      ${reject ? '' : '<p class="note">Failing to reject H₀ does not prove H₀ is true. It just means the result could easily happen by chance.</p>'}`, 'Sentence frames'));
  }

  renderDir('greater');
  rebuild();
}
