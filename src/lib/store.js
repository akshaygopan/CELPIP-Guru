// Local persistence: localStorage for data, IndexedDB for speaking recordings. Nothing leaves the browser.
import { todayKey } from './util.js';

const PREFIX = 'celpipguru.';
const mem = {};
const raw = k => { try { return localStorage.getItem(PREFIX + k); } catch (e) { return mem[k] ?? null; } };
const put = (k, v) => { try { localStorage.setItem(PREFIX + k, v); return true; } catch (e) { mem[k] = v; return false; } };
const listeners = new Set();
export const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { } });

export const get = (k, def) => { const v = raw(k); if (v == null) return def; try { return JSON.parse(v); } catch (e) { return def; } };
export const set = (k, v) => {
  if (!put(k, JSON.stringify(v)) && k === 'history') { // over quota: drop detail from older attempts
    const h = v.map((a, i) => i < v.length - 15 ? Object.assign({}, a, { session: null, evals: {} }) : a);
    put(k, JSON.stringify(h));
  }
  emit();
};

export const DEFAULT_SETTINGS = {
  provider: 'auto', geminiKey: '', geminiModel: 'gemini-flash-latest', groqKey: '', groqModel: 'openai/gpt-oss-120b',
  voiceRate: 1.0, targetLevel: 10, name: ''
};
export const settings = () => Object.assign({}, DEFAULT_SETTINGS, get('settings', {}));
export const saveSettings = s => set('settings', s);

export const history = () => get('history', []);
export const getAttempt = id => history().find(a => a.id === id);
export const saveAttempt = att => { const h = history(); const i = h.findIndex(a => a.id === att.id); if (i >= 0) h[i] = att; else h.push(att); set('history', h); markActive(); };
export const deleteAttempt = id => set('history', history().filter(a => a.id !== id));

export const markActive = () => { const d = get('activeDays', []); const t = todayKey(); if (!d.includes(t)) { d.push(t); set('activeDays', d); } };
export function streak() {
  const days = new Set(get('activeDays', []));
  let cur = 0; const d = new Date();
  if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(todayKey(d))) { cur++; d.setDate(d.getDate() - 1); }
  let best = 0, run = 0, prev = null;
  [...days].sort().forEach(k => { const dt = new Date(k + 'T12:00:00'); run = prev && (dt - prev) / 864e5 < 1.5 ? run + 1 : 1; best = Math.max(best, run); prev = dt; });
  // last 28 days heat-map
  const cal = []; const c = new Date(); c.setDate(c.getDate() - 27);
  for (let i = 0; i < 28; i++) { cal.push({ key: todayKey(c), on: days.has(todayKey(c)) }); c.setDate(c.getDate() + 1); }
  return { current: cur, best, total: days.size, doneToday: days.has(todayKey()), cal };
}

export const markSeen = key => { const s = get('seen', {}); s[key] = (s[key] || 0) + 1; set('seen', s); };
export const seenCount = key => (get('seen', {})[key] || 0);

export const customTests = () => get('customTests', []);
export const saveCustomTest = t => { const c = customTests().filter(x => x.id !== t.id); c.push(t); set('customTests', c); };
export const deleteCustomTest = id => set('customTests', customTests().filter(x => x.id !== id));

export function exportAll() {
  const out = {}; ['settings', 'history', 'activeDays', 'seen', 'customTests'].forEach(k => out[k] = get(k, null));
  if (out.settings) out.settings = Object.assign({}, out.settings, { geminiKey: '', groqKey: '' });
  return JSON.stringify({ app: 'celpip-guru', version: 1, exported: new Date().toISOString(), data: out });
}
export function importAll(json) {
  const o = JSON.parse(json); if (!o || !o.data) throw new Error('This is not a CELPIP Guru backup file.');
  const keep = settings();
  Object.entries(o.data).forEach(([k, v]) => { if (v != null) set(k, v); });
  saveSettings(Object.assign(settings(), { geminiKey: keep.geminiKey, groqKey: keep.groqKey }));
}
export function clearHistory() { ['history', 'activeDays'].forEach(k => set(k, [])); set('seen', {}); }

/* ---------- IndexedDB for recordings ---------- */
let dbp = null; const audioMem = {};
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => { try { const r = indexedDB.open('celpipguru-audio', 1); r.onupgradeneeded = () => r.result.createObjectStore('rec'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
  return dbp;
}
export async function saveAudio(key, blob) {
  try { const d = await db(); await new Promise((res, rej) => { const tx = d.transaction('rec', 'readwrite'); tx.objectStore('rec').put(blob, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); return true; }
  catch (e) { audioMem[key] = blob; return false; }
}
export async function getAudio(key) {
  if (audioMem[key]) return audioMem[key];
  try { const d = await db(); return await new Promise(res => { const g = d.transaction('rec', 'readonly').objectStore('rec').get(key); g.onsuccess = () => res(g.result || null); g.onerror = () => res(null); }); }
  catch (e) { return null; }
}
