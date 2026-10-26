// Checks the math against known TI-84 answers. Run with:  node tests/stats.test.mjs
import assert from 'node:assert/strict';
import * as S from '../js/stats.js';

const close = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) < tol, `${a} is not close to ${b}`);

// 1-Var Stats on {1, 3, 4, 6, 7, 8, 9, 12, 15, 22, 40}
const st = S.summary([1, 3, 4, 6, 7, 8, 9, 12, 15, 22, 40]);
close(st.mean, 11.5455);
close(st.sx, 11.1478);
close(st.sigma, 10.6290);
assert.deepEqual([st.min, st.q1, st.median, st.q3, st.max], [1, 4, 8, 15, 40]);
assert.deepEqual(st.highOutliers, [40]);

// Even n quartiles (TI method): {1..8} -> Q1 2.5, Q3 6.5
const q = S.quartiles([1, 2, 3, 4, 5, 6, 7, 8]);
assert.deepEqual([q.q1, q.q3], [2.5, 6.5]);

// LinReg(a+bx) on x {1..5}, y {2,4,5,4,5}: a 2.2, b 0.6, r 0.7746
const fit = S.regression([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
close(fit.a, 2.2);
close(fit.b, 0.6);
close(fit.r, 0.774597);

// normalcdf and invNorm
close(S.normalCdf(-1, 1), 0.682689);
close(S.normalCdf(-Infinity, 68, 64, 2.5), 0.945201);
close(S.normCdfStd(-3.5), 0.000232629, 1e-8);
close(S.invNorm(0.975), 1.959964);
close(S.invNorm(0.1, 100, 15), 80.77673);

// Stemplot with a negative stem
const sp = S.stemplot([-12, -5, 3, 14]);
assert.deepEqual(sp.rows.map(r => `${r.label}|${r.leaves.join('')}`), ['-1|2', '-0|5', '0|3', '1|4']);

// Simulation: binomial draws center near n·p
let total = 0;
for (let i = 0; i < 2000; i++) total += S.binomialDraw(100, 0.5);
close(total / 2000, 50, 1);

console.log('All stats tests passed.');
