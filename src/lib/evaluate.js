// Evaluation pipeline – runs only AFTER the whole test (or drill) is submitted.
import * as store from './store.js';
import * as bank from './bank.js';
import * as ai from './ai.js';
import { collectLR, summarizeLR, offlineWriting, offlineSpeaking, typeName } from './grading.js';
import { SKILL } from './bankShape.js';
import { avg, round1, wordCount } from './util.js';

export const DIM_NAMES = { content: 'Content / Coherence', vocabulary: 'Vocabulary', readability: 'Readability', listenability: 'Listenability', task: 'Task Fulfillment' };

export async function loadTestsFor(att) {
  const out = {};
  for (const id of att.tests) { try { out[id] = await bank.loadWithKey(id); } catch (e) { console.warn('missing test', id); } }
  return out;
}
const keyParts = k => { const [tid, part] = k.split('.'); return { tid, comp: part[0], n: +part.slice(1) }; };

export async function evalWriting(att, k, tests, skipAI, onStatus) {
  const rec = att.session.writing[k]; const { tid, n } = keyParts(k); const task = tests[tid].content.W['t' + n];
  let ev = null, err = null;
  if (!skipAI && ai.available() && wordCount(rec.text) >= 10) { try { ev = await ai.gradeWriting(task, n, rec, { onStatus }); } catch (e) { err = e.message; } }
  if (!ev) { ev = offlineWriting(task, n, rec); if (err) ev.error = err; }
  att.evals[k] = ev;
}
export async function evalSpeaking(att, k, tests, skipAI, onStatus) {
  const rec = att.session.speaking[k]; const { tid, n } = keyParts(k); const content = tests[tid].content; const task = content.S['t' + n];
  let ev = null, err = null;
  if (!skipAI && ai.available() && wordCount(rec.transcript) >= 8) { try { ev = await ai.gradeSpeaking(task, n, rec, content, { onStatus }); } catch (e) { err = e.message; } }
  if (!ev) { ev = offlineSpeaking(n === 4 ? Object.assign({}, task, { scene: content.S.t3.scene }) : task, n, rec); if (err) ev.error = err; }
  att.evals[k] = ev;
}

export function summarize(att, tests) {
  if (tests) { const items = collectLR(att.session, tests); att.L = summarizeLR(items, 'L'); att.R = summarizeLR(items, 'R'); }
  ['W', 'S'].forEach(c => {
    const keys = Object.keys(att.evals).filter(k => k.includes('.' + c));
    if (!keys.length) { att[c] = null; return; }
    const evs = keys.map(k => att.evals[k]).filter(e => e && e.dims);
    const dims = {}; evs.forEach(e => Object.entries(e.dims).forEach(([d, v]) => (dims[d] = dims[d] || []).push(v)));
    Object.keys(dims).forEach(d => dims[d] = round1(avg(dims[d])));
    const lv = evs.filter(e => e.overall != null).map(e => e.overall);
    att[c] = { level: lv.length ? round1(avg(lv)) : null, dims, n: keys.length, ai: evs.some(e => e.ai), offline: evs.some(e => e.offline) };
  });
  const weak = [];
  ['L', 'R'].forEach(c => { const s = att[c]; if (!s) return; Object.entries(s.types).forEach(([t, [ok, tot]]) => { if (tot >= 2) weak.push({ comp: c, type: t, acc: ok / tot, ok, tot }); }); });
  att.weakTypes = weak.sort((a, b) => a.acc - b.acc).slice(0, 6);
  att.levels = { L: att.L && att.L.level, R: att.R && att.R.level, W: att.W && att.W.level, S: att.S && att.S.level };
  return att;
}

export function localWeaknesses(att) {
  const target = store.settings().targetLevel || 10, out = [];
  Object.entries(att.levels || {}).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]).forEach(([c, lv]) => {
    if (lv < target) out.push({ title: `${SKILL[c]} is around Level ${lv}`, why: `${round1(target - lv)} below your Level ${target} target.`, fix: { L: 'Daily Part 5/6 drills; note every opinion word and every change of plan while listening.', R: 'Timed Part 3 and 4 drills; prove every answer with a sentence before choosing it.', W: 'One timed email every other day; check all three bullets, tone and 150–200 words before submitting.', S: 'Record Tasks 1, 5 and 7 daily; aim for 120–150 words per minute and fewer fillers.' }[c] });
  });
  (att.weakTypes || []).filter(w => w.acc < 0.75).slice(0, 2).forEach(w => out.push({ title: `${SKILL[w.comp]}: ${typeName(w.type)} (${w.ok}/${w.tot})`, why: 'This question type cost you the most marks.', fix: w.type === 'notgiven' ? 'For each E answer, find the paragraph that almost says it and name the missing detail.' : ['attitude', 'viewpoint'].includes(w.type) ? 'Listen/read for hedges and evaluative words (admittedly, I’m not convinced, I suppose) and for shifts after “but”.' : w.type === 'inference' ? 'Ask “what must be true?” – reject options that need an extra assumption.' : 'Match meaning, not words: the correct option is usually a paraphrase; repeated words often signal a trap.' }));
  ['W', 'S'].forEach(c => { const d = att[c] && att[c].dims; if (d && Object.keys(d).length) { const [k, v] = Object.entries(d).sort((a, b) => a[1] - b[1])[0]; if (v < target) out.push({ title: `${SKILL[c]} – ${DIM_NAMES[k]} (≈${v})`, why: 'Your lowest rubric dimension in this skill.', fix: k === 'task' ? 'Tick off every required point, the tone for your reader and the length before you finish.' : k === 'vocabulary' ? 'Learn and reuse 5 topic collocations a day; replace general words (good, thing, very) with precise ones.' : k === 'content' ? 'Use a fixed plan: position → two reasons, each with a concrete example → wrap-up.' : 'Mix short and complex sentences, use clear connectors, and proofread for articles and verb tenses.' }); } });
  return out.slice(0, 3);
}

export function offlinePlan(att) {
  const order = Object.entries(att.levels || {}).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]).map(([c]) => c);
  ['L', 'R', 'W', 'S'].forEach(c => { if (!order.includes(c)) order.push(c); });
  const drill = { L: 'Listening Part 5 or 6 drill, then re-read the transcript for every wrong answer', R: 'Reading Part 3 or 4 drill (timed), then write the proof sentence for each answer', W: 'Writing Task 1 email in 27 minutes, then compare with the Level 12 model', S: 'Speaking Tasks 1, 5 and 7 recorded, then replay and count fillers' };
  const wt = (att.weakTypes || [])[0];
  return { offline: true, weaknesses: localWeaknesses(att), plan: [1, 2, 3, 4, 5, 6, 7].map(d => { const a = order[(d - 1) % 2 ? 1 : 0], b = order[(d + 1) % 4]; const tasks = [drill[a], d === 7 ? 'Full mock test or a full component under exam conditions' : drill[b]]; if (wt && d % 2) tasks.push(`10-minute review of ${typeName(wt.type)} questions in ${SKILL[wt.comp]}`); return { day: d, focus: d === 7 ? 'Exam simulation' : `${SKILL[a]} + ${SKILL[b]}`, minutes: d === 7 ? 60 : 40, tasks }; }) };
}

export async function makePlan(att, skipAI, onStatus) {
  if (!skipAI && ai.available()) {
    try {
      const r = await ai.plan({ target: store.settings().targetLevel, levels: att.levels, listening: att.L && { raw: att.L.raw, total: att.L.total, byType: att.L.types }, reading: att.R && { raw: att.R.raw, total: att.R.total, byType: att.R.types }, writing: att.W, speaking: att.S }, { onStatus });
      if (r && Array.isArray(r.plan) && r.plan.length) { att.plan = { weaknesses: (r.weaknesses || []).slice(0, 3), plan: r.plan.slice(0, 7) }; return; }
    } catch (e) { onStatus && onStatus(e.message); }
  }
  att.plan = offlinePlan(att);
}

/* Full pipeline. onProgress(steps[]) is called whenever a step changes. shouldSkip() lets the user skip AI. */
export async function evaluate(session, { onProgress, shouldSkip } = {}) {
  const att = {
    id: session.id, date: new Date().toISOString(), mode: session.mode, title: session.title,
    durationMin: Math.max(1, Math.round((Date.now() - new Date(session.started).getTime()) / 60000)),
    tests: [...new Set(session.scoredParts.map(p => p.testId))], parts: session.scoredParts,
    session: { id: session.id, answers: session.answers, writing: session.writing, speaking: session.speaking, scoredParts: session.scoredParts },
    evals: {}, provider: ai.provider(), aiExplain: {}
  };
  const steps = [{ k: '_lr', label: 'Scoring Listening & Reading from the answer key' }];
  Object.keys(session.writing).forEach(k => steps.push({ k, label: `Writing Task ${k.split('.W')[1]}` }));
  Object.keys(session.speaking).forEach(k => steps.push({ k, label: `Speaking Task ${k.split('.S')[1]}` }));
  steps.push({ k: '_plan', label: 'Final report and 7-day plan' });
  const push = () => onProgress && onProgress(steps.map(s => Object.assign({}, s)));
  const tests = await loadTestsFor(att);
  for (const st of steps) {
    st.state = 'run'; push();
    try {
      const skip = shouldSkip && shouldSkip();
      if (st.k === '_lr') summarize(att, tests);
      else if (st.k === '_plan') { summarize(att); await makePlan(att, skip, m => { st.msg = m; push(); }); }
      else if (st.k.includes('.W')) await evalWriting(att, st.k, tests, skip, m => { st.msg = m; push(); });
      else await evalSpeaking(att, st.k, tests, skip, m => { st.msg = m; push(); });
      st.state = 'done'; st.msg = '';
    } catch (e) { console.error(e); st.state = 'err'; st.msg = e.message; }
    push(); store.saveAttempt(att);
  }
  summarize(att); store.saveAttempt(att);
  session.scoredParts.forEach(p => store.markSeen(`${p.testId}.${p.comp}${p.n}`));
  return att;
}
