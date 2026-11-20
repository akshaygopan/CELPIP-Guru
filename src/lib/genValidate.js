// Checks AI-generated parts before they are saved (same rules as scripts/validate-bank.mjs, per part).
const norm = s => String(s || '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').toLowerCase().trim();

export function validateTestPart(comp, n, p) {
  const errs = [];
  const chk = (q, src, lab) => {
    if (!q || !Array.isArray(q.o) || q.o.length !== 4) errs.push(lab + ': needs 4 options');
    if (typeof q.a !== 'number' || q.a < 0 || q.a > 3) errs.push(lab + ': bad answer index');
    if (q && q.ev && !norm(src).includes(norm(q.ev))) q.ev = ''; // unverifiable evidence is dropped rather than shown wrongly
  };
  try {
    if (comp === 'L') {
      const need = { 1: [3, 3, 2], 2: [5], 3: [6], 4: [5], 5: [8], 6: [6] }[n];
      if (!p.sp || !Object.keys(p.sp).length) errs.push('missing speakers');
      if (!Array.isArray(p.sections) || p.sections.length !== need.length) errs.push('wrong number of sections');
      else p.sections.forEach((s, i) => { if (!s.qs || s.qs.length !== need[i]) errs.push(`section ${i + 1} needs ${need[i]} questions`); const src = (s.lines || []).map(l => l[1]).join(' '); (s.qs || []).forEach((q, k) => chk(q, src, 'Q' + (k + 1))); });
    } else if (comp === 'R') {
      if (n === 1) { if ((p.qs || []).length !== 6) errs.push('needs 6 questions'); if (!p.reply || (p.reply.blanks || []).length !== 5) errs.push('reply needs 5 blanks'); (p.qs || []).forEach((q, i) => chk(q, p.text, 'Q' + (i + 1))); ((p.reply && p.reply.blanks) || []).forEach((b, i) => chk(b, p.text + ' ' + p.reply.text, 'Blank ' + (i + 1))); }
      if (n === 2) { if (!p.diagram) errs.push('missing diagram'); if (!p.email || (p.email.blanks || []).length !== 5) errs.push('email needs 5 blanks'); if ((p.qs || []).length !== 3) errs.push('needs 3 questions'); const src = JSON.stringify(p.diagram || {}) + ((p.email && p.email.text) || ''); ((p.email && p.email.blanks) || []).forEach((b, i) => chk(b, src, 'Blank ' + (i + 1))); (p.qs || []).forEach((q, i) => chk(q, src, 'Q' + (i + 1))); }
      if (n === 3) { if ((p.paras || []).length !== 4) errs.push('needs 4 paragraphs'); if ((p.qs || []).length !== 9) errs.push('needs 9 statements'); (p.qs || []).forEach((q, i) => { if (!/^[A-E]$/.test(q.a)) errs.push(`statement ${i + 1}: answer must be A–E`); }); }
      if (n === 4) { if ((p.qs || []).length !== 5) errs.push('needs 5 questions'); if (!p.comment || (p.comment.blanks || []).length !== 5) errs.push('comment needs 5 blanks'); (p.qs || []).forEach((q, i) => chk(q, p.text, 'Q' + (i + 1))); ((p.comment && p.comment.blanks) || []).forEach((b, i) => chk(b, p.text + ' ' + p.comment.text, 'Blank ' + (i + 1))); }
    } else if (comp === 'W') { if (!p.t1 || !Array.isArray(p.t1.bullets) || p.t1.bullets.length !== 3) errs.push('Task 1 needs 3 bullets'); if (!p.t2 || !p.t2.a || !p.t2.b) errs.push('Task 2 needs options a and b'); }
    else if (comp === 'S') { for (let i = 1; i <= 8; i++) if (!p['t' + i]) errs.push('missing task ' + i); if (p.t5 && (!p.t5.options || p.t5.options.length !== 2 || !p.t5.other)) errs.push('task 5 needs 2 options + other'); if (p.t6 && (!p.t6.options || p.t6.options.length !== 2)) errs.push('task 6 needs 2 options'); if (p.t3 && !(p.t3.scene && p.t3.scene.items)) errs.push('task 3 needs a scene'); if (p.t8 && !(p.t8.scene && p.t8.scene.items)) errs.push('task 8 needs a scene'); }
  } catch (e) { errs.push(e.message); }
  return errs;
}

export const HINTS = (c, n) => {
  if (c === 'L') return ({ 1: 'Exactly 3 sections with 3, 3 and 2 questions; 220–300 words of dialogue per section; 2 speakers; a problem, options rejected, then a decision.', 2: '1 section, 5 questions, 330–420 words, 2 speakers.', 3: '1 section, 6 questions, 400–520 words, 2 speakers exchanging detailed information.', 4: '1 section, 5 questions, a 320–420 word news report (anchor + optional interviewee).', 5: '1 section, 8 questions, 520–700 word discussion among 3 speakers.', 6: '1 section, 6 questions, 450–600 word report with at least two nuanced viewpoints.' })[n] + ' Speaker ids are capital letters; sp has name, g ("m"/"f"), acc (en-CA, en-US, en-GB, en-AU or en-IN), rate 0.92–1.08. Question types t: detail, inference, attitude, main, purpose, prediction, paraphrase.';
  if (c === 'R') return ({ 1: 'A 300–420 word letter with 6 questions plus a 130–180 word reply containing {1}…{5}, each blank with 4 options.', 2: 'A rich diagram (table and/or cards plus notes with conditions) and a 140–190 word email with {1}…{5} blanks that require applying the diagram (calculations, conditions), plus 3 questions.', 3: 'Four paragraphs of 120–160 words; 9 statements answered A–D or E (not given); 2–3 E answers with "ev": "".', 4: 'A 520–650 word opinion article with 5 questions, plus a 140–190 word reader comment with {1}…{5} blanks.' })[n] + ' Types: detail, inference, attitude, main, purpose, vocab, notgiven, paraphrase, viewpoint, diagram, coherence.';
  if (c === 'W') return 'Return {"t1":{situation,bullets:[3],model},"t2":{intro,question,a,b,model}}; models are Level 12 answers of 175–200 words.';
  return 'Return t1…t8 exactly like the example. Scenes ("scene": {bg, alt, items}) may only use the primitives and backgrounds that appear in the example, plus ["big", primitive, x, y, scale, …] and ["flip", primitive, x, y, …]. Give a detailed alt description. Models: Level 12, about 2.2 words per second of speaking time.';
};
