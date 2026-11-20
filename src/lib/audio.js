// Listening audio: the browser's free speechSynthesis. Each speaker gets a different voice/accent where
// available plus distinct rate and pitch. Plays ONCE – there are no pause or replay controls.
import { FAST, sleep, sentences, wordCount, clamp } from './util.js';
import * as store from './store.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
let token = 0;

const FEMALE = /female|woman|samantha|karen|moira|tessa|fiona|victoria|zira|aria|jenny|libby|sonia|natasha|clara|susan|hazel|heera|veena|catherine|serena|allison|ava|kate|emma|olivia|amy|joanna|ruth|linda|heather|google us english$|google uk english female/i;
const MALE = /\bmale\b|daniel|alex\b|fred|david|mark|guy|ryan|thomas|liam|william|george|rishi|oliver|arthur|james|tom\b|aaron|gordon|lee\b|matthew|brian|eric|christopher|google uk english male/i;
const genderOf = v => /female/i.test(v.name) ? 'f' : MALE.test(v.name) ? 'm' : FEMALE.test(v.name) ? 'f' : '?';

export const ready = new Promise(res => {
  if (!synth) return res([]);
  const load = () => { const v = synth.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang)); if (v.length) { voices = v; res(v); return true; } return false; };
  if (load()) return;
  synth.onvoiceschanged = load;
  setTimeout(() => { load(); res(voices); }, 2500);
});
export const available = () => !!synth && voices.length > 0;
export const voiceCount = () => voices.length;

export function assign(speakers) {
  const out = {}; const used = new Map();
  const userRate = store.settings().voiceRate || 1;
  Object.entries(speakers || {}).forEach(([id, sp]) => {
    const lang = (sp.acc || 'en-CA').toLowerCase().replace('_', '-');
    const score = v => {
      let s = 0; const vl = v.lang.toLowerCase().replace('_', '-');
      if (vl === lang) s += 6; else if (lang === 'en-ca' && vl === 'en-us') s += 4; else if (vl.startsWith('en')) s += 2;
      const g = genderOf(v); if (g === sp.g) s += 5; else if (g === '?') s += 1; else s -= 4;
      if (/google|natural|neural|online/i.test(v.name)) s += 1;
      return s - (used.get(v.name) || 0) * 7;
    };
    const best = voices.slice().sort((a, b) => score(b) - score(a))[0] || null;
    if (best) used.set(best.name, (used.get(best.name) || 0) + 1);
    const reuse = best ? used.get(best.name) - 1 : 0;
    let pitch = sp.pitch || 1;
    if (best && genderOf(best) !== sp.g) pitch *= sp.g === 'm' ? 0.8 : 1.18;
    pitch *= 1 + reuse * 0.12;
    out[id] = { voice: best, rate: (sp.rate || 1) * userRate, pitch: clamp(pitch, 0.5, 1.8) };
  });
  return out;
}

export function stop() { token++; if (synth) try { synth.cancel(); } catch (e) { } }

function speakOne(text, cfg, tk) {
  return new Promise(res => {
    if (!synth || tk !== token) return res();
    const u = new SpeechSynthesisUtterance(text);
    if (cfg.voice) { u.voice = cfg.voice; u.lang = cfg.voice.lang; } else u.lang = 'en-CA';
    u.rate = cfg.rate; u.pitch = cfg.pitch;
    let done = false; const fin = () => { if (done) return; done = true; clearTimeout(w); res(); };
    u.onend = fin; u.onerror = fin;
    const w = setTimeout(fin, ((wordCount(text) / 2.6) / (cfg.rate || 1) * 1000 + 4000) * 1.6); // watchdog
    synth.speak(u);
  });
}

/* lines: [[speakerId, text]]. Resolves true when finished, false if stopped. */
export async function play(lines, speakers, { onProgress, onLine } = {}) {
  const tk = ++token; const cfgs = assign(speakers);
  const chunks = [];
  lines.forEach((ln, li) => {
    let buf = '';
    sentences(ln[1]).forEach(s => { if ((buf + ' ' + s).length > 220 && buf) { chunks.push({ li, sp: ln[0], t: buf.trim() }); buf = s; } else buf += ' ' + s; });
    if (buf.trim()) chunks.push({ li, sp: ln[0], t: buf.trim() });
  });
  const total = chunks.reduce((n, c) => n + wordCount(c.t), 0) || 1; let done = 0, last = -1;
  if (synth) try { synth.cancel(); } catch (e) { }
  for (const c of chunks) {
    if (tk !== token) return false;
    if (c.li !== last) { if (last >= 0) await sleep(FAST ? 0 : 380); last = c.li; onLine && onLine(c.li); }
    if (FAST) await sleep(12); else await speakOne(c.t, cfgs[c.sp] || { rate: 1, pitch: 1 }, tk);
    done += wordCount(c.t); onProgress && onProgress(done / total);
  }
  return tk === token;
}

/* No voices installed: reveal the script as timed text at speaking pace (then hidden before questions). */
export async function playAsText(lines, onLine, { onProgress } = {}) {
  const tk = ++token; const total = lines.reduce((n, l) => n + wordCount(l[1]), 0) || 1; let done = 0;
  for (let i = 0; i < lines.length; i++) {
    if (tk !== token) return false;
    onLine(i); const w = wordCount(lines[i][1]);
    await sleep(FAST ? 8 : (w / 2.6) * 1000);
    done += w; onProgress && onProgress(done / total);
  }
  return tk === token;
}

export function testVoice() { play([['a', 'This is a sound check. If you can hear this clearly, you are ready to begin.']], { a: { g: 'f', acc: 'en-CA' } }); }
