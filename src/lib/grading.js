// Local scoring: Listening/Reading from the answer key using the published approximate raw-score charts,
// and transparent offline estimates for Writing/Speaking when no AI provider is available.
import { partQuestions, qid, S_TASKS } from './bankShape.js';
import { avg, clamp, sentences, wordCount } from './util.js';

/* Published approximate charts (raw /38 → level). Where ranges overlap we take the LOWER level (strict).
   Listening: 35–38 → 10–12, 33–35 → 9, 30–33 → 8, 27–31 → 7, 22–28 → 6, 17–23 → 5, 11–18 → 4, 7–12 → 3, 0–7 → M
   Reading:   33–38 → 10–12, 31–33 → 9, 28–31 → 8, 24–28 → 7, 19–25 → 6, 15–20 → 5, 10–16 → 4, 8–11 → 3, 0–7 → M */
const LTAB = [[35, 10], [33, 9], [30, 8], [27, 7], [22, 6], [17, 5], [11, 4], [7, 3], [0, 2]];
const RTAB = [[33, 10], [31, 9], [28, 8], [24, 7], [19, 6], [15, 5], [10, 4], [8, 3], [0, 2]];
export const levelFromRaw = (comp, raw) => { for (const [min, lv] of (comp === 'L' ? LTAB : RTAB)) if (raw >= min) return lv; return 2; };
export const levelFromPct = (comp, pct) => levelFromRaw(comp, Math.round(pct * 38));
export const levelLabel = (lv, comp) => lv == null ? '–' : lv <= 2 ? 'M' : (lv >= 10 && (comp === 'L' || comp === 'R')) ? '10–12' : String(Math.round(lv * 10) / 10);
export const TYPE_NAMES = {
  detail: 'Specific details', inference: 'Inference', attitude: 'Attitude & tone', main: 'Main idea', purpose: 'Purpose of a statement',
  prediction: 'Predicting what happens next', paraphrase: 'Paraphrased information', vocab: 'Meaning in context', notgiven: '“Not given” (E) traps',
  viewpoint: 'Viewpoints & opinions', diagram: 'Applying a diagram', coherence: 'Text completion'
};
export const typeName = t => TYPE_NAMES[t] || t;

/* Build answer-key items for every scored L/R question in a session. tests: { id: {content, key} } */
export function collectLR(session, tests) {
  const items = [];
  for (const sp of session.scoredParts) {
    if (sp.comp !== 'L' && sp.comp !== 'R') continue;
    const T = tests[sp.testId]; if (!T) continue;
    const offset = globalOffset(T.content, sp.comp, sp.n);
    partQuestions(T.content, sp.comp, sp.n).forEach((x, i) => {
      const k = T.key.q[offset + i] || {};
      const id = qid(sp.testId, sp.comp, sp.n, i);
      const options = x.kind === 'match' ? ['Paragraph A', 'Paragraph B', 'Paragraph C', 'Paragraph D', 'E – Not given in any paragraph'] : x.q.o;
      const your = session.answers[id];
      items.push({ id, comp: sp.comp, n: sp.n, i, testId: sp.testId, kind: x.kind, section: x.section, label: x.label, q: x.q.q || x.label, o: options, a: k.a, t: x.q.t || 'detail', ev: k.ev, x: k.x, your, correct: your === k.a });
    });
  }
  return items;
}
function globalOffset(content, comp, n) {
  let off = 0;
  for (const c of ['L', 'R']) for (const m of (c === 'L' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4])) { if (c === comp && m === n) return off; off += partQuestions(content, c, m).length; }
  return off;
}

export function summarizeLR(items, comp) {
  const its = items.filter(i => i.comp === comp); if (!its.length) return null;
  const raw = its.filter(i => i.correct).length, total = its.length, full = total >= 38;
  const types = {}, parts = {};
  its.forEach(i => { const t = i.t; types[t] = types[t] || [0, 0]; types[t][1]++; if (i.correct) types[t][0]++; parts[i.n] = parts[i.n] || [0, 0]; parts[i.n][1]++; if (i.correct) parts[i.n][0]++; });
  return { raw, total, full, scaled: full ? raw : Math.round(raw / total * 38), level: full ? levelFromRaw(comp, raw) : levelFromPct(comp, raw / total), types, parts };
}

/* ---------- text metrics ---------- */
const CONNECTORS = ['however', 'therefore', 'moreover', 'in addition', 'for example', 'for instance', 'although', 'even though', 'while', 'as a result', 'on the other hand', 'firstly', 'secondly', 'finally', 'consequently', 'furthermore', 'instead', 'since', 'because', 'unless', 'whereas', 'in fact', 'that said', 'otherwise', 'overall', 'in my opinion', 'not only', 'on top of that', 'admittedly', 'in short', 'which means', 'so that', 'to begin with', 'what is more'];
const STOP = new Set('the a an and or but if of to in on at for with from by as is are was were be been being this that these those it its you your i me my we our they them their he she his her not no do does did have has had will would can could should may might must about into over than then so very just also there here what which who whom when where why how all any some more most such only own same too'.split(' '));
export function metrics(text) {
  const w = (text.toLowerCase().match(/[a-z']+/g) || []);
  const sents = sentences(text).filter(s => wordCount(s) > 0);
  const paras = text.split(/\n\s*\n|\n/).filter(p => p.trim()).length;
  let mattr = 0;
  if (w.length >= 50) { let sum = 0, n = 0; for (let i = 0; i + 50 <= w.length; i += 5) { sum += new Set(w.slice(i, i + 50)).size / 50; n++; } mattr = sum / n; }
  else mattr = w.length ? new Set(w).size / w.length * 0.88 : 0;
  const lower = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
  const connectors = CONNECTORS.filter(c => lower.includes(' ' + c + ' ') || lower.includes(' ' + c + ',')).length;
  const issues = [];
  sents.forEach(s => { const t = s.trim(); if (/^[a-z]/.test(t)) issues.push(`Sentence starts with a lowercase letter: “${t.slice(0, 40)}…”`); });
  if (/\bi\b/.test(text)) issues.push('The pronoun “I” is written in lowercase.');
  const rep = text.match(/\b(\w+)\s+\1\b/i); if (rep) issues.push(`Repeated word: “${rep[0]}”.`);
  if (/[a-z][.!?][A-Za-z]/.test(text)) issues.push('Missing space after punctuation.');
  if (text.trim() && !/[.!?]["')”]?$/.test(text.trim())) issues.push('The last sentence has no final punctuation.');
  const longSent = sents.filter(s => wordCount(s) > 38).length; if (longSent) issues.push(`${longSent} very long sentence(s) – possible run-ons.`);
  return { words: w.length, sentences: sents.length, paras, avgSent: sents.length ? w.length / sents.length : 0, mattr, longRatio: w.length ? w.filter(x => x.length >= 7).length / w.length : 0, connectors, issues };
}
const keywords = t => [...new Set((String(t).toLowerCase().match(/[a-z]{5,}/g) || []).filter(x => !STOP.has(x)))];
const coverage = (ref, text) => { const k = keywords(ref); if (!k.length) return 1; const t = text.toLowerCase(); return k.filter(x => t.includes(x.slice(0, Math.max(5, x.length - 3)))).length / k.length; };
const cap = v => Math.round(clamp(v, 3, 10));

/* Offline Writing estimate (capped at 10 and clearly labelled) */
export function offlineWriting(task, n, rec) {
  const text = (rec && rec.text) || ''; const m = metrics(text);
  if (m.words < 10) return { offline: true, overall: m.words ? 3 : null, dims: { content: 3, vocabulary: 3, readability: 3, task: 3 }, notes: ['Response too short to evaluate.'], metrics: m };
  const content = 5 + (m.paras >= 3) + (m.connectors >= 3) + (m.connectors >= 6) + (m.avgSent >= 11 && m.avgSent <= 26) + (m.words >= 150);
  const vocab = 3 + (m.mattr - 0.55) / 0.05 + (m.longRatio > 0.2 ? 1 : 0);
  const readability = 10 - Math.ceil(m.issues.length / 1.5) - (m.paras < 2 ? 2 : 0);
  let cov = 1, extras = 0; const notes = [];
  if (n === 1) {
    const covs = task.bullets.map(b => coverage(b, text)); cov = avg(covs.map(c => c >= 0.3 ? 1 : c / 0.3));
    covs.forEach((c, i) => { if (c < 0.3) notes.push(`Bullet ${i + 1} may not be covered clearly: “${task.bullets[i]}”`); });
    if (/^(dear|hi|hello|good (morning|afternoon))/i.test(text.trim())) extras++; else notes.push('Add a greeting suited to the reader (e.g., “Dear Ms. Patel,”).');
    if (/(regards|sincerely|best|thank you|thanks|cheers|take care)[,!.]?\s*\n?\s*\w*\s*$/i.test(text.trim().split('\n').slice(-3).join('\n'))) extras++; else notes.push('End with a closing and your name.');
  } else {
    if (/option a|option b|first option|second option|i (would )?(prefer|choose|support|favour|favor)/i.test(text) || rec.choice) extras += 2; else notes.push('State your choice clearly in the first sentence.');
    cov = Math.max(coverage(task.a, text), coverage(task.b, text)) >= 0.2 ? 1 : 0.6;
  }
  const inRange = m.words >= 150 && m.words <= 200;
  if (m.words < 150) notes.push(`Only ${m.words} words – the task asks for 150–200.`);
  if (m.words > 220) notes.push(`${m.words} words – well over 200; extra length is not rewarded and adds error risk.`);
  const taskL = 4 + cov * 3 + (inRange ? 1 : m.words >= 130 ? 0.5 : -1) + extras * 0.5;
  const lim = m.words >= 150 ? 10 : 4 + m.words / 50;
  const dims = { content: cap(Math.min(content, lim)), vocabulary: cap(Math.min(vocab, lim + 1)), readability: cap(Math.min(readability, lim + 1)), task: cap(Math.min(taskL, lim)) };
  return { offline: true, dims, overall: Math.round(avg(Object.values(dims))), notes: notes.concat(m.issues.slice(0, 6)), metrics: m };
}

/* Offline Speaking estimate */
export function offlineSpeaking(task, n, rec) {
  const tx = (rec && rec.transcript) || ''; const mt = (rec && rec.metrics) || {}; const m = metrics(tx);
  const speakSecs = (S_TASKS[n] || { speak: 60 }).speak;
  if (m.words < 8) return { offline: true, overall: null, dims: null, notes: [tx ? 'Transcript too short to evaluate.' : 'No transcript was captured. Type what you said to get an estimate.'], metrics: m };
  const wpm = mt.durationSec ? m.words / (mt.durationSec / 60) : m.words / (speakSecs / 60);
  const fpm = (mt.fillers || 0) / ((mt.durationSec || speakSecs) / 60);
  const expected = speakSecs * 2;
  const content = 4 + Math.min(3, m.words / expected * 3) + (m.connectors >= 2) + (m.connectors >= 4);
  const vocab = 3 + (m.mattr - 0.52) / 0.05 + (m.longRatio > 0.18 ? 1 : 0);
  let listen = wpm >= 110 && wpm <= 165 ? 9 : wpm >= 90 && wpm <= 185 ? 8 : wpm >= 70 ? 6 : 4;
  if (fpm > 6) listen -= 2; else if (fpm > 3) listen -= 1;
  if (mt.longPauses > 3) listen -= 1;
  const ref = n === 5 ? (task.options || []).map(o => o.title).join(' ') : n === 6 ? task.situation : (task.prompt || '') + ' ' + ((task.scene && task.scene.alt) || '');
  const taskL = 5 + Math.min(2, coverage(ref, tx) * 4) + (m.words >= expected * 0.6) + (mt.endedEarlySec != null && mt.endedEarlySec <= 8);
  const notes = [];
  if (m.words < expected * 0.6) notes.push(`About ${Math.round(wpm)} words per minute, ${m.words} words in total – use the full ${speakSecs} seconds.`);
  if (mt.endedEarlySec > 10) notes.push(`You stopped about ${mt.endedEarlySec} s early. Add an example or a wrap-up sentence.`);
  if (fpm > 3) notes.push(`${mt.fillers} filler words (${(mt.fillerList || []).slice(0, 6).join(', ')}). Replace them with a short silent pause.`);
  if (mt.longPauses > 3) notes.push(`${mt.longPauses} long pauses (2 s+). Plan 2–3 key points during preparation.`);
  if (m.connectors < 2) notes.push('Use more linking phrases (first of all, on top of that, the main reason is, as a result).');
  const lim = m.words >= expected * 0.6 ? 10 : 4 + 5 * m.words / (expected * 0.6);
  const dims = { content: cap(Math.min(content, lim)), vocabulary: cap(Math.min(vocab, lim + 1)), listenability: cap(listen), task: cap(Math.min(taskL, lim)) };
  return { offline: true, dims, overall: Math.round(avg(Object.values(dims))), notes, metrics: m, wpm: Math.round(wpm) };
}
