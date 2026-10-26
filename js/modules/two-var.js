// Two quantitative variables: scatterplot, correlation, least-squares regression line,
// residual plot, and predictions.

import { parseNumbers, regression, mean, fmt } from '../stats.js';
import { scatterplot, esc } from '../plots.js';
import { $, $$, card, interp, debounce, downloadButton, sampleSelect, wireSamples } from '../ui.js';
import { formula, strengthWord } from '../explain.js';
import { twoVarSamples } from '../../data/samples.js';

export function init(root) {
  root.innerHTML = `
    <div class="inputs">
      <h2>Two Quantitative Variables</h2>
      <p class="hint">Enter the explanatory (x) values and the response (y) values in the same order. You can also paste two columns from Google Sheets into the x box.</p>
      ${sampleSelect(twoVarSamples)}
      <div class="row">
        <label class="field">x variable name<input type="text" id="tv-xname" placeholder="e.g. hours studied"></label>
        <label class="field">y variable name<input type="text" id="tv-yname" placeholder="e.g. test score"></label>
      </div>
      <div class="row">
        <label class="field">x values (explanatory)<textarea id="tv-x" rows="8" placeholder="1 2 3 4 5"></textarea></label>
        <label class="field">y values (response)<textarea id="tv-y" rows="8" placeholder="2 4 5 4 5"></textarea></label>
      </div>
      <p class="error" id="tv-err"></p>
      <button type="button" class="btn link" id="tv-clear">Clear all</button>
    </div>
    <div class="results" aria-live="polite">
      <div class="empty" id="tv-empty">Enter at least 3 (x, y) pairs to see the scatterplot and regression line.</div>
      <div id="tv-out" class="stack" hidden>
        <div class="card" id="tv-scatter-card">
          <h3><span>Scatterplot</span>${downloadButton('scatterplot')}</h3>
          <div class="plot-controls"><label class="check" style="margin:0"><input type="checkbox" id="tv-line" checked> Show the least-squares regression line</label></div>
          <div id="tv-scatter"></div>
        </div>
        <div id="tv-reg"></div>
        <div class="card" id="tv-resid-card">
          <h3><span>Residual plot</span>${downloadButton('residual plot')}</h3>
          <div id="tv-resid"></div>
        </div>
        <div class="card">
          <h3><span>Make a prediction</span></h3>
          <div class="row">
            <label class="field">x value<input type="number" id="tv-px" step="any" placeholder="e.g. 3.5"></label>
            <label class="field">Find the residual for a data point<select id="tv-pick"></select></label>
          </div>
          <div id="tv-pred"></div>
        </div>
        <div id="tv-table"></div>
      </div>
    </div>`;

  const update = debounce(recompute, 250);
  $$('#tv-xname, #tv-yname, #tv-x, #tv-y', root).forEach(el => el.addEventListener('input', update));
  $('#tv-line', root).addEventListener('change', drawScatter);
  $('#tv-px', root).addEventListener('input', drawPrediction);
  $('#tv-pick', root).addEventListener('change', drawPrediction);
  $('#tv-clear', root).addEventListener('click', () => {
    $$('#tv-xname, #tv-yname, #tv-x, #tv-y', root).forEach(el => { el.value = ''; });
    recompute();
  });
  wireSamples(root, twoVarSamples, s => {
    $('#tv-xname', root).value = s.xName;
    $('#tv-yname', root).value = s.yName;
    $('#tv-x', root).value = s.x;
    $('#tv-y', root).value = s.y;
    recompute();
  });

  let xs = [];
  let ys = [];
  let fit = null;
  let names = { x: 'x', y: 'y' };

  function readPairs() {
    const xText = $('#tv-x', root).value;
    const yText = $('#tv-y', root).value;
    // Two pasted columns: every line has exactly two numbers and the y box is empty.
    const lines = xText.trim().split(/\r?\n/).filter(l => l.trim());
    if (!yText.trim() && lines.length >= 2 && lines.every(l => parseNumbers(l).values.length === 2)) {
      const pairs = lines.map(l => parseNumbers(l).values);
      return { x: pairs.map(p => p[0]), y: pairs.map(p => p[1]), note: 'Read two columns from the x box.' };
    }
    const px = parseNumbers(xText);
    const py = parseNumbers(yText);
    const bad = [...px.bad, ...py.bad];
    return { x: px.values, y: py.values, note: bad.length ? `Ignored (not numbers): ${bad.slice(0, 5).join(', ')}` : '' };
  }

  function recompute() {
    names = { x: $('#tv-xname', root).value.trim() || 'x', y: $('#tv-yname', root).value.trim() || 'y' };
    const { x, y, note } = readPairs();
    const err = $('#tv-err', root);
    err.textContent = note;
    let ok = x.length >= 3 && x.length === y.length;
    if (x.length !== y.length && x.length && y.length) err.textContent = `There are ${x.length} x values but ${y.length} y values. They need to match.`;
    if (ok && new Set(x).size < 2) { err.textContent = 'The x values are all the same, so a line can’t be fit.'; ok = false; }
    if (ok && new Set(y).size < 2) { err.textContent = 'The y values are all the same, so the correlation is undefined.'; ok = false; }
    $('#tv-empty', root).hidden = ok;
    $('#tv-out', root).hidden = !ok;
    if (!ok) return;
    xs = x;
    ys = y;
    fit = regression(xs, ys);
    $('#tv-pick', root).innerHTML = '<option value="">— Choose a point —</option>' + xs.map((v, i) => `<option value="${i}">(${fmt(v)}, ${fmt(ys[i])})</option>`).join('');
    drawScatter();
    drawRegression();
    drawResiduals();
    drawPrediction();
    drawTable();
  }

  const X = () => esc(names.x);
  const Y = () => esc(names.y);

  function drawScatter() {
    if (!fit) return;
    $('#tv-scatter', root).innerHTML = scatterplot(xs, ys, {
      xTitle: names.x,
      yTitle: names.y,
      line: $('#tv-line', root).checked ? { a: fit.a, b: fit.b } : null,
      pointTip: i => `(${fmt(xs[i])}, ${fmt(ys[i])}) · residual ${fmt(fit.residuals[i], 3)}`,
    });
  }

  function curved() {
    // Compare residuals with (x − x̄)²: a strong link means a leftover U-shape.
    if (xs.length < 6) return false;
    const mx = mean(xs);
    const sq = xs.map(v => (v - mx) ** 2);
    if (new Set(sq).size < 2) return false;
    return Math.abs(regression(sq, fit.residuals).r) > 0.6;
  }

  function drawRegression() {
    const { r, r2, a, b, s, mx, my, sx, sy, n } = fit;
    const dir = r > 0 ? 'positive' : 'negative';
    const strength = strengthWord(r);
    const form = curved() ? 'curved (nonlinear)' : 'linear';
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const body = `
      <div class="big" style="font-size:22px">predicted ${Y()} = ${fmt(a, 4)} ${b < 0 ? '−' : '+'} ${fmt(Math.abs(b), 4)}(${X()})</div>
      <p class="note" style="margin-top:0">ŷ = a + bx, where a = ${fmt(a, 4)} and b = ${fmt(b, 4)}</p>
      <div class="table-scroll"><table class="stats">
        <tbody>
          <tr><td class="lbl"><b>r</b> · correlation</td><td>${fmt(r, 4)}</td></tr>
          <tr><td class="lbl"><b>r²</b> · coefficient of determination</td><td>${fmt(r2, 4)}</td></tr>
          <tr><td class="lbl"><b>s</b> · standard deviation of the residuals</td><td>${fmt(s, 4)}</td></tr>
          <tr><td class="lbl"><b>b</b> · slope</td><td>${fmt(b, 4)}</td></tr>
          <tr><td class="lbl"><b>a</b> · y-intercept</td><td>${fmt(a, 4)}</td></tr>
          <tr><td class="lbl"><b>n</b> · number of points</td><td>${n}</td></tr>
        </tbody>
      </table></div>`;
    const meaning = `
      <p><b>Describe the association (DUFS):</b> There is a <b>${strength}, ${dir}, ${form}</b> association between ${X()} and ${Y()}${Math.abs(r) < 0.2 ? '' : `: as ${X()} increases, ${Y()} tends to ${r > 0 ? 'increase' : 'decrease'}`}. Look at the scatterplot for any unusual points.</p>
      <p><b>Slope:</b> The predicted ${Y()} ${b >= 0 ? 'increases' : 'decreases'} by ${fmt(Math.abs(b), 3)} for each 1-unit increase in ${X()}.</p>
      <p><b>y-intercept:</b> The predicted ${Y()} is ${fmt(a, 3)} when ${X()} is 0.${xMin > 0 || xMax < 0 ? ' <i>(0 is outside the x values in the data, so this may not make sense in context.)</i>' : ''}</p>
      <p><b>r²:</b> About ${fmt(r2 * 100, 1)}% of the variability in ${Y()} is accounted for by the least-squares regression line with x = ${X()}.</p>
      <p><b>s:</b> The actual ${Y()} typically varies by about ${fmt(s, 3)} from the ${Y()} predicted by the least-squares regression line.</p>`;
    const work = `
      <h4>Means and standard deviations</h4>
      ${formula(`x̄ = ${fmt(mx)}, s<sub>x</sub> = ${fmt(sx)}`)}
      ${formula(`ȳ = ${fmt(my)}, s<sub>y</sub> = ${fmt(sy)}`)}
      <h4>Correlation</h4>
      ${formula(`r = <span class="eq">(1 ÷ (n − 1)) · Σ(z<sub>x</sub> · z<sub>y</sub>)</span> = <b>${fmt(r)}</b>`)}
      <h4>Slope</h4>
      ${formula(`b = <span class="eq">r · (s<sub>y</sub> ÷ s<sub>x</sub>)</span> = ${fmt(r)} · (${fmt(sy)} ÷ ${fmt(sx)}) = <b>${fmt(b)}</b>`)}
      <h4>y-intercept</h4>
      ${formula(`a = <span class="eq">ȳ − b · x̄</span> = ${fmt(my)} − (${fmt(b)})(${fmt(mx)}) = <b>${fmt(a)}</b>`)}
      <h4>Coefficient of determination</h4>
      ${formula(`r² = (${fmt(r)})² = <b>${fmt(r2)}</b>`)}
      <h4>Standard deviation of the residuals</h4>
      ${formula(`s = <span class="eq">√( Σ residual² ÷ (n − 2) )</span> = <b>${fmt(s)}</b>`)}
      <p class="note">On a TI-84: STAT → CALC → 8:LinReg(a+bx). Turn on DiagnosticOn to see r and r².</p>`;
    $('#tv-reg', root).innerHTML = card('Least-squares regression line', body, { meaning, work });
  }

  function drawResiduals() {
    const curve = curved();
    $('#tv-resid', root).innerHTML = scatterplot(xs, fit.residuals, {
      xTitle: names.x,
      yTitle: 'Residual',
      zeroLine: true,
      pointTip: i => `x = ${fmt(xs[i])}, residual = ${fmt(fit.residuals[i], 3)}`,
    }) + interp(curve
      ? '<p>The residual plot appears to show a <b>curved pattern</b>. A line may <b>not</b> be the best model. A curved model might fit better.</p>'
      : '<p>The residuals appear to be scattered randomly above and below 0 with <b>no leftover curved pattern</b>, so a linear model is appropriate.</p>',
    'What does this mean?') + '<p class="note">residual = actual y − predicted y. Points above 0 were underestimated by the line, and points below 0 were overestimated.</p>';
  }

  function drawPrediction() {
    if (!fit) return;
    const out = $('#tv-pred', root);
    let html = '';
    const pxs = $('#tv-px', root).value;
    if (pxs !== '') {
      const px = Number(pxs);
      const yhat = fit.a + fit.b * px;
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      html += `<div class="note">Predicted ${Y()}</div><div class="big">ŷ = ${fmt(yhat, 4)}</div>
        ${formula(`ŷ = ${fmt(fit.a)} + (${fmt(fit.b)})(${fmt(px)}) = <b>${fmt(yhat)}</b>`)}
        ${interp(`<p>The predicted ${Y()} when ${X()} is ${fmt(px)} is ${fmt(yhat, 2)}.</p>`)}
        ${px < xMin || px > xMax ? `<div class="warn"><b>Extrapolation!</b> ${fmt(px)} is outside the x values in the data (${fmt(xMin)} to ${fmt(xMax)}), so this prediction may not be reliable.</div>` : ''}`;
    }
    const pick = $('#tv-pick', root).value;
    if (pick !== '') {
      const i = Number(pick);
      const yhat = fit.predicted[i];
      const e = fit.residuals[i];
      html += `<h4>Residual for (${fmt(xs[i])}, ${fmt(ys[i])})</h4>
        ${formula(`residual = <span class="eq">y − ŷ</span> = ${fmt(ys[i])} − ${fmt(yhat)} = <b>${fmt(e)}</b>`)}
        ${interp(`<p>The actual ${Y()} was ${fmt(Math.abs(e), 3)} ${e >= 0 ? 'more' : 'less'} than the ${Y()} predicted by the regression line for ${X()} = ${fmt(xs[i])}.</p>`)}`;
    }
    out.innerHTML = html || '<p class="note">Type an x value to predict y, or choose a point to find its residual.</p>';
  }

  function drawTable() {
    const rows = xs.map((v, i) => `<tr><td>${i + 1}</td><td>${fmt(v)}</td><td>${fmt(ys[i])}</td><td>${fmt(fit.predicted[i])}</td><td>${fmt(fit.residuals[i])}</td></tr>`).join('');
    $('#tv-table', root).innerHTML = `<div class="card"><details class="work" style="margin:0;border:0"><summary style="padding-left:0">Data table with predicted values and residuals</summary>
      <div class="table-scroll"><table class="stats"><thead><tr><th>#</th><th>x</th><th>y</th><th>ŷ</th><th>Residual</th></tr></thead><tbody>${rows}</tbody></table></div>
    </details></div>`;
  }

  recompute();
}
