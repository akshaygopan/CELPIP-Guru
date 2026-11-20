// Question-bank access. Built-in tests are lazy-loaded chunks; the answer key is decoded only for grading.
import { TESTS, PRACTICE, loaders } from '../generated/bank-index.js';
import { decodeKey, splitTest, shuffleOptions, summarize, partQuestions, allQuestions, PART_LIST } from './bankShape.js';
import * as store from './store.js';

export const practice = PRACTICE;
export const builtIn = () => TESTS;
export const all = () => TESTS.concat(store.customTests().map(t => Object.assign(summarize(t), { custom: true })));

const cache = {};
async function loadRaw(id) {
  if (cache[id]) return cache[id];
  const custom = store.customTests().find(t => t.id === id);
  if (custom) { const { content, key } = splitTest(shuffleOptions(JSON.parse(JSON.stringify(custom)))); return (cache[id] = { content, keyObj: key }); }
  if (!loaders[id]) throw new Error('Unknown test ' + id);
  const mod = (await loaders[id]()).default;
  return (cache[id] = { content: mod.content, keyEnc: mod.key });
}
/* Content only – used while a test is running (no answers in memory). */
export async function loadContent(id) { return (await loadRaw(id)).content; }
/* Content + decoded key – used only after the test is submitted. */
export async function loadWithKey(id) {
  const r = await loadRaw(id);
  return { content: r.content, key: r.keyObj || decodeKey(r.keyEnc, id) };
}

export function hasPart(content, comp, n) {
  if (!content) return false;
  if (comp === 'L') return !!(content.L && content.L.parts && content.L.parts.find(p => p.n === n));
  if (comp === 'R') return !!(content.R && content.R['p' + n]);
  if (comp === 'W') return !!(content.W && content.W['t' + n]);
  if (comp === 'S') return !!(content.S && content.S['t' + n]);
  return false;
}
export const isBuiltIn = id => !!loaders[id];
export function customHas(id, comp, n) { const t = store.customTests().find(x => x.id === id); return hasPart(t, comp, n); }
export function customComplete(t) { return Object.entries(PART_LIST).every(([c, ns]) => ns.every(n => hasPart(t, c, n))); }
export const testHas = (id, comp, n) => isBuiltIn(id) ? true : customHas(id, comp, n);

/* Rebuild a full test (content + answers) – used as a structural example for AI generation. */
export async function fullExample(id) {
  const { content, key } = await loadWithKey(id);
  const full = JSON.parse(JSON.stringify(content));
  allQuestions(full).forEach(({ q, kind }, i) => { const k = key.q[i]; q.a = kind === 'match' ? 'ABCDE'[k.a] : k.a; q.ev = k.ev; q.x = k.x; });
  [1, 2].forEach(n => { if (full.W['t' + n]) full.W['t' + n].model = key.models['W' + n]; });
  for (let n = 1; n <= 8; n++) if (full.S['t' + n]) full.S['t' + n].model = key.models['S' + n];
  return full;
}
export { partQuestions };
