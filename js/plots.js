// SVG plot builders. Each returns an SVG string that scales to its container.
// Colors come from CSS custom properties (see css/styles.css) so plots follow the theme.
// Any element with a data-tip attribute gets a hover tooltip (wired up in main.js).

import { fmt, summary, normalPdf } from './stats.js';

const W = 640;
const SERIES = n => `var(--series-${n})`;
export const MAX_CATEGORY_COLORS = 8;

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// "Nice" tick values covering [lo, hi] with roughly `count` ticks.
export function niceTicks(lo, hi, count = 6) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const start = Math.floor(lo / step) * step;
  const ticks = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) ticks.push(Number(v.toPrecision(12)));
  if (ticks[ticks.length - 1] < hi) ticks.push(Number((ticks[ticks.length - 1] + step).toPrecision(12)));
  return { ticks, step };
}

function decimalsFor(step) {
  return Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
}

function scale(d0, d1, r0, r1) {
  const k = (r1 - r0) / (d1 - d0 || 1);
  return v => r0 + (v - d0) * k;
}

function open(h, label) {
  return `<svg viewBox="0 0 ${W} ${h}" class="plot" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">`;
}

function xAxis(x, ticks, step, y, title, { left, right }) {
  const d = decimalsFor(step);
  let s = `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" class="axis-line"/>`;
  for (const t of ticks) {
    const px = x(t);
    s += `<line x1="${px}" x2="${px}" y1="${y}" y2="${y + 5}" class="axis-line"/>`;
    s += `<text x="${px}" y="${y + 19}" class="tick" text-anchor="middle">${fmt(t, d)}</text>`;
  }
  if (title) s += `<text x="${(left + right) / 2}" y="${y + 38}" class="axis-title" text-anchor="middle">${esc(title)}</text>`;
  return s;
}

function yAxis(y, ticks, step, left, right, title, { top, bottom }, asPercent = false) {
  const d = decimalsFor(asPercent ? step * 100 : step);
  let s = '';
  for (const t of ticks) {
    const py = y(t);
    s += `<line x1="${left}" x2="${right}" y1="${py}" y2="${py}" class="grid"/>`;
    s += `<text x="${left - 8}" y="${py + 4}" class="tick" text-anchor="end">${asPercent ? fmt(t * 100, d) + '%' : fmt(t, d)}</text>`;
  }
  if (title) s += `<text transform="translate(14 ${(top + bottom) / 2}) rotate(-90)" class="axis-title" text-anchor="middle">${esc(title)}</text>`;
  return s;
}

// Left margin wide enough for the longest group name.
function labelMargin(groups) {
  const longest = Math.max(0, ...groups.map(g => (g.name || '').length));
  return longest ? Math.min(180, 24 + longest * 7.6) : 30;
}

// ---------- Dotplot ----------

// groups: [{ name, values }]. Options:
//   title         x-axis title
//   highlight     v => true to color a dot as "in the tail" (simulation)
//   marker        { value, label } draws a vertical reference line (observed statistic)
//   domain        [lo, hi] to force a scale
export function dotplot(groups, opts = {}) {
  const all = groups.flatMap(g => g.values);
  if (all.length === 0) return '';
  const left = labelMargin(groups);
  const right = W - 20;
  let [lo, hi] = opts.domain || [Math.min(...all), Math.max(...all)];
  if (opts.marker) { lo = Math.min(lo, opts.marker.value); hi = Math.max(hi, opts.marker.value); }
  const { ticks, step } = niceTicks(lo, hi, 8);
  const x = scale(ticks[0], ticks[ticks.length - 1], left + 8, right - 8);

  const maxPanel = groups.length > 1 ? 150 : 220;
  const top = opts.marker ? 26 : 12;

  // Dot size: small enough that neighboring distinct values get their own stacks
  // (when possible), then shrink further if the tallest stack won't fit.
  const distinct = [...new Set(all)].sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 1; i < distinct.length; i++) minGap = Math.min(minGap, x(distinct[i]) - x(distinct[i - 1]));
  let r = Math.max(4, Math.min(6, minGap / 2));
  const layoutFor = rr => groups.map(g => stackDots(g.values, x, rr));
  let layouts = layoutFor(r);
  for (let i = 0; i < 12; i++) {
    const tallest = Math.max(...layouts.map(l => l.maxStack));
    if (tallest * 2 * r <= maxPanel - 8) break;
    r = Math.max(0.5, (maxPanel - 8) / (2 * tallest) * 0.98);
    layouts = layoutFor(r);
  }
  const tallestStack = Math.max(...layouts.map(l => l.maxStack));
  const panelH = Math.min(maxPanel, Math.max(groups.length > 1 ? 60 : 80, tallestStack * 2 * r + 16));
  const asBars = r < 1.6;

  const h = top + groups.length * panelH + 50;
  let s = open(h, `Dotplot of ${opts.title || 'data'}`);
  groups.forEach((g, gi) => {
    const base = top + (gi + 1) * panelH;
    if (g.name) s += `<text x="${left - 10}" y="${base - panelH / 2}" class="group-label" text-anchor="end">${esc(g.name)}</text>`;
    if (gi > 0) s += `<line x1="${left}" x2="${right}" y1="${base}" y2="${base}" class="axis-line faint"/>`;
    const color = SERIES(groups.length > 1 ? gi + 1 : 1);
    if (asBars) {
      // Each cluster drawn as a thin bar whose height is the count.
      // Bars are as wide as the spacing between stacks allows, and never shorter than 2px.
      const tallest = Math.max(...layouts.map(l => l.maxStack));
      const yk = (panelH - 10) / tallest;
      const cl = layouts[gi].clusters;
      let gap = Infinity;
      for (let i = 1; i < cl.length; i++) gap = Math.min(gap, cl[i].x - cl[i - 1].x);
      const bw = Math.max(3, Math.min(16, (Number.isFinite(gap) ? gap : 16) * 0.7));
      for (const c of cl) {
        const hi = opts.highlight && c.values.some(opts.highlight);
        const bh = Math.max(2, c.values.length * yk);
        const lo = c.values[0];
        const hiV = c.values[c.values.length - 1];
        const range = lo === hiV ? fmt(lo) : `${fmt(lo)} to ${fmt(hiV)}`;
        s += `<rect x="${c.x - bw / 2}" y="${base - bh}" width="${bw}" height="${bh}" rx="${Math.min(3, bw / 2)}" style="fill:${hi ? 'var(--hot)' : color}" data-tip="${esc(range)}: ${c.values.length} dot${c.values.length === 1 ? '' : 's'}"/>`;
      }
    } else {
      for (const c of layouts[gi].clusters) {
        const lo = c.values[0];
        const hiV = c.values[c.values.length - 1];
        const range = lo === hiV ? fmt(lo) : `${fmt(lo)} to ${fmt(hiV)}`;
        const tip = c.values.length > 1 ? `${range} (${c.values.length} dots in this stack)` : fmt(lo);
        c.values.forEach((v, k) => {
          const hi = opts.highlight && opts.highlight(v);
          s += `<circle cx="${c.x}" cy="${base - r - k * 2 * r}" r="${Math.max(0.5, r - 0.6)}" style="fill:${hi ? 'var(--hot)' : color}" data-tip="${esc(tip)}"/>`;
        });
      }
    }
  });
  const axisY = top + groups.length * panelH;
  if (opts.marker) {
    const mx = x(opts.marker.value);
    s += `<line x1="${mx}" x2="${mx}" y1="${top - 8}" y2="${axisY}" class="marker-line"/>`;
    s += `<text x="${mx}" y="${top - 12}" class="marker-label" text-anchor="middle">${esc(opts.marker.label)}</text>`;
  }
  s += xAxis(x, ticks, step, axisY, opts.title, { left, right });
  s += '</svg>';
  if (asBars) s += '<p class="note">There are too many dots to draw one at a time, so each stack is shown as a bar. Hover a bar to see how many dots it stands for.</p>';
  return s;
}

// Groups equal values, then merges neighbors closer than one dot diameter so stacks don't overlap.
function stackDots(values, x, r) {
  const sortedVals = [...values].sort((a, b) => a - b);
  const clusters = [];
  for (const v of sortedVals) {
    const px = x(v);
    const last = clusters[clusters.length - 1];
    if (last && (v === last.values[0] || px - last.x < 2 * r)) last.values.push(v);
    else clusters.push({ x: px, values: [v] });
  }
  return { clusters, maxStack: Math.max(0, ...clusters.map(c => c.values.length)) };
}

// ---------- Histogram ----------

export function binData(values, binWidth, start, max = Math.max(...values)) {
  const bins = [];
  for (let a = start; a <= max || bins.length === 0; a += binWidth) {
    bins.push({ lo: Number(a.toPrecision(12)), hi: Number((a + binWidth).toPrecision(12)), count: 0 });
    if (bins.length > 500) break;
  }
  for (const v of values) {
    const i = Math.floor((v - start) / binWidth + 1e-9);
    if (i >= 0 && i < bins.length) bins[i].count++;
  }
  return bins;
}

export function defaultBins(values) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const { step } = niceTicks(lo, hi, Math.max(8, Math.min(15, Math.round(2.5 * Math.sqrt(values.length)))));
  return { binWidth: step, start: Math.floor(lo / step) * step };
}

// `max` lets several histograms share the same bins and x scale.
export function histogram(values, { binWidth, start, max, relative = false, title } = {}) {
  if (values.length === 0) return '';
  const bins = binData(values, binWidth, start, max);
  const n = values.length;
  const left = 64;
  const right = W - 20;
  const top = 16;
  const bottom = 260;
  const yMax = Math.max(...bins.map(b => (relative ? b.count / n : b.count)));
  const yt = niceTicks(0, yMax || 1, 5);
  const x = scale(bins[0].lo, bins[bins.length - 1].hi, left, right);
  const y = scale(0, yt.ticks[yt.ticks.length - 1], bottom, top);
  let s = open(bottom + 50, `Histogram of ${title || 'data'}`);
  s += yAxis(y, yt.ticks, yt.step, left, right, relative ? 'Relative frequency' : 'Frequency', { top, bottom }, relative);
  for (const b of bins) {
    const val = relative ? b.count / n : b.count;
    if (b.count === 0) continue;
    s += `<rect x="${x(b.lo) + 0.5}" y="${y(val)}" width="${Math.max(1, x(b.hi) - x(b.lo) - 1)}" height="${bottom - y(val)}" class="bar" style="fill:${SERIES(1)}" data-tip="${fmt(b.lo)} to under ${fmt(b.hi)}: ${b.count} (${fmt((100 * b.count) / n, 1)}%)"/>`;
  }
  // Ticks at the bin edges (thinned out if there are many bins).
  const every = Math.ceil(bins.length / 12);
  const edges = [...bins.map(b => b.lo), bins[bins.length - 1].hi].filter((_, i) => i % every === 0);
  s += xAxis(x, edges, binWidth, bottom, title, { left, right });
  s += '</svg>';
  return s;
}

// ---------- Boxplot (modified, with outliers) ----------

export function boxplot(groups, opts = {}) {
  const all = groups.flatMap(g => g.values);
  if (all.length === 0) return '';
  const left = labelMargin(groups);
  const right = W - 20;
  const { ticks, step } = niceTicks(Math.min(...all), Math.max(...all), 8);
  const x = scale(ticks[0], ticks[ticks.length - 1], left + 8, right - 8);
  const rowH = 70;
  const top = 10;
  const h = top + groups.length * rowH + 50;
  let s = open(h, `Boxplot of ${opts.title || 'data'}`);
  groups.forEach((g, gi) => {
    if (g.values.length === 0) return;
    const st = summary(g.values);
    const inside = g.values.filter(v => v >= st.lowFence && v <= st.highFence);
    const wLo = Math.min(...inside);
    const wHi = Math.max(...inside);
    const cy = top + gi * rowH + rowH / 2;
    const color = SERIES(groups.length > 1 ? gi + 1 : 1);
    const tip = `Min ${fmt(st.min)} · Q1 ${fmt(st.q1)} · Median ${fmt(st.median)} · Q3 ${fmt(st.q3)} · Max ${fmt(st.max)}`;
    if (g.name) s += `<text x="${left - 10}" y="${cy + 4}" class="group-label" text-anchor="end">${esc(g.name)}</text>`;
    s += `<line x1="${x(wLo)}" x2="${x(st.q1)}" y1="${cy}" y2="${cy}" class="whisker"/>`;
    s += `<line x1="${x(st.q3)}" x2="${x(wHi)}" y1="${cy}" y2="${cy}" class="whisker"/>`;
    s += `<line x1="${x(wLo)}" x2="${x(wLo)}" y1="${cy - 10}" y2="${cy + 10}" class="whisker"/>`;
    s += `<line x1="${x(wHi)}" x2="${x(wHi)}" y1="${cy - 10}" y2="${cy + 10}" class="whisker"/>`;
    s += `<rect x="${x(st.q1)}" y="${cy - 20}" width="${Math.max(1, x(st.q3) - x(st.q1))}" height="40" rx="3" class="box" style="fill:${color}" data-tip="${tip}"/>`;
    s += `<line x1="${x(st.median)}" x2="${x(st.median)}" y1="${cy - 20}" y2="${cy + 20}" class="median-line"/>`;
    for (const o of [...st.lowOutliers, ...st.highOutliers]) {
      s += `<circle cx="${x(o)}" cy="${cy}" r="5" class="outlier" data-tip="Outlier: ${fmt(o)}"/>`;
    }
  });
  s += xAxis(x, ticks, step, top + groups.length * rowH, opts.title, { left, right });
  s += '</svg>';
  return s;
}

// ---------- Scatterplot & residual plot ----------

export function scatterplot(xs, ys, { xTitle, yTitle, line, zeroLine = false, pointTip } = {}) {
  if (xs.length === 0) return '';
  const left = 70;
  const right = W - 20;
  const top = 16;
  const bottom = 300;
  const xt = niceTicks(Math.min(...xs), Math.max(...xs), 8);
  let yLo = Math.min(...ys);
  let yHi = Math.max(...ys);
  if (zeroLine) { const m = Math.max(Math.abs(yLo), Math.abs(yHi)); yLo = -m; yHi = m; }
  const yt = niceTicks(yLo, yHi, 6);
  const x = scale(xt.ticks[0], xt.ticks[xt.ticks.length - 1], left, right);
  const y = scale(yt.ticks[0], yt.ticks[yt.ticks.length - 1], bottom, top);
  let s = open(bottom + 50, zeroLine ? 'Residual plot' : 'Scatterplot');
  s += yAxis(y, yt.ticks, yt.step, left, right, yTitle, { top, bottom });
  if (zeroLine) s += `<line x1="${left}" x2="${right}" y1="${y(0)}" y2="${y(0)}" class="ref-line"/>`;
  if (line) {
    const x0 = xt.ticks[0];
    const x1 = xt.ticks[xt.ticks.length - 1];
    const clip = `<clipPath id="plotclip"><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}"/></clipPath>`;
    s += `${clip}<line x1="${x(x0)}" x2="${x(x1)}" y1="${y(line.a + line.b * x0)}" y2="${y(line.a + line.b * x1)}" class="fit-line" clip-path="url(#plotclip)"/>`;
  }
  xs.forEach((xv, i) => {
    s += `<circle cx="${x(xv)}" cy="${y(ys[i])}" r="5" class="point" style="fill:${SERIES(1)}" data-tip="${pointTip ? esc(pointTip(i)) : `(${fmt(xv)}, ${fmt(ys[i])})`}"/>`;
  });
  s += xAxis(x, xt.ticks, xt.step, bottom, xTitle, { left, right });
  s += '</svg>';
  return s;
}

// ---------- Categorical ----------

// One color for every bar: the categories are named on the axis, so color carries no identity.
export function barChart(labels, values, { relative = false, title, yTitle } = {}) {
  const left = 64;
  const right = W - 20;
  const top = 16;
  const bottom = 250;
  const yMax = Math.max(...values, relative ? 0.01 : 1);
  const yt = niceTicks(0, yMax, 5);
  const y = scale(0, yt.ticks[yt.ticks.length - 1], bottom, top);
  const band = (right - left) / labels.length;
  const bw = Math.min(70, band * 0.7);
  const rotate = labels.length > 6 || labels.some(l => l.length > 10);
  let s = open(bottom + (rotate ? 100 : 50), `Bar chart of ${title || 'data'}`);
  s += yAxis(y, yt.ticks, yt.step, left, right, yTitle || (relative ? 'Relative frequency' : 'Frequency'), { top, bottom }, relative);
  labels.forEach((lab, i) => {
    const cx = left + band * (i + 0.5);
    const v = values[i];
    s += `<path d="${roundedTopBar(cx - bw / 2, y(v), bw, bottom - y(v))}" style="fill:${SERIES(1)}" data-tip="${esc(lab)}: ${relative ? fmt(v * 100, 2) + '%' : fmt(v)}"/>`;
    s += rotate
      ? `<text transform="translate(${cx + 4} ${bottom + 12}) rotate(-40)" class="tick" text-anchor="end">${esc(lab)}</text>`
      : `<text x="${cx}" y="${bottom + 19}" class="tick" text-anchor="middle">${esc(lab)}</text>`;
  });
  s += `<line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" class="axis-line"/>`;
  if (title) s += `<text x="${(left + right) / 2}" y="${bottom + (rotate ? 92 : 40)}" class="axis-title" text-anchor="middle">${esc(title)}</text>`;
  s += '</svg>';
  return s;
}

function roundedTopBar(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function legend(labels) {
  return `<div class="legend">${labels.map((l, i) => `<span><i style="background:${SERIES(i + 1)}"></i>${esc(l)}</span>`).join('')}</div>`;
}

// Pie chart: at most 8 slices; extra categories are folded into "Other" by the caller.
export function pieChart(labels, counts, { title } = {}) {
  const total = counts.reduce((a, b) => a + b, 0);
  const cx = W / 2;
  const cy = 150;
  const R = 130;
  let s = open(310, `Pie chart of ${title || 'data'}`);
  let angle = -Math.PI / 2;
  counts.forEach((c, i) => {
    if (c === 0) return;
    const frac = c / total;
    const a2 = angle + frac * 2 * Math.PI;
    const tip = `${esc(labels[i])}: ${c} (${fmt(frac * 100, 1)}%)`;
    if (frac >= 0.9999) {
      s += `<circle cx="${cx}" cy="${cy}" r="${R}" style="fill:${SERIES(i + 1)}" class="slice" data-tip="${tip}"/>`;
    } else {
      const large = a2 - angle > Math.PI ? 1 : 0;
      s += `<path d="M${cx},${cy}L${cx + R * Math.cos(angle)},${cy + R * Math.sin(angle)}A${R},${R} 0 ${large} 1 ${cx + R * Math.cos(a2)},${cy + R * Math.sin(a2)}Z" style="fill:${SERIES(i + 1)}" class="slice" data-tip="${tip}"/>`;
    }
    // Direct label for slices big enough to hold one.
    if (frac >= 0.06) {
      const mid = (angle + a2) / 2;
      const lx = cx + R * 1.18 * Math.cos(mid);
      const ly = cy + R * 1.18 * Math.sin(mid);
      s += `<text x="${lx}" y="${ly + 4}" class="tick" text-anchor="${Math.cos(mid) > 0.2 ? 'start' : Math.cos(mid) < -0.2 ? 'end' : 'middle'}">${esc(labels[i])} ${fmt(frac * 100, 1)}%</text>`;
    }
    angle = a2;
  });
  s += '</svg>';
  return s;
}

// Segmented (stacked to 100%) bar chart. groups = explanatory categories (bars),
// parts = response categories (segments). table[g][p] = count.
export function segmentedBar(groups, parts, table, { xTitle } = {}) {
  const left = 64;
  const right = W - 20;
  const top = 16;
  const bottom = 260;
  const y = scale(0, 1, bottom, top);
  const band = (right - left) / groups.length;
  const bw = Math.min(90, band * 0.6);
  let s = open(bottom + 50, 'Segmented bar chart');
  s += yAxis(y, [0, 0.25, 0.5, 0.75, 1], 0.25, left, right, 'Percent within group', { top, bottom }, true);
  groups.forEach((g, gi) => {
    const total = table[gi].reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    const cx = left + band * (gi + 0.5);
    parts.forEach((p, pi) => {
      const frac = table[gi][pi] / total;
      if (frac === 0) return;
      const y0 = y(acc);
      const y1 = y(acc + frac);
      s += `<rect x="${cx - bw / 2}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1 - 2)}" style="fill:${SERIES(pi + 1)}" data-tip="${esc(g)} — ${esc(p)}: ${table[gi][pi]} of ${total} (${fmt(frac * 100, 1)}%)"/>`;
      if (y0 - y1 > 18) s += `<text x="${cx}" y="${(y0 + y1) / 2 + 3}" class="seg-label" text-anchor="middle">${fmt(frac * 100, 0)}%</text>`;
      acc += frac;
    });
    s += `<text x="${cx}" y="${bottom + 19}" class="tick" text-anchor="middle">${esc(g)}</text>`;
  });
  s += `<line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" class="axis-line"/>`;
  if (xTitle) s += `<text x="${(left + right) / 2}" y="${bottom + 40}" class="axis-title" text-anchor="middle">${esc(xTitle)}</text>`;
  s += '</svg>';
  return s;
}

// Side-by-side bars: one cluster per group, one bar per response category (conditional %).
export function sideBySideBar(groups, parts, table, { xTitle } = {}) {
  const left = 64;
  const right = W - 20;
  const top = 16;
  const bottom = 260;
  const fracs = table.map(row => { const t = row.reduce((a, b) => a + b, 0) || 1; return row.map(c => c / t); });
  const yt = niceTicks(0, Math.max(0.01, ...fracs.flat()), 5);
  const y = scale(0, yt.ticks[yt.ticks.length - 1], bottom, top);
  const band = (right - left) / groups.length;
  const inner = band * 0.8;
  const bw = Math.min(40, inner / parts.length - 2);
  let s = open(bottom + 50, 'Side-by-side bar chart');
  s += yAxis(y, yt.ticks, yt.step, left, right, 'Percent within group', { top, bottom }, true);
  groups.forEach((g, gi) => {
    const cx = left + band * (gi + 0.5);
    const startX = cx - (parts.length * (bw + 2)) / 2;
    parts.forEach((p, pi) => {
      const v = fracs[gi][pi];
      s += `<path d="${roundedTopBar(startX + pi * (bw + 2), y(v), bw, bottom - y(v))}" style="fill:${SERIES(pi + 1)}" data-tip="${esc(g)} — ${esc(p)}: ${fmt(v * 100, 1)}%"/>`;
    });
    s += `<text x="${cx}" y="${bottom + 19}" class="tick" text-anchor="middle">${esc(g)}</text>`;
  });
  s += `<line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" class="axis-line"/>`;
  if (xTitle) s += `<text x="${(left + right) / 2}" y="${bottom + 40}" class="axis-title" text-anchor="middle">${esc(xTitle)}</text>`;
  s += '</svg>';
  return s;
}

// ---------- Normal curve ----------

// regions: [[lo, hi], ...] in data units (may be ±Infinity) to shade.
export function normalCurve(mu, sigma, { regions = [], empirical = false, title, markers = [] } = {}) {
  const left = 30;
  const right = W - 30;
  const top = 20;
  const bottom = 240;
  const lo = mu - 4 * sigma;
  const hi = mu + 4 * sigma;
  const x = scale(lo, hi, left, right);
  const peak = normalPdf(mu, mu, sigma);
  const y = scale(0, peak, bottom, top);
  const N = 240;
  const pathBetween = (a, b) => {
    a = Math.max(a, lo);
    b = Math.min(b, hi);
    if (b <= a) return '';
    let d = `M${x(a)},${bottom}`;
    for (let i = 0; i <= N; i++) {
      const v = a + ((b - a) * i) / N;
      d += `L${x(v)},${y(normalPdf(v, mu, sigma))}`;
    }
    return `${d}L${x(b)},${bottom}Z`;
  };
  const extra = empirical ? 84 : 0;
  let s = open(bottom + 60 + extra, `Normal curve with mean ${fmt(mu)} and standard deviation ${fmt(sigma)}`);
  for (const [a, b] of regions) s += `<path d="${pathBetween(a, b)}" class="shade"/>`;
  let curve = '';
  for (let i = 0; i <= N; i++) {
    const v = lo + ((hi - lo) * i) / N;
    curve += `${i ? 'L' : 'M'}${x(v)},${y(normalPdf(v, mu, sigma))}`;
  }
  s += `<path d="${curve}" class="curve"/>`;
  for (const m of markers) {
    if (m < lo || m > hi) continue;
    s += `<line x1="${x(m)}" x2="${x(m)}" y1="${y(normalPdf(m, mu, sigma)) - 6}" y2="${bottom}" class="marker-line"/>`;
  }
  // Axis: μ ± kσ with z labels underneath.
  s += `<line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" class="axis-line"/>`;
  for (let k = -3; k <= 3; k++) {
    const v = mu + k * sigma;
    s += `<line x1="${x(v)}" x2="${x(v)}" y1="${bottom}" y2="${bottom + 5}" class="axis-line"/>`;
    s += `<text x="${x(v)}" y="${bottom + 19}" class="tick" text-anchor="middle">${fmt(v)}</text>`;
    s += `<text x="${x(v)}" y="${bottom + 35}" class="tick muted" text-anchor="middle">z = ${k}</text>`;
  }
  if (title) s += `<text x="${(left + right) / 2}" y="${bottom + 54}" class="axis-title" text-anchor="middle">${esc(title)}</text>`;
  if (empirical) {
    // Brackets under the axis for μ ± 1σ, 2σ, 3σ.
    [[1, '68%'], [2, '95%'], [3, '99.7%']].forEach(([k, label], i) => {
      const by = bottom + 74 + i * 26;
      const x0 = x(mu - k * sigma);
      const x1 = x(mu + k * sigma);
      s += `<path d="M${x0},${by - 6}V${by}H${x1}V${by - 6}" class="bracket" style="stroke:${SERIES(i + 1)}"/>`;
      s += `<text x="${x(mu)}" y="${by - 4}" class="bracket-label" text-anchor="middle">${label}</text>`;
    });
  }
  s += '</svg>';
  return s;
}
