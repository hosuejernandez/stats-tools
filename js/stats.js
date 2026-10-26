// Pure statistics functions. No DOM access here so everything can be tested in node.

// ---------- Parsing ----------

// Splits text on commas, whitespace, semicolons, or tabs (pasting a column from
// Google Sheets gives newlines). Returns the numbers plus any tokens that weren't numbers.
export function parseNumbers(text) {
  const tokens = String(text).split(/[\s,;]+/).filter(t => t.length > 0);
  const values = [];
  const bad = [];
  for (const t of tokens) {
    const n = Number(t);
    if (Number.isFinite(n)) values.push(n);
    else bad.push(t);
  }
  return { values, bad };
}

// Splits text into labels (one per line, or comma separated if all on one line).
export function parseLabels(text) {
  const s = String(text).trim();
  if (!s) return [];
  const parts = s.includes('\n') ? s.split(/\r?\n/) : s.split(/[,;\t]/);
  return parts.map(p => p.trim()).filter(p => p.length > 0);
}

// ---------- One variable ----------

export const sum = a => a.reduce((s, v) => s + v, 0);
export const mean = a => sum(a) / a.length;
export const sorted = a => [...a].sort((x, y) => x - y);

export function median(a) {
  const s = sorted(a);
  const n = s.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// TI-84 / Math Medic method: Q1 and Q3 are medians of the lower and upper halves,
// leaving out the overall median when n is odd.
export function quartiles(a) {
  const s = sorted(a);
  const n = s.length;
  if (n < 2) return { q1: s[0], q3: s[0], lower: s, upper: s };
  const half = Math.floor(n / 2);
  const lower = s.slice(0, half);
  const upper = s.slice(n % 2 ? half + 1 : half);
  return { q1: median(lower), q3: median(upper), lower, upper };
}

export function sumSquaredDeviations(a) {
  const m = mean(a);
  return sum(a.map(v => (v - m) ** 2));
}
export const sampleVariance = a => (a.length < 2 ? NaN : sumSquaredDeviations(a) / (a.length - 1));
export const popVariance = a => sumSquaredDeviations(a) / a.length;
export const sampleSD = a => Math.sqrt(sampleVariance(a));
export const popSD = a => Math.sqrt(popVariance(a));

export function summary(a) {
  const s = sorted(a);
  const { q1, q3 } = quartiles(s);
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;
  return {
    n: s.length,
    mean: mean(s),
    sx: sampleSD(s),
    sigma: popSD(s),
    varSample: sampleVariance(s),
    varPop: popVariance(s),
    min: s[0],
    q1,
    median: median(s),
    q3,
    max: s[s.length - 1],
    range: s[s.length - 1] - s[0],
    iqr,
    lowFence,
    highFence,
    lowOutliers: s.filter(v => v < lowFence),
    highOutliers: s.filter(v => v > highFence),
    sum: sum(s),
  };
}

export function skewness(a) {
  const n = a.length;
  const m = mean(a);
  const s = popSD(a);
  if (n < 3 || s === 0) return 0;
  return sum(a.map(v => ((v - m) / s) ** 3)) / n;
}

// A rough guess at the shape, for students to confirm with the graph.
// Returns { label, reason }.
export function guessShape(a) {
  const n = a.length;
  if (n < 5) return { label: 'too few values to tell', reason: 'Shape is hard to judge with fewer than 5 values.' };
  const st = summary(a);
  if (st.sx === 0) return { label: 'all the same value', reason: 'Every value is identical.' };

  // Histogram with about sqrt(n) bins (5 to 12) to look for peaks / flatness.
  const k = Math.max(5, Math.min(12, Math.round(Math.sqrt(n))));
  const w = (st.max - st.min) / k || 1;
  const counts = new Array(k).fill(0);
  for (const v of a) counts[Math.min(k - 1, Math.floor((v - st.min) / w))]++;

  const skew = skewness(a);
  const meanMinusMedian = (st.mean - st.median) / st.sx;

  // Bimodal: two clear peaks separated by a dip.
  if (n >= 20) {
    const peaks = [];
    for (let i = 0; i < k; i++) {
      const left = i === 0 ? -1 : counts[i - 1];
      const right = i === k - 1 ? -1 : counts[i + 1];
      if (counts[i] > left && counts[i] >= right && counts[i] >= n / k * 0.8) peaks.push(i);
    }
    if (peaks.length >= 2) {
      const [p1, p2] = [peaks[0], peaks[peaks.length - 1]];
      const valley = Math.min(...counts.slice(p1, p2 + 1));
      if (p2 - p1 >= 2 && valley <= 0.5 * Math.min(counts[p1], counts[p2])) {
        return { label: 'bimodal', reason: 'The graph appears to have two separate peaks.' };
      }
    }
  }

  // Uniform: all bins about the same height.
  if (n >= 20) {
    const expected = n / k;
    const maxDev = Math.max(...counts.map(c => Math.abs(c - expected)));
    if (maxDev <= Math.max(2, 0.45 * expected) && Math.abs(skew) < 0.3) {
      return { label: 'roughly uniform', reason: 'The bars are all about the same height.' };
    }
  }

  if (skew > 0.6 || (skew > 0.4 && meanMinusMedian > 0.15)) {
    return { label: 'skewed right', reason: 'The mean is pulled above the median and there is a longer tail to the right.' };
  }
  if (skew < -0.6 || (skew < -0.4 && meanMinusMedian < -0.15)) {
    return { label: 'skewed left', reason: 'The mean is pulled below the median and there is a longer tail to the left.' };
  }
  return { label: 'roughly symmetric', reason: 'The mean and median are close and the two sides look about the same.' };
}

export const zScore = (x, m, s) => (x - m) / s;

// Percent of values strictly less than x, and percent at or below x.
export function percentileOf(a, x) {
  const less = a.filter(v => v < x).length;
  const atOrBelow = a.filter(v => v <= x).length;
  return { less: (100 * less) / a.length, atOrBelow: (100 * atOrBelow) / a.length, countLess: less, countAtOrBelow: atOrBelow };
}

// Stemplot rows. The leaf unit comes from the data's decimal places, moved up
// by powers of 10 until there are at most about 25 stems.
export function stemplot(a, { split = false } = {}) {
  const decimals = Math.max(0, ...a.map(v => (String(v).split('.')[1] || '').length));
  let leafUnit = 10 ** -decimals;
  const range = Math.max(...a) - Math.min(...a);
  while (range / leafUnit / 10 > 25) leafUnit *= 10;

  const m = split ? 2 : 1;
  // Position on the number line of each stem row; negative rows count down from -1 ("-0").
  const posOf = (neg, stem, part) => (neg ? -(m * stem + part) - 1 : m * stem + part);
  const rowAt = pos => {
    const neg = pos < 0;
    const q = neg ? -pos - 1 : pos;
    return { neg, stem: Math.floor(q / m), part: q % m, leaves: [] };
  };

  const byPos = new Map();
  for (const v of sorted(a)) {
    const scaled = Math.round(v / leafUnit);
    const neg = scaled < 0 || Object.is(scaled, -0) || (v < 0 && scaled === 0);
    const mag = Math.abs(scaled);
    const stem = Math.floor(mag / 10);
    const leaf = mag % 10;
    const pos = posOf(neg, stem, split && leaf >= 5 ? 1 : 0);
    if (!byPos.has(pos)) byPos.set(pos, rowAt(pos));
    byPos.get(pos).leaves.push(leaf);
  }
  const positions = [...byPos.keys()];
  const rows = [];
  for (let pos = Math.min(...positions); pos <= Math.max(...positions); pos++) {
    const row = byPos.get(pos) || rowAt(pos);
    row.leaves.sort((x, y) => (row.neg ? y - x : x - y));
    row.label = `${row.neg ? '-' : ''}${row.stem}`;
    rows.push(row);
  }
  return { rows, leafUnit };
}

// ---------- Two variables ----------

export function regression(x, y) {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  const sx = sampleSD(x);
  const sy = sampleSD(y);
  let sxy = 0;
  for (let i = 0; i < n; i++) sxy += (x[i] - mx) * (y[i] - my);
  const r = sxy / ((n - 1) * sx * sy);
  const b = r * (sy / sx);
  const a = my - b * mx;
  const predicted = x.map(v => a + b * v);
  const residuals = y.map((v, i) => v - predicted[i]);
  const s = n > 2 ? Math.sqrt(sum(residuals.map(e => e * e)) / (n - 2)) : NaN;
  return { n, mx, my, sx, sy, r, r2: r * r, a, b, predicted, residuals, s };
}

// ---------- Normal distribution ----------

// Complementary error function (Numerical Recipes Chebyshev fit), only used in
// the tails where its 1.2e-7 relative error is far below display precision.
function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

// Standard normal CDF. Uses a series for |z| small to keep full precision near 0.
export function normCdfStd(z) {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  if (Math.abs(z) < 3) {
    // Taylor series for the integral of the standard normal density from 0 to z.
    let term = z;
    let total = z;
    const z2 = z * z;
    for (let k = 1; k < 200; k++) {
      term *= -z2 / (2 * k);
      const add = term / (2 * k + 1);
      total += add;
      if (Math.abs(add) < 1e-17) break;
    }
    return 0.5 + total / Math.sqrt(2 * Math.PI);
  }
  return 0.5 * erfc(-z / Math.SQRT2);
}

export const normalPdf = (x, mu = 0, sigma = 1) =>
  Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

export const normalCdf = (lo, hi, mu = 0, sigma = 1) =>
  normCdfStd((hi - mu) / sigma) - normCdfStd((lo - mu) / sigma);

// Inverse standard normal (Acklam), refined with Newton steps.
export function invNormStd(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let x;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  for (let i = 0; i < 2; i++) {
    const err = normCdfStd(x) - p;
    x -= err / normalPdf(x);
  }
  return x;
}

export const invNorm = (p, mu = 0, sigma = 1) => mu + sigma * invNormStd(p);

// ---------- Simulation helpers ----------

export function binomialDraw(n, p, rand = Math.random) {
  let count = 0;
  for (let i = 0; i < n; i++) if (rand() < p) count++;
  return count;
}

export function shuffleInPlace(arr, rand = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Formatting ----------

// Round for display: up to `digits` decimal places, trimming trailing zeros.
export function fmt(v, digits = 4) {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  if (v === Infinity) return '∞';
  if (v === -Infinity) return '−∞';
  const r = Number(v.toFixed(digits));
  const s = String(Object.is(r, -0) ? 0 : r);
  return s.includes('e') ? v.toPrecision(4) : s.replace('-', '−');
}
