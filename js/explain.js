// "Show work" blocks: each formula with the student's own numbers plugged in.

import { fmt, sorted, sum, mean } from './stats.js';

const f = (v, d = 4) => fmt(v, d);

// Lists values, shortening long lists to "first few … last few".
export function listPreview(values, max = 12, sep = ' + ') {
  const shown = values.length <= max ? values.map(v => f(v)) : [...values.slice(0, 6).map(v => f(v)), '⋯', ...values.slice(-2).map(v => f(v))];
  return shown.join(sep);
}

const formula = html => `<div class="formula">${html}</div>`;

export function meanWork(values, symbol = 'x̄') {
  return `<h4>Mean</h4>
    ${formula(`${symbol} = <span class="eq">Σx ÷ n</span> = (${listPreview(values)}) ÷ ${values.length}`)}
    ${formula(`${symbol} = ${f(sum(values))} ÷ ${values.length} = <b>${f(mean(values))}</b>`)}`;
}

export function medianWork(values) {
  const s = sorted(values);
  const n = s.length;
  const mid = (n + 1) / 2;
  const posText = n % 2
    ? `the value in position ${mid}: <b>${f(s[mid - 1])}</b>`
    : `the average of positions ${n / 2} and ${n / 2 + 1}: (${f(s[n / 2 - 1])} + ${f(s[n / 2])}) ÷ 2 = <b>${f((s[n / 2 - 1] + s[n / 2]) / 2)}</b>`;
  return `<h4>Median</h4>
    <p>Put the ${n} values in order:</p>
    ${formula(listPreview(s, 30, ', '))}
    <p>The median is in position (n + 1) ÷ 2 = (${n} + 1) ÷ 2 = ${f(mid)}, so it is ${posText}.</p>`;
}

export function quartileWork(st, lower, upper) {
  return `<h4>Quartiles and IQR</h4>
    <p>Q1 is the median of the lower half, and Q3 is the median of the upper half${st.n % 2 ? ' (the middle value is left out of both halves)' : ''}.</p>
    ${formula(`Lower half: ${listPreview(lower, 20, ', ')} → Q1 = <b>${f(st.q1)}</b>`)}
    ${formula(`Upper half: ${listPreview(upper, 20, ', ')} → Q3 = <b>${f(st.q3)}</b>`)}
    ${formula(`IQR = Q3 − Q1 = ${f(st.q3)} − ${f(st.q1)} = <b>${f(st.iqr)}</b>`)}
    ${formula(`Range = max − min = ${f(st.max)} − ${f(st.min)} = <b>${f(st.range)}</b>`)}`;
}

export function sdWork(values) {
  const n = values.length;
  const m = mean(values);
  const devs = values.map(v => v - m);
  const sq = devs.map(d => d * d);
  const ss = sum(sq);
  const table = n <= 20
    ? `<div class="table-scroll"><table class="stats">
        <thead><tr><th>x</th><th>x − x̄</th><th>(x − x̄)²</th></tr></thead>
        <tbody>${values.map((v, i) => `<tr><td>${f(v)}</td><td>${f(devs[i])}</td><td>${f(sq[i])}</td></tr>`).join('')}
        <tr class="total"><td>Sum</td><td>0</td><td>${f(ss)}</td></tr></tbody></table></div>`
    : `<p>(With ${n} values the table is long, so only the total is shown.)</p>`;
  return `<h4>Standard deviation and variance</h4>
    <p>Find each deviation from the mean (x̄ = ${f(m)}), square it, and add them up.</p>
    ${table}
    ${formula(`Σ(x − x̄)² = ${f(ss)}`)}
    ${formula(`Variance: s² = <span class="eq">Σ(x − x̄)² ÷ (n − 1)</span> = ${f(ss)} ÷ ${n - 1} = <b>${f(ss / (n - 1))}</b>`)}
    ${formula(`Standard deviation: s = √s² = √${f(ss / (n - 1))} = <b>${f(Math.sqrt(ss / (n - 1)))}</b>`)}
    <p class="note">Population SD (σ) divides by n = ${n} instead of n − 1: σ = √(${f(ss)} ÷ ${n}) = ${f(Math.sqrt(ss / n))}. Use s for a sample.</p>`;
}

export function fenceWork(st) {
  const outs = [...st.lowOutliers, ...st.highOutliers];
  return `${formula(`Low fence = Q1 − 1.5 × IQR = ${f(st.q1)} − 1.5 × ${f(st.iqr)} = <b>${f(st.lowFence)}</b>`)}
    ${formula(`High fence = Q3 + 1.5 × IQR = ${f(st.q3)} + 1.5 × ${f(st.iqr)} = <b>${f(st.highFence)}</b>`)}
    <p>Any value below ${f(st.lowFence)} or above ${f(st.highFence)} is an outlier${outs.length ? `: <b>${outs.map(v => f(v)).join(', ')}</b>` : '. There are none.'}</p>`;
}

export function zWork(x, m, s, sym = { m: 'x̄', s: 's' }) {
  const z = (x - m) / s;
  return formula(`z = <span class="eq">(value − ${sym.m}) ÷ ${sym.s}</span> = (${f(x)} − ${f(m)}) ÷ ${f(s)} = ${f(x - m)} ÷ ${f(s)} = <b>${f(z)}</b>`);
}

export function zDescribe(z, x, ctx) {
  if (Math.abs(z) < 1e-12) return `A ${ctx.name} of ${f(x)}${ctx.units} is exactly at the mean (z = 0).`;
  return `A ${ctx.name} of ${f(x)}${ctx.units} is <b>${f(Math.abs(z), 2)} standard deviation${Math.abs(z) === 1 ? '' : 's'} ${z > 0 ? 'above' : 'below'}</b> the mean.`;
}

export function strengthWord(r) {
  const a = Math.abs(r);
  if (a >= 0.8) return 'strong';
  if (a >= 0.5) return 'moderate';
  if (a >= 0.2) return 'weak';
  return 'very weak (almost no)';
}

export { formula };
