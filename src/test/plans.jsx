import React from 'react';
import * as bank from '../lib/bank.js';
import * as store from '../lib/store.js';
import { L_PARTS, R_PARTS, W_TASKS, S_TASKS, PART_LIST, SKILL, partName, partWord } from '../lib/bankShape.js';
import { avg, pick, round1 } from '../lib/util.js';

const label = (c, n) => n === 0 ? `${SKILL[c]} – Practice Task` : `${SKILL[c]} – ${partWord(c)} ${n}: ${partName(c, n)}`;
const Box = ({ children }) => <div className="rounded-[4px] border border-[#d5d9e0] bg-[#fafbfc] px-6 py-5">{children}</div>;
const info = (lbl, comp, body, nextLabel) => ({ kind: 'info', label: lbl, comp, body, nextLabel });

function practicePart(c) {
  const P = bank.practice;
  if (c === 'L') return { n: 0, sp: P.L.sp, sections: [{ lines: P.L.lines, qs: [P.L.q] }] };
  return null;
}
export function partSteps(content, c, n) {
  const id = content.id;
  if (c === 'L') {
    const part = content.L.parts.find(p => p.n === n); const nq = part.sections.reduce((k, s) => k + s.qs.length, 0);
    return [info(label('L', n), 'L', <><h2 className="mb-3 text-2xl font-bold">Listening Part {n}: {L_PARTS[n].name}</h2><Box><p>{L_PARTS[n].desc}</p>{part.context && <p className="mt-3 font-bold">{part.context}</p>}<p className="mt-3">The recording starts as soon as you press NEXT. Questions: {nq}. Answering time: about {Math.round(nq * 40 / 60)} minutes.</p></Box></>),
      { kind: 'L-part', label: label('L', n), comp: 'L', part, n, testId: id }];
  }
  if (c === 'R') return [{ kind: 'R-part', label: label('R', n), comp: 'R', part: content.R['p' + n], n, testId: id }];
  if (c === 'W') return [{ kind: 'W-task', label: label('W', n), comp: 'W', task: content.W['t' + n], n, testId: id }];
  if (c === 'S') return [{ kind: 'S-task', label: label('S', n), comp: 'S', task: content.S['t' + n], n, testId: id, content }];
  return [];
}
function introSteps(c, withPractice) {
  const s = [];
  if (c === 'L') { s.push({ kind: 'L-intro', label: 'Listening Test – Instructions', comp: 'L' }); if (withPractice) s.push(info(label('L', 0), 'L', <><span className="mb-3 inline-block rounded-full border border-slate-300 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600">Practice – not scored</span><h2 className="mb-3 text-2xl font-bold">Practice Task</h2><Box><p>{bank.practice.L.intro}</p><p className="mt-2">This task helps you get used to the format. Press NEXT to hear the conversation.</p></Box></>), { kind: 'L-part', label: label('L', 0), comp: 'L', part: practicePart('L'), n: 0, practice: true }); }
  if (c === 'R') { s.push({ kind: 'R-intro', label: 'Reading Test – Instructions', comp: 'R' }); if (withPractice) s.push({ kind: 'R-part', label: label('R', 0), comp: 'R', part: bank.practice.R, n: 0, practice: true }); }
  if (c === 'W') { s.push({ kind: 'W-intro', label: 'Writing Test – Instructions', comp: 'W' }); if (withPractice) s.push({ kind: 'W-task', label: label('W', 0), comp: 'W', task: bank.practice.W, n: 0, practice: true }); }
  if (c === 'S') { s.push({ kind: 'S-intro', label: 'Speaking Test – Instructions', comp: 'S' }); if (withPractice) s.push({ kind: 'S-task', label: label('S', 0), comp: 'S', task: bank.practice.S, n: 0, practice: true }); }
  return s;
}
export const componentSteps = (content, c, practice = true) => introSteps(c, practice).concat(...PART_LIST[c].map(n => partSteps(content, c, n)));

export async function fullPlan(id) {
  const content = await bank.loadContent(id);
  const intro = info('Full Mock Test', null, <><h2 className="mb-3 text-2xl font-bold">Full Mock Test – {content.title}</h2><Box>
    <p>This mock test follows the real computer-delivered test order: <b>Listening → Reading → Writing → Speaking</b> (about 3 hours). Each component starts with instructions and a short unscored practice task.</p>
    <ul className="mt-3 list-disc space-y-1.5 pl-6"><li>No feedback is shown during the test. Your scores, the full answer key and the strict AI evaluation appear only after the whole test is submitted.</li><li>You cannot go back to a part you have finished. Timers move you on automatically.</li><li>Use headphones and a microphone, in Chrome or Edge, in a quiet room.</li></ul></Box>
    <p className="mt-4 text-xs text-slate-500">Unofficial practice with original content. Not affiliated with or endorsed by the official test owner.</p></>, 'START TEST');
  return { title: `Full mock test – ${content.title}`, mode: 'full', steps: [intro, ...['L', 'R', 'W', 'S'].flatMap(c => componentSteps(content, c))] };
}
export async function componentPlan(id, c) {
  const content = await bank.loadContent(id);
  return { title: `${SKILL[c]} – ${content.title}`, mode: 'component', steps: componentSteps(content, c) };
}
export async function partPlan(id, c, n) {
  const content = await bank.loadContent(id);
  return { title: `${SKILL[c]} ${partWord(c)} ${n} drill – ${content.title}`, mode: 'part', steps: introSteps(c, false).concat(partSteps(content, c, n)) };
}

/* ---------- Daily 30-minute workout: weakest skill + most-missed question type, unseen material first ---------- */
export function skillAverages() {
  const h = store.history().slice(-12); const out = {};
  ['L', 'R', 'W', 'S'].forEach(c => { const v = h.map(a => a.levels && a.levels[c]).filter(x => x != null); out[c] = v.length ? round1(avg(v.slice(-4))) : null; });
  return out;
}
export function weakTypes() {
  const agg = {};
  store.history().slice(-10).forEach(a => ['L', 'R'].forEach(c => { if (!a[c]) return; Object.entries(a[c].types || {}).forEach(([t, [ok, tot]]) => { const k = c + '|' + t; agg[k] = agg[k] || [0, 0]; agg[k][0] += ok; agg[k][1] += tot; }); }));
  return Object.entries(agg).map(([k, [ok, tot]]) => { const [comp, type] = k.split('|'); return { comp, type, ok, tot, acc: ok / tot }; }).filter(x => x.tot >= 3).sort((a, b) => a.acc - b.acc);
}
export function freshest(c, n) {
  const tests = bank.all().filter(t => bank.testHas(t.id, c, n));
  return tests.slice().sort((a, b) => store.seenCount(`${a.id}.${c}${n}`) - store.seenCount(`${b.id}.${c}${n}`) || Math.random() - 0.5)[0];
}
export function dailyItems() {
  const av = skillAverages(); const day = Math.floor(Date.now() / 864e5);
  const known = Object.entries(av).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]).map(([c]) => c);
  const weakest = known[0] || ['L', 'R', 'S', 'W'][day % 4];
  const wt = weakTypes()[0];
  const pL = () => wt && wt.comp === 'L' && ['attitude', 'viewpoint', 'inference'].includes(wt.type) ? pick([5, 6]) : pick([1, 2, 3, 4, 5, 6]);
  const pR = () => wt && wt.comp === 'R' && wt.type === 'notgiven' ? 3 : wt && wt.comp === 'R' && ['attitude', 'viewpoint'].includes(wt.type) ? 4 : pick([1, 2, 3, 4]);
  let items = weakest === 'L' ? [['L', pL()], ['L', pL()], ['R', pR()]] : weakest === 'R' ? [['R', pR()], ['R', pR()], ['L', pL()]] : weakest === 'W' ? [['W', day % 2 ? 1 : 2], ['S', pick([1, 7])]] : [['S', 1], ['S', pick([3, 8])], ['S', 5], ['S', pick([6, 7])], ['L', pL()]];
  const seen = new Set(); items = items.filter(([c, n]) => !seen.has(c + n) && seen.add(c + n));
  return { weakest, wt, reason: known.length ? `${SKILL[weakest]} is your lowest recent skill (≈ Level ${av[weakest]})` : `Today’s rotation focus is ${SKILL[weakest]}`, items: items.map(([c, n]) => ({ c, n, test: freshest(c, n) })).filter(i => i.test) };
}
export async function dailyPlan(d) {
  let steps = [info('Daily 30-Minute Workout', null, <><h2 className="mb-3 text-2xl font-bold">Daily 30-Minute Workout</h2><Box><p>{d.reason}{d.wt ? `; your most-missed question type is “${d.wt.type}”` : ''}.</p><p className="mt-2">Today:</p><ol className="mt-1 list-decimal pl-6">{d.items.map((i, k) => <li key={k}>{SKILL[i.c]} {partWord(i.c)} {i.n}: {partName(i.c, i.n)} <span className="text-slate-500">({i.test.title})</span></li>)}</ol><p className="mt-2">Real timers, no feedback until the end.</p></Box></>, 'START')];
  const done = {};
  for (const i of d.items) { const content = await bank.loadContent(i.test.id); if (!done[i.c]) steps = steps.concat(introSteps(i.c, false)); done[i.c] = true; steps = steps.concat(partSteps(content, i.c, i.n)); }
  return { title: `Daily workout – ${new Date().toLocaleDateString()}`, mode: 'daily', steps };
}
