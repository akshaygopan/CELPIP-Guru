#!/usr/bin/env node
// Validates question-bank JSON files: structure, official part/question counts, minimum lengths,
// evidence quotes (must appear verbatim in the source), answer spread and "longest option" bias.
// Usage: node scripts/validate-bank.mjs [file-or-dir ...]   (default: data/tests)
import fs from 'node:fs';
import path from 'node:path';

const SCENE_PRIMITIVES = new Set(('person tree pine bush flowers sun cloud raincloud pond duck mountain puddle snowman dog cat bird bench table picnic basket chair sofa tv lamp streetlamp shelf desk laptop monitor mug plant window door clock box ladder sign banner fence ball kite balloons cake grill tent campfire stall cart stroller bike car bus truck house building shop cone hydrant whiteboard counter register boat canoe umbrellaBeach sandcastle towel swing slide easel bin text speech water rect big flip ' +
  'teapotHouse shoeCar bookChair upsideDownHouse pianoStairs giantChair robotWalker busGarden bedBoat longBike').split(/\s+/).filter(Boolean));
const BGS = new Set(['park', 'street', 'indoor', 'office', 'kitchen', 'classroom', 'beach', 'lake', 'winter', 'market', 'plain']);
const TYPES = new Set(['detail', 'inference', 'attitude', 'main', 'purpose', 'prediction', 'paraphrase', 'vocab', 'notgiven', 'viewpoint', 'diagram', 'coherence']);

const norm = s => String(s).replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').toLowerCase().trim();
const words = s => (String(s || '').match(/[A-Za-z0-9'’-]+/g) || []).length;

export function validateTest(t, { strict = true } = {}) {
  const errors = [], warnings = [];
  const E = m => errors.push(m), W = m => (strict ? errors : warnings).push(m);
  const ans = [0, 0, 0, 0]; let longest = 0, mcqCount = 0;
  if (!/^t\d{2,3}$/.test(t.id || '')) E('id must look like t11');
  if (!t.title) E('missing title');

  const chkQ = (q, src, lab) => {
    if (!q || typeof q !== 'object') return E(lab + ': missing');
    if (!Array.isArray(q.o) || q.o.length !== 4) E(lab + ': needs exactly 4 options');
    else {
      if (new Set(q.o.map(norm)).size !== 4) E(lab + ': duplicate options');
      const lens = q.o.map(o => o.length); mcqCount++;
      if (q.a >= 0 && q.a <= 3 && lens[q.a] === Math.max(...lens) && lens.filter(l => l === lens[q.a]).length === 1) longest++;
    }
    if (!(Number.isInteger(q.a) && q.a >= 0 && q.a <= 3)) E(lab + ': "a" must be 0–3'); else ans[q.a]++;
    if (!TYPES.has(q.t)) E(lab + `: bad type "${q.t}"`);
    if (!q.x) E(lab + ': explanation "x" missing'); else if (words(q.x) < 12) W(lab + ': explanation "x" too short (12+ words: why correct AND why the tempting distractor is wrong)');
    if (!q.ev) E(lab + ': evidence "ev" missing');
    else if (!norm(src).includes(norm(q.ev))) E(lab + ': evidence not found verbatim: "' + String(q.ev).slice(0, 70) + '"');
  };

  // ---------- Listening ----------
  const need = { 1: [3, 3, 2], 2: [5], 3: [6], 4: [5], 5: [8], 6: [6] };
  const minWords = { 1: 600, 2: 300, 3: 380, 4: 280, 5: 480, 6: 420 };
  let nL = 0;
  for (let n = 1; n <= 6; n++) {
    const p = (t.L && t.L.parts || []).find(x => x.n === n);
    if (!p) { E('missing Listening part ' + n); continue; }
    if (!p.sp || !Object.keys(p.sp).length) E(`L${n}: missing speakers "sp"`);
    else Object.entries(p.sp).forEach(([id, s]) => { if (!s.name || !['m', 'f'].includes(s.g) || !s.acc) E(`L${n}: speaker ${id} needs name, g (m/f), acc`); });
    if (!p.context) E(`L${n}: missing context sentence`);
    if (!Array.isArray(p.sections) || p.sections.length !== need[n].length) { E(`L${n}: needs ${need[n].length} section(s)`); continue; }
    let w = 0;
    p.sections.forEach((s, si) => {
      if (!Array.isArray(s.qs) || s.qs.length !== need[n][si]) E(`L${n} section ${si + 1}: needs ${need[n][si]} questions`);
      (s.lines || []).forEach((l, li) => { if (!Array.isArray(l) || l.length !== 2 || !p.sp[l[0]]) E(`L${n} s${si + 1} line ${li + 1}: bad line or unknown speaker`); });
      const src = (s.lines || []).map(l => l[1]).join(' '); w += words(src);
      (s.qs || []).forEach((q, i) => { chkQ(q, src, `L${n}s${si + 1}q${i + 1}`); nL++; });
    });
    if (n === 5 && Object.keys(p.sp || {}).length < 3) E('L5: needs 3 speakers');
    if (w < minWords[n]) W(`L${n}: transcript only ${w} words (minimum ${minWords[n]})`);
  }
  // ---------- Reading ----------
  const R = t.R || {}; let nR = 0;
  if (R.p1) {
    const s = R.p1.text || '';
    if (words(s) < 280) W(`R1: letter only ${words(s)} words (min 280)`);
    if (words(R.p1.reply && R.p1.reply.text) < 110) W('R1: reply too short (min 110 words)');
    if ((R.p1.qs || []).length !== 6) E('R1: needs 6 questions');
    (R.p1.qs || []).forEach((q, i) => { chkQ(q, s, 'R1q' + (i + 1)); nR++; });
    const rb = (R.p1.reply && R.p1.reply.blanks) || [];
    if (rb.length !== 5) E('R1: reply needs 5 blanks');
    rb.forEach((b, i) => { chkQ(b, s + ' ' + R.p1.reply.text, 'R1 blank' + (i + 1)); nR++; if (!R.p1.reply.text.includes(`{${i + 1}}`)) E(`R1: reply text missing {${i + 1}}`); });
  } else E('missing R.p1');
  if (R.p2) {
    const d = R.p2.diagram || {};
    const s = [d.title, d.intro, ...(d.table ? [d.table.cols.join(' '), ...d.table.rows.map(r => r.join(' '))] : []), ...(d.cards || []).map(c => c.h + ' ' + c.lines.join(' ')), ...(d.notes || [])].join(' ');
    if (!d.title) E('R2: diagram needs a title');
    if (d.table && d.table.rows.some(r => r.length !== d.table.cols.length)) E('R2: every table row must have one cell per column');
    if (words(s) < 90) W('R2: diagram has too little information (min 90 words)');
    const eb = (R.p2.email && R.p2.email.blanks) || [];
    if (eb.length !== 5) E('R2: email needs 5 blanks');
    eb.forEach((b, i) => { chkQ(b, s + ' ' + R.p2.email.text, 'R2 blank' + (i + 1)); nR++; if (!R.p2.email.text.includes(`{${i + 1}}`)) E(`R2: email text missing {${i + 1}}`); });
    if ((R.p2.qs || []).length !== 3) E('R2: needs 3 questions');
    (R.p2.qs || []).forEach((q, i) => { chkQ(q, s + ' ' + R.p2.email.text, 'R2q' + (i + 1)); nR++; });
  } else E('missing R.p2');
  if (R.p3) {
    if ((R.p3.paras || []).length !== 4) E('R3: needs 4 paragraphs');
    (R.p3.paras || []).forEach((p, i) => { if (words(p) < 85) W(`R3: paragraph ${'ABCD'[i]} only ${words(p)} words (min 85)`); });
    if ((R.p3.qs || []).length !== 9) E('R3: needs 9 statements');
    const dist = {};
    (R.p3.qs || []).forEach((q, i) => {
      nR++; dist[q.a] = (dist[q.a] || 0) + 1;
      if (!/^[A-E]$/.test(q.a)) E(`R3 statement ${i + 1}: "a" must be "A"–"E"`);
      else if (q.a !== 'E') { const pi = 'ABCD'.indexOf(q.a); if (!q.ev || !norm(R.p3.paras[pi] || '').includes(norm(q.ev))) E(`R3 statement ${i + 1}: evidence not found in paragraph ${q.a}`); }
      if (!TYPES.has(q.t)) E(`R3 statement ${i + 1}: bad type`);
      if (!q.x) E(`R3 statement ${i + 1}: explanation missing`); else if (words(q.x) < 10) W(`R3 statement ${i + 1}: explanation too short (10+ words)`);
    });
    if ((dist.E || 0) < 2 || (dist.E || 0) > 3) E('R3: needs 2–3 “E” (not given) answers');
    ['A', 'B', 'C', 'D'].forEach(L => { if (!dist[L]) E('R3: every paragraph A–D must be the answer at least once'); });
  } else E('missing R.p3');
  if (R.p4) {
    const s = R.p4.text || '';
    if (words(s) < 430) W(`R4: article only ${words(s)} words (min 430)`);
    if ((R.p4.qs || []).length !== 5) E('R4: needs 5 questions');
    (R.p4.qs || []).forEach((q, i) => { chkQ(q, s, 'R4q' + (i + 1)); nR++; });
    const cb = (R.p4.comment && R.p4.comment.blanks) || [];
    if (cb.length !== 5) E('R4: comment needs 5 blanks');
    cb.forEach((b, i) => { chkQ(b, s + ' ' + R.p4.comment.text, 'R4 blank' + (i + 1)); nR++; if (!R.p4.comment.text.includes(`{${i + 1}}`)) E(`R4: comment missing {${i + 1}}`); });
    if (words(R.p4.comment && R.p4.comment.text) < 110) W('R4: comment too short (min 110 words)');
  } else E('missing R.p4');
  if (nL !== 38) E(`Listening has ${nL} questions (must be 38)`);
  if (nR !== 38) E(`Reading has ${nR} questions (must be 38)`);
  if (mcqCount && longest / mcqCount > 0.45) W(`correct answer is the single longest option in ${longest}/${mcqCount} questions – balance option lengths (max 45%)`);
  // ---------- Writing ----------
  const Wt = t.W || {};
  if (!Wt.t1 || !Wt.t1.situation || !Array.isArray(Wt.t1.bullets) || Wt.t1.bullets.length !== 3 || !Wt.t1.model) E('W.t1 needs situation, 3 bullets, model');
  if (!Wt.t2 || !Wt.t2.intro || !Wt.t2.question || !Wt.t2.a || !Wt.t2.b || !Wt.t2.model) E('W.t2 needs intro, question, a, b, model');
  [['t1', Wt.t1], ['t2', Wt.t2]].forEach(([k, x]) => { if (x && x.model) { const n = words(x.model); if (n < 160 || n > 200) E(`W.${k} model answer is ${n} words (must be 160–200)`); } });
  // ---------- Speaking ----------
  const S = t.S || {};
  for (let i = 1; i <= 8; i++) { const s = S['t' + i]; if (!s || !s.model) { E(`S.t${i} missing or no model`); continue; } if (![5, 6].includes(i) && !s.prompt) E(`S.t${i} needs prompt`); }
  const scene = (sc, lab) => {
    if (!sc || !BGS.has(sc.bg)) return E(lab + ': scene needs a valid bg');
    if (!sc.alt || words(sc.alt) < 40) E(lab + ': scene alt description must be detailed (40+ words)');
    if (!Array.isArray(sc.items) || sc.items.length < 6) W(lab + ': scene needs at least 6 items');
    (sc.items || []).forEach((it, k) => { if (!Array.isArray(it) || !SCENE_PRIMITIVES.has(it[0])) E(`${lab}: item ${k + 1} unknown primitive "${it && it[0]}"`); if (it && (it[0] === 'big' || it[0] === 'flip') && !SCENE_PRIMITIVES.has(it[1])) E(`${lab}: item ${k + 1} wraps unknown primitive "${it[1]}"`); });
  };
  if (S.t3) scene(S.t3.scene, 'S.t3');
  if (S.t8) scene(S.t8.scene, 'S.t8');
  if (S.t5 && (!S.t5.intro || !Array.isArray(S.t5.options) || S.t5.options.length !== 2 || !S.t5.other || !S.t5.persuade)) E('S.t5 needs intro, 2 options, other, persuade');
  if (S.t6 && (!S.t6.situation || !Array.isArray(S.t6.options) || S.t6.options.length !== 2)) E('S.t6 needs situation and 2 options');
  return { errors, warnings, stats: { nL, nR, ans, longest, mcqCount } };
}

// ---------- CLI ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const forceStrict = process.argv.includes('--strict');
  const args = process.argv.slice(2).filter(a => a !== '--strict');
  const targets = (args.length ? args : ['data/tests']).flatMap(a => fs.statSync(a).isDirectory() ? fs.readdirSync(a).filter(f => /^t\d+\.json$/.test(f)).sort().map(f => path.join(a, f)) : [a]);
  let bad = 0; const titles = new Map();
  for (const f of targets) {
    let t; try { t = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`✘ ${f}: invalid JSON – ${e.message}`); bad++; continue; }
    const legacy = !forceStrict && /^t(0\d|10)$/.test(t.id); // the original 10 tests predate the length rules
    const { errors, warnings, stats } = validateTest(t, { strict: !legacy });
    if (titles.has(t.id)) errors.push('duplicate id ' + t.id + ' also in ' + titles.get(t.id)); titles.set(t.id, f);
    if (errors.length) { bad++; console.log(`✘ ${f} (${errors.length} problem${errors.length > 1 ? 's' : ''})`); errors.forEach(e => console.log('   - ' + e)); }
    else console.log(`✔ ${f}  L${stats.nL}/R${stats.nR}  answers A-D ${stats.ans.join('/')}  longest-correct ${stats.longest}/${stats.mcqCount}${warnings.length ? '  (' + warnings.length + ' length warnings)' : ''}`);
  }
  console.log(bad ? `\n${bad} file(s) need fixing.` : `\nAll ${targets.length} file(s) valid.`);
  process.exit(bad ? 1 : 0);
}
