// Normal distribution calculator: areas (normalcdf), inverse (invNorm), and the empirical rule.

import { normalCdf, invNorm, normCdfStd, fmt } from '../stats.js';
import { normalCurve } from '../plots.js';
import { $, $$, card, seg, wireSegs, segValue, context, downloadButton } from '../ui.js';
import { formula } from '../explain.js';

export function init(root) {
  root.innerHTML = `
    <div class="inputs">
      <h2>Normal Distribution</h2>
      <p class="hint">Find the area (proportion or probability) under a normal curve, or find the value for a given area. Use mean 0 and SD 1 to work with z-scores.</p>
      <div class="row">
        <label class="field">Variable name <span class="sub">(optional)</span><input type="text" id="nm-name" placeholder="e.g. height"></label>
        <label class="field">Units <span class="sub">(optional)</span><input type="text" id="nm-units" placeholder="e.g. inches"></label>
      </div>
      <div class="row">
        <label class="field">Mean (μ) <input type="number" id="nm-mu" step="any" value="0"></label>
        <label class="field">Standard deviation (σ) <input type="number" id="nm-sd" step="any" value="1" min="0"></label>
      </div>
      <label class="field">What do you want to find?</label>
      <div style="margin:-6px 0 14px">${seg('mode', [{ value: 'area', label: 'Area / probability' }, { value: 'value', label: 'Value from an area' }], 'area')}</div>

      <div id="nm-area-inputs">
        <label class="field">Region</label>
        <div style="margin:-6px 0 14px">${seg('region', [
          { value: 'left', label: 'Less than' },
          { value: 'right', label: 'Greater than' },
          { value: 'between', label: 'Between' },
          { value: 'outside', label: 'Outside' },
        ], 'left')}</div>
        <div class="row">
          <label class="field" id="nm-a-label"><span>Value</span><input type="number" id="nm-a" step="any" value="1"></label>
          <label class="field" id="nm-b-wrap" hidden><span>and</span><input type="number" id="nm-b" step="any" value="2"></label>
        </div>
      </div>

      <div id="nm-value-inputs" hidden>
        <label class="field">The area is</label>
        <div style="margin:-6px 0 14px">${seg('side', [
          { value: 'left', label: 'To the left' },
          { value: 'right', label: 'To the right' },
          { value: 'center', label: 'In the middle' },
        ], 'left')}</div>
        <label class="field">Area (between 0 and 1) <input type="number" id="nm-p" step="any" min="0" max="1" value="0.9"></label>
      </div>

      <label class="check"><input type="checkbox" id="nm-emp"> Show the 68–95–99.7 rule</label>
      <p class="error" id="nm-err"></p>
    </div>
    <div class="results" aria-live="polite"><div id="nm-out" class="stack"></div></div>`;

  wireSegs(root, () => draw());
  $$('input', root).forEach(i => i.addEventListener('input', draw));

  function draw() {
    const mode = segValue(root, 'mode');
    const region = segValue(root, 'region');
    const side = segValue(root, 'side');
    $('#nm-area-inputs', root).hidden = mode !== 'area';
    $('#nm-value-inputs', root).hidden = mode !== 'value';
    const two = region === 'between' || region === 'outside';
    $('#nm-b-wrap', root).hidden = !two;
    $('#nm-a-label span', root).textContent = two ? 'From' : 'Value';

    const ctx = context($('#nm-name', root).value, $('#nm-units', root).value);
    const mu = Number($('#nm-mu', root).value);
    const sd = Number($('#nm-sd', root).value);
    const emp = $('#nm-emp', root).checked;
    const err = $('#nm-err', root);
    const out = $('#nm-out', root);
    err.textContent = '';
    if ($('#nm-mu', root).value === '' || !(sd > 0)) {
      err.textContent = 'Enter a mean and a standard deviation greater than 0.';
      out.innerHTML = '';
      return;
    }
    const axisTitle = ctx.hasName ? `${ctx.name}${ctx.units ? ` (${ctx.units.trim()})` : ''}` : '';
    const zw = (x, name = 'z') => formula(`${name} = <span class="eq">(x − μ) ÷ σ</span> = (${fmt(x)} − ${fmt(mu)}) ÷ ${fmt(sd)} = <b>${fmt((x - mu) / sd)}</b>`);
    const plotOpts = { empirical: emp, title: axisTitle };

    if (mode === 'area') {
      let a = Number($('#nm-a', root).value);
      let b = Number($('#nm-b', root).value);
      if ($('#nm-a', root).value === '' || (two && $('#nm-b', root).value === '')) {
        err.textContent = 'Enter the value(s) for the region.';
        out.innerHTML = '';
        return;
      }
      if (two && b < a) [a, b] = [b, a];
      let p;
      let notation;
      let regions;
      let calc;
      let words;
      const X = 'X';
      if (region === 'left') {
        p = normalCdf(-Infinity, a, mu, sd);
        notation = `P(${X} &lt; ${fmt(a)})`;
        regions = [[-Infinity, a]];
        calc = `normalcdf(lower: −1E99, upper: ${fmt(a)}, μ: ${fmt(mu)}, σ: ${fmt(sd)})`;
        words = `less than ${fmt(a)}${ctx.units}`;
      } else if (region === 'right') {
        p = normalCdf(a, Infinity, mu, sd);
        notation = `P(${X} &gt; ${fmt(a)})`;
        regions = [[a, Infinity]];
        calc = `normalcdf(lower: ${fmt(a)}, upper: 1E99, μ: ${fmt(mu)}, σ: ${fmt(sd)})`;
        words = `greater than ${fmt(a)}${ctx.units}`;
      } else if (region === 'between') {
        p = normalCdf(a, b, mu, sd);
        notation = `P(${fmt(a)} &lt; ${X} &lt; ${fmt(b)})`;
        regions = [[a, b]];
        calc = `normalcdf(lower: ${fmt(a)}, upper: ${fmt(b)}, μ: ${fmt(mu)}, σ: ${fmt(sd)})`;
        words = `between ${fmt(a)} and ${fmt(b)}${ctx.units}`;
      } else {
        p = 1 - normalCdf(a, b, mu, sd);
        notation = `P(${X} &lt; ${fmt(a)} or ${X} &gt; ${fmt(b)})`;
        regions = [[-Infinity, a], [b, Infinity]];
        calc = `1 − normalcdf(lower: ${fmt(a)}, upper: ${fmt(b)}, μ: ${fmt(mu)}, σ: ${fmt(sd)})`;
        words = `less than ${fmt(a)} or greater than ${fmt(b)}${ctx.units}`;
      }
      const za = (a - mu) / sd;
      const zb = (b - mu) / sd;
      const zLine = region === 'left' ? `P(z &lt; ${fmt(za, 2)})`
        : region === 'right' ? `P(z &gt; ${fmt(za, 2)})`
        : region === 'between' ? `P(${fmt(za, 2)} &lt; z &lt; ${fmt(zb, 2)})`
        : `P(z &lt; ${fmt(za, 2)} or z &gt; ${fmt(zb, 2)})`;
      const work = `
        <h4>1. Standardize (find the z-score${two ? 's' : ''})</h4>
        ${zw(a, two ? 'z₁' : 'z')}${two ? zw(b, 'z₂') : ''}
        <h4>2. Find the area</h4>
        ${formula(`${notation} = ${zLine} = <b>${fmt(p, 4)}</b>`)}
        <h4>On a TI-84</h4>
        ${formula(calc)}`;
      const meaning = `<p>About <b>${fmt(p * 100, 2)}%</b> of ${ctx.plural} are ${words} in this normal distribution.</p>
        <p class="note">You can also say: the probability that a randomly chosen ${ctx.name} is ${words} is about ${fmt(p, 4)}.</p>`;
      out.innerHTML = card('Result', `
        <div class="big">${notation} = ${fmt(p, 4)}</div>
        ${normalCurve(mu, sd, { ...plotOpts, regions, markers: two ? [a, b] : [a] })}`,
        { meaning, work, actions: downloadButton('normal curve') });
    } else {
      const p = Number($('#nm-p', root).value);
      if ($('#nm-p', root).value === '' || !(p > 0 && p < 1)) {
        err.textContent = 'Enter an area between 0 and 1 (for example 0.9 for 90%).';
        out.innerHTML = '';
        return;
      }
      let big;
      let regions;
      let work;
      let meaning;
      if (side === 'left' || side === 'right') {
        const leftArea = side === 'left' ? p : 1 - p;
        const z = invNorm(leftArea);
        const x = mu + z * sd;
        big = `x = ${fmt(x, 4)}`;
        regions = side === 'left' ? [[-Infinity, x]] : [[x, Infinity]];
        work = `
          <h4>1. Find the z-score with area ${fmt(leftArea, 4)} to its left</h4>
          ${side === 'right' ? `<p>An area of ${fmt(p)} to the right means an area of 1 − ${fmt(p)} = ${fmt(leftArea)} to the left.</p>` : ''}
          ${formula(`z = invNorm(${fmt(leftArea, 4)}) = <b>${fmt(z, 4)}</b>`)}
          <h4>2. Un-standardize</h4>
          ${formula(`x = <span class="eq">μ + z · σ</span> = ${fmt(mu)} + (${fmt(z, 4)})(${fmt(sd)}) = <b>${fmt(x, 4)}</b>`)}
          <h4>On a TI-84</h4>
          ${formula(`invNorm(area: ${fmt(leftArea, 4)}, μ: ${fmt(mu)}, σ: ${fmt(sd)})`)}`;
        meaning = side === 'left'
          ? `<p>About ${fmt(p * 100, 2)}% of ${ctx.plural} are less than <b>${fmt(x, 2)}${ctx.units}</b>. That makes ${fmt(x, 2)}${ctx.units} the ${fmt(p * 100, 2)}th percentile.</p>`
          : `<p>About ${fmt(p * 100, 2)}% of ${ctx.plural} are greater than <b>${fmt(x, 2)}${ctx.units}</b>.</p>`;
      } else {
        const tail = (1 - p) / 2;
        const z = invNorm(1 - tail);
        const lo = mu - z * sd;
        const hi = mu + z * sd;
        big = `${fmt(lo, 4)} to ${fmt(hi, 4)}`;
        regions = [[lo, hi]];
        work = `
          <h4>1. Split the leftover area between the two tails</h4>
          ${formula(`Each tail = (1 − ${fmt(p)}) ÷ 2 = ${fmt(tail, 4)}`)}
          ${formula(`z = invNorm(${fmt(1 - tail, 4)}) = <b>±${fmt(z, 4)}</b>`)}
          <h4>2. Un-standardize</h4>
          ${formula(`x = μ ± z · σ = ${fmt(mu)} ± (${fmt(z, 4)})(${fmt(sd)}) → <b>${fmt(lo, 4)}</b> and <b>${fmt(hi, 4)}</b>`)}`;
        meaning = `<p>The middle ${fmt(p * 100, 2)}% of ${ctx.plural} are between <b>${fmt(lo, 2)}</b> and <b>${fmt(hi, 2)}${ctx.units}</b>.</p>`;
      }
      out.innerHTML = card('Result', `
        <div class="big">${big}</div>
        ${normalCurve(mu, sd, { ...plotOpts, regions, markers: regions.flat().filter(Number.isFinite) })}`,
        { meaning, work, actions: downloadButton('normal curve') });
    }
    if (emp) {
      out.innerHTML += card('The 68–95–99.7 rule', `
        <p>In any normal distribution:</p>
        <ul>
          <li>About <b>68%</b> of values are within 1 SD of the mean: ${fmt(mu - sd)} to ${fmt(mu + sd)}</li>
          <li>About <b>95%</b> are within 2 SDs: ${fmt(mu - 2 * sd)} to ${fmt(mu + 2 * sd)}</li>
          <li>About <b>99.7%</b> are within 3 SDs: ${fmt(mu - 3 * sd)} to ${fmt(mu + 3 * sd)}</li>
        </ul>
        <p class="note">The exact areas are ${fmt(normCdfStd(1) - normCdfStd(-1), 4)}, ${fmt(normCdfStd(2) - normCdfStd(-2), 4)}, and ${fmt(normCdfStd(3) - normCdfStd(-3), 4)}.</p>`);
    }
  }

  draw();
}
