// Shared by the browser app and scripts/build-bank.mjs (plain ESM, no dependencies).
// Defines the official test structure and a single canonical order for every scored question,
// so the answer key can be stored separately from the content.

export const L_PARTS = {
  1: { name: 'Listening to Problem Solving', short: 'Problem Solving', desc: 'You will hear a conversation in three sections. You will hear each section only once. After each section, you will answer questions about it.' },
  2: { name: 'Listening to a Daily Life Conversation', short: 'Daily Life Conversation', desc: 'You will hear a conversation about an everyday situation. You will hear it only once. Then you will answer five questions.' },
  3: { name: 'Listening for Information', short: 'Listening for Information', desc: 'You will hear a conversation in which information is exchanged. You will hear it only once. Then you will answer six questions.' },
  4: { name: 'Listening to a News Item', short: 'News Item', desc: 'You will hear a news item. You will hear it only once. Then you will answer five questions.' },
  5: { name: 'Listening to a Discussion', short: 'Discussion', desc: 'You will hear a discussion among several people. A still image of the speakers is shown. You will hear it only once. Then you will answer eight questions.' },
  6: { name: 'Listening to Viewpoints', short: 'Viewpoints', desc: 'You will hear a report presenting different viewpoints on a topic. You will hear it only once. Then you will answer six questions.' }
};
export const R_PARTS = {
  1: { name: 'Reading Correspondence', short: 'Correspondence', mins: 11 },
  2: { name: 'Reading to Apply a Diagram', short: 'Apply a Diagram', mins: 9 },
  3: { name: 'Reading for Information', short: 'Reading for Information', mins: 10 },
  4: { name: 'Reading for Viewpoints', short: 'Viewpoints', mins: 13 }
};
export const W_TASKS = { 1: { name: 'Writing an Email', mins: 27 }, 2: { name: 'Responding to Survey Questions', mins: 26 } };
export const S_TASKS = {
  1: { name: 'Giving Advice', prep: 30, speak: 90 },
  2: { name: 'Talking about a Personal Experience', prep: 30, speak: 60 },
  3: { name: 'Describing a Scene', prep: 30, speak: 60 },
  4: { name: 'Making Predictions', prep: 30, speak: 60 },
  5: { name: 'Comparing and Persuading', prep: 60, speak: 60, choose: 60 },
  6: { name: 'Dealing with a Difficult Situation', prep: 60, speak: 60 },
  7: { name: 'Expressing Opinions', prep: 30, speak: 90 },
  8: { name: 'Describing an Unusual Situation', prep: 30, speak: 60 }
};
export const PART_LIST = { L: [1, 2, 3, 4, 5, 6], R: [1, 2, 3, 4], W: [1, 2], S: [1, 2, 3, 4, 5, 6, 7, 8] };
export const SKILL = { L: 'Listening', R: 'Reading', W: 'Writing', S: 'Speaking' };
export const partName = (c, n) => c === 'L' ? L_PARTS[n].name : c === 'R' ? R_PARTS[n].name : c === 'W' ? W_TASKS[n].name : S_TASKS[n].name;
export const partWord = c => (c === 'W' || c === 'S') ? 'Task' : 'Part';

/* Canonical walk over every scored question of one part. cb(q, localIndex) */
export function partQuestions(test, comp, n) {
  const out = [];
  if (comp === 'L') {
    const p = (test.L && test.L.parts || []).find(x => x.n === n); if (!p) return out;
    p.sections.forEach((s, si) => s.qs.forEach(q => out.push({ q, section: si, kind: 'mcq', src: s.lines.map(l => l[1]).join(' ') })));
  } else if (comp === 'R') {
    const p = test.R && test.R['p' + n]; if (!p) return out;
    if (n === 1) { p.qs.forEach(q => out.push({ q, kind: 'mcq' })); p.reply.blanks.forEach((q, i) => out.push({ q, kind: 'blank', label: `Response blank ${i + 1}` })); }
    if (n === 2) { p.email.blanks.forEach((q, i) => out.push({ q, kind: 'blank', label: `Email blank ${i + 1}` })); p.qs.forEach(q => out.push({ q, kind: 'mcq' })); }
    if (n === 3) p.qs.forEach(q => out.push({ q, kind: 'match' }));
    if (n === 4) { p.qs.forEach(q => out.push({ q, kind: 'mcq' })); p.comment.blanks.forEach((q, i) => out.push({ q, kind: 'blank', label: `Comment blank ${i + 1}` })); }
  }
  return out;
}

/* Every scored question in the fixed global order: L1..L6 then R1..R4 */
export function allQuestions(test) {
  const out = [];
  PART_LIST.L.forEach(n => partQuestions(test, 'L', n).forEach((x, i) => out.push(Object.assign({ comp: 'L', n, i }, x))));
  PART_LIST.R.forEach(n => partQuestions(test, 'R', n).forEach((x, i) => out.push(Object.assign({ comp: 'R', n, i }, x))));
  return out;
}

export const qid = (testId, comp, n, i) => `${testId}.${comp}${n}.${i}`;

/* Deterministic option shuffle so correct answers are spread evenly; stable across sessions */
function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
export function shuffleOptions(test) {
  allQuestions(test).forEach(({ q, comp, n, i, kind }) => {
    if (kind === 'match' || !Array.isArray(q.o) || q.o.length !== 4 || typeof q.a !== 'number') return;
    const rnd = seeded(`${test.id}|${comp}${n}|${i}`); const idx = [0, 1, 2, 3];
    for (let k = 3; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
    q.o = idx.map(k => q.o[k]); q.a = idx.indexOf(q.a);
  });
  return test;
}

/* Split a full test into public content and a private key (answers, evidence, explanations, model answers). */
export function splitTest(full) {
  const content = JSON.parse(JSON.stringify(full));
  const key = { q: [], models: {} };
  allQuestions(content).forEach(({ q, kind }) => {
    key.q.push({ a: kind === 'match' ? 'ABCDE'.indexOf(q.a) : q.a, ev: q.ev || '', x: q.x || '' });
    delete q.a; delete q.ev; delete q.x;
  });
  if (content.W) [1, 2].forEach(n => { const t = content.W['t' + n]; if (t && t.model) { key.models['W' + n] = t.model; delete t.model; } });
  if (content.S) for (let n = 1; n <= 8; n++) { const t = content.S['t' + n]; if (t && t.model) { key.models['S' + n] = t.model; delete t.model; } }
  return { content, key };
}

/* Light obfuscation so answers are not readable in the page source before a test is submitted.
   (This is a client-side app: it deters peeking, it is not security.) */
const xorBytes = (bytes, id) => { const k = new TextEncoder().encode(`cg:${id}:key`); return bytes.map((b, i) => b ^ k[i % k.length] ^ ((i * 7) & 255)); };
export function encodeKey(key, id) {
  const bytes = xorBytes(new TextEncoder().encode(JSON.stringify(key)), id);
  let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}
export function decodeKey(str, id) {
  const bin = typeof atob === 'function' ? atob(str) : Buffer.from(str, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(xorBytes(bytes, id)));
}

/* Card summary for the library */
export function summarize(full) {
  const R = full.R || {};
  return {
    id: full.id, title: full.title,
    topics: [R.p3 && R.p3.title, R.p4 && R.p4.title].filter(Boolean),
    listening: (full.L && full.L.parts || []).map(p => p.context).filter(Boolean).slice(0, 2)
  };
}
