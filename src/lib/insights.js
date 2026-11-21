// Turns stored attempts into "where do I need to improve?" analytics for the dashboard.
import * as store from './store.js';
import { PART_LIST, partName, partWord, SKILL } from './bankShape.js';
import { typeName } from './grading.js';
import { round1, avg } from './util.js';

// Lowest raw score (out of 38) for each level, from the official approximate charts.
const LMIN = { 12: 35, 11: 35, 10: 35, 9: 33, 8: 30, 7: 27, 6: 22, 5: 17, 4: 11, 3: 7 };
const RMIN = { 12: 33, 11: 33, 10: 33, 9: 31, 8: 28, 7: 24, 6: 19, 5: 15, 4: 10, 3: 8 };
export const neededAccuracy = (c, target) => ((c === 'L' ? LMIN : RMIN)[Math.min(12, Math.max(3, target))] || 33) / 38;
const DIM_LABEL = { content: 'Content / Coherence', vocabulary: 'Vocabulary', readability: 'Readability', listenability: 'Listenability', task: 'Task Fulfillment' };

/** Everything the dashboard needs, computed from the last `window` attempts. */
export function insights(window = 20) {
  const target = store.settings().targetLevel || 10;
  const hist = store.history().slice(-window);
  const part = {}; // key "L3" -> { ok, tot, levels:[], last, n }
  const touch = (k, date) => { part[k] = part[k] || { ok: 0, tot: 0, levels: [], n: 0, last: 0 }; part[k].n++; part[k].last = Math.max(part[k].last, date || 0); return part[k]; };
  const dims = { W: {}, S: {} }; const advice = []; const types = {};

  hist.forEach(a => {
    const date = +new Date(a.date);
    ['L', 'R'].forEach(c => {
      if (!a[c]) return;
      Object.entries(a[c].parts || {}).forEach(([n, [ok, tot]]) => { const p = touch(c + n, date); p.ok += ok; p.tot += tot; });
      Object.entries(a[c].types || {}).forEach(([t, [ok, tot]]) => { const k = c + '|' + t; types[k] = types[k] || [0, 0]; types[k][0] += ok; types[k][1] += tot; });
    });
    Object.entries(a.evals || {}).forEach(([k, ev]) => {
      const m = /\.(W|S)(\d)$/.exec(k); if (!m || !ev) return;
      const [, c, n] = m; const p = touch(c + n, date);
      if (ev.overall != null) p.levels.push(ev.overall);
      Object.entries(ev.dims || {}).forEach(([d, v]) => (dims[c][d] = dims[c][d] || []).push(v));
      (ev.top_fixes || []).slice(0, 2).forEach(f => advice.push({ c, n: +n, text: f, date, ai: !!ev.ai }));
    });
  });

  // Per-part status, including parts never practised.
  const map = {};
  ['L', 'R', 'W', 'S'].forEach(c => {
    map[c] = PART_LIST[c].map(n => {
      const p = part[c + n];
      if (!p) return { c, n, name: partName(c, n), status: 'new' };
      if (c === 'L' || c === 'R') {
        const acc = p.tot ? p.ok / p.tot : null, need = neededAccuracy(c, target);
        return { c, n, name: partName(c, n), acc, need, ok: p.ok, tot: p.tot, times: p.n, last: p.last, gap: acc == null ? 0 : need - acc, status: acc == null ? 'new' : acc >= need ? 'good' : acc >= need - 0.12 ? 'close' : 'weak' };
      }
      const lv = p.levels.length ? round1(avg(p.levels.slice(-3))) : null;
      return { c, n, name: partName(c, n), level: lv, times: p.n, last: p.last, gap: lv == null ? 0 : (target - lv) / 12, status: lv == null ? 'new' : lv >= target ? 'good' : lv >= target - 1 ? 'close' : 'weak' };
    });
  });

  // Writing / Speaking dimension averages (most recent 6 ratings per dimension).
  const dimRows = c => Object.entries(dims[c]).map(([d, v]) => ({ d, label: DIM_LABEL[d] || d, level: round1(avg(v.slice(-6))), n: v.length })).sort((a, b) => a.level - b.level);

  // Skill trend: latest vs. average of the previous three results.
  const trend = {};
  ['L', 'R', 'W', 'S'].forEach(c => {
    const v = store.history().map(a => a.levels && a.levels[c]).filter(x => x != null);
    trend[c] = v.length >= 2 ? round1(v[v.length - 1] - avg(v.slice(-4, -1))) : null;
  });

  // Ranked focus queue: biggest gaps first, then parts never practised.
  const focus = [];
  ['L', 'R', 'W', 'S'].forEach(c => map[c].forEach(p => { if (p.status === 'weak' || p.status === 'close') focus.push(Object.assign({ kind: 'part', score: p.gap + (p.status === 'weak' ? 0.1 : 0) }, p)); }));
  ['W', 'S'].forEach(c => dimRows(c).forEach(r => { if (r.level < target) focus.push({ kind: 'dim', c, d: r.d, label: r.label, level: r.level, score: (target - r.level) / 12 + 0.02 }); }));
  Object.entries(types).forEach(([k, [ok, tot]]) => { const [c, t] = k.split('|'); if (tot >= 4 && ok / tot < neededAccuracy(c, target) - 0.1) focus.push({ kind: 'type', c, t, label: typeName(t), acc: ok / tot, ok, tot, score: neededAccuracy(c, target) - ok / tot - 0.05 }); });
  focus.sort((a, b) => b.score - a.score);
  const untouched = ['L', 'R', 'W', 'S'].flatMap(c => map[c].filter(p => p.status === 'new'));

  // Recent rater advice, newest first, without duplicates.
  const seen = new Set();
  const tips = advice.sort((a, b) => b.date - a.date).filter(a => { const k = a.text.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);

  const practised = Object.keys(part).length, total = 20;
  return { target, map, dims: { W: dimRows('W'), S: dimRows('S') }, trend, focus: focus.slice(0, 6), untouched, tips, coverage: practised / total, attempts: hist.length };
}

export const partLabel = p => `${SKILL[p.c]} ${partWord(p.c)} ${p.n}`;
