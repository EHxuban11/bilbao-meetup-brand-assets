// Clean-up helpers for normalised clips.
// smoothClipped(frames, clippedIdx): in runs of frames where the bot is cut by the frame edge,
// x offset and rotation from registration are unreliable (a sliver of body carries little
// information). Replace them with a robust quadratic fit over the run plus 5 neighbours.
const r2 = v => Math.round(v * 100) / 100;
function polyfit(xs, ys, deg = 2) {
  const n = deg + 1, A = Array.from({ length: n }, () => Array(n + 1).fill(0));
  xs.forEach((x, k) => { for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] += x ** (i + j); A[i][n] += ys[k] * x ** i; } });
  for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]];
    for (let r = 0; r < n; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c <= n; c++) A[r][c] -= f * A[i][c]; } }
  const c = A.map((row, i) => row[n] / row[i]); return x => c.reduce((s, ci, i) => s + ci * x ** i, 0);
}
function robustFit(xs, ys, tol) {
  let keep = xs.map((_, i) => i);
  for (let it = 0; it < 4; it++) {
    const f = polyfit(keep.map(i => xs[i]), keep.map(i => ys[i]), Math.min(2, keep.length - 1));
    const res = xs.map((x, i) => Math.abs(ys[i] - f(x)));
    const nk = xs.map((_, i) => i).filter(i => res[i] <= Math.max(tol, 2.5 * median(keep.map(k => res[k]))));
    if (nk.length === keep.length || nk.length < 3) return f; keep = nk;
  }
  return polyfit(keep.map(i => xs[i]), keep.map(i => ys[i]), Math.min(2, keep.length - 1));
}
const median = a => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };
export function smoothClipped(frames, clipped) {
  const set = new Set(clipped.filter(i => frames[i]));
  const runs = []; let cur = [];
  for (let i = 0; i < frames.length; i++) { if (set.has(i)) cur.push(i); else if (cur.length) { runs.push(cur); cur = []; } }
  if (cur.length) runs.push(cur);
  for (const run of runs) {
    const nb = [];
    for (let k = run.at(-1) + 1; k < frames.length && nb.length < 5; k++) if (frames[k] && !set.has(k)) nb.push(k);
    for (let k = run[0] - 1; k >= 0 && nb.length < 10; k--) if (frames[k] && !set.has(k)) nb.push(k);
    const idx = [...run, ...nb].sort((a, b) => a - b);
    for (const ch of [0, 2]) { // dx, rot
      const f = robustFit(idx, idx.map(i => frames[i].b[ch]), ch === 0 ? 3 : 0.6);
      for (const i of run) frames[i].b[ch] = r2(f(i));
    }
  }
  return frames;
}
