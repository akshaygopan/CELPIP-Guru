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
  voiceRate: 1.0, targetLevel: 10, name: '', rememberKeys: true
};
/* API keys are kept apart from other settings: in localStorage only when the user chooses "remember on this device",
   otherwise in sessionStorage (erased when the tab closes). They are never exported, synced or sent anywhere except
   directly to the provider the user picked. */
const KEY_FIELDS = ['geminiKey', 'groqKey'];
const ss = { get: () => { try { return JSON.parse(sessionStorage.getItem(PREFIX + 'keys') || 'null'); } catch (e) { return mem.sessionKeys || null; } },
  set: v => { try { v ? sessionStorage.setItem(PREFIX + 'keys', JSON.stringify(v)) : sessionStorage.removeItem(PREFIX + 'keys'); } catch (e) { mem.sessionKeys = v; } } };
function readKeys() { return ss.get() || get('keys', null) || {}; }
export const settings = () => {
  const st = Object.assign({}, DEFAULT_SETTINGS, get('settings', {}));
  if (st.geminiKey || st.groqKey) { // migrate keys saved by older versions out of the general settings object
    const legacy = { geminiKey: st.geminiKey || '', groqKey: st.groqKey || '' };
    const rest = Object.assign({}, st); KEY_FIELDS.forEach(k => delete rest[k]); set('settings', rest); set('keys', legacy);
  }
  return Object.assign(st, { geminiKey: '', groqKey: '' }, readKeys());
};
export const saveSettings = s => {
  const rest = Object.assign({}, s), keys = {}; KEY_FIELDS.forEach(k => { keys[k] = (s[k] || '').trim(); delete rest[k]; });
  set('settings', rest);
  const any = keys.geminiKey || keys.groqKey;
  if (s.rememberKeys) { set('keys', any ? keys : null); ss.set(null); } else { set('keys', null); ss.set(any ? keys : null); }
};
export const forgetKeys = () => { set('keys', null); ss.set(null); };

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
  if (out.settings) { out.settings = Object.assign({}, out.settings); KEY_FIELDS.forEach(k => delete out.settings[k]); }
  return JSON.stringify({ app: 'celpip-guru', version: 1, exported: new Date().toISOString(), data: out });
}
const SAFE_IMPORT = { history: Array.isArray, activeDays: Array.isArray, seen: v => v && typeof v === 'object' && !Array.isArray(v), customTests: Array.isArray, settings: v => v && typeof v === 'object' && !Array.isArray(v) };
export function importAll(json) {
  if (typeof json !== 'string' || json.length > 25e6) throw new Error('This backup file is too large.');
  const o = JSON.parse(json); if (!o || o.app !== 'celpip-guru' || !o.data || typeof o.data !== 'object') throw new Error('This is not a CELPIP Guru backup file.');
  const keep = settings();
  Object.entries(o.data).forEach(([k, v]) => {
    if (v == null || !Object.prototype.hasOwnProperty.call(SAFE_IMPORT, k) || !SAFE_IMPORT[k](v)) return; // unknown or malformed sections are ignored
    if (k === 'customTests') v = v.filter(t => t && typeof t === 'object' && typeof t.id === 'string' && /^c[\w-]{1,40}$/.test(t.id) && typeof t.title === 'string').map(t => Object.assign({}, t, { title: t.title.slice(0, 120), custom: true }));
    if (k === 'settings') { const clean = {}; ['provider', 'geminiModel', 'groqModel', 'voiceRate', 'targetLevel', 'name'].forEach(f => { if (v[f] != null && typeof v[f] !== 'object') clean[f] = v[f]; }); v = Object.assign({}, get('settings', {}), clean); }
    set(k, v);
  });
  saveSettings(Object.assign(settings(), { geminiKey: keep.geminiKey, groqKey: keep.groqKey, rememberKeys: keep.rememberKeys }));
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
