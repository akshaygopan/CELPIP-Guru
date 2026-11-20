// Speaking capture with free browser APIs: MediaRecorder (replayable audio), SpeechRecognition (transcript),
// and a Web Audio level meter that measures voiced time, long pauses and late starts.
import { TIME_SCALE, FAST, sleep, wordCount } from './util.js';

let stream = null, actx = null, analyser = null;
let mr = null, chunks = [], rec = null, recOn = false, finals = [], interim = '', startT = 0, meterH = null, meter = null;
export const status = { mic: false, stt: 'none', error: '' };
let liveCb = null;
export const onLive = fn => { liveCb = fn; };

const FILLER_RE = /\b(um+|uh+|erm+|er|ah+|hmm+|you know|i mean|like,|sort of|kind of|basically)\b/gi;

export async function init() {
  status.error = '';
  if (!stream) {
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); status.mic = true; }
    catch (e) { status.mic = false; status.error = 'Microphone not available: ' + (e.message || e.name); }
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  status.stt = SR ? 'webspeech' : 'none';
  if (stream && !actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); const src = actx.createMediaStreamSource(stream); analyser = actx.createAnalyser(); analyser.fftSize = 1024; src.connect(analyser); } catch (e) { actx = null; }
  }
  return { ...status };
}

function startMeter() {
  meter = { frames: 0, speech: 0, silence: 0, longPauses: 0, shortPauses: 0, started: false, floor: 1, first: null, last: null };
  if (!analyser) return;
  if (actx && actx.state === 'suspended') actx.resume();
  const buf = new Float32Array(analyser.fftSize);
  meterH = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / buf.length); meter.frames++;
    if (meter.frames < 8) meter.floor = Math.min(meter.floor, rms || 1);
    const t = meter.frames * 0.1;
    if (rms > Math.max(0.012, meter.floor * 3)) {
      if (meter.started && meter.silence >= 2) meter.longPauses++; else if (meter.started && meter.silence >= 1) meter.shortPauses++;
      meter.started = true; meter.speech++; meter.silence = 0; if (meter.first == null) meter.first = t; meter.last = t;
    } else if (meter.started) meter.silence += 0.1;
  }, 100);
}

function startSTT() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
  try {
    rec = new SR(); rec.lang = 'en-CA'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = ev => {
      interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) { const r = ev.results[i]; if (r.isFinal) finals.push(r[0].transcript.trim()); else interim += r[0].transcript; }
      liveCb && liveCb((finals.join(' ') + ' ' + interim).trim());
    };
    rec.onerror = ev => { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { status.stt = 'none'; recOn = false; } };
    rec.onend = () => { if (recOn) { try { rec.start(); } catch (e) { } } }; // Chrome stops after silence
    recOn = true; rec.start();
  } catch (e) { /* ignore */ }
}

export function start() {
  chunks = []; finals = []; interim = ''; startT = performance.now();
  if (stream && window.MediaRecorder) {
    try {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
      mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.start(1000);
    } catch (e) { mr = null; }
  }
  startMeter(); startSTT();
}

export async function stop() {
  const durationSec = (performance.now() - startT) / 1000 / TIME_SCALE;
  clearInterval(meterH); recOn = false; if (rec) { try { rec.stop(); } catch (e) { } }
  let blob = null;
  if (mr && mr.state !== 'inactive') blob = await new Promise(res => { mr.onstop = () => res(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })); try { mr.stop(); } catch (e) { res(null); } });
  await sleep(FAST ? 40 : 900);
  if (interim.trim()) finals.push(interim.trim());
  const transcript = finals.join(' ').replace(/\s+/g, ' ').trim();
  const words = wordCount(transcript);
  const fillers = (transcript.match(FILLER_RE) || []).map(s => s.toLowerCase().replace(',', ''));
  const m = meter || {};
  const metrics = {
    durationSec: Math.round(durationSec), words, wpm: durationSec > 0 ? Math.round(words / (durationSec / 60)) : 0,
    speechSec: analyser ? Math.round(m.speech * 0.1 / TIME_SCALE) : null,
    longPauses: analyser ? m.longPauses : null, shortPauses: analyser ? m.shortPauses : null,
    startDelaySec: m.first != null ? Math.round(m.first / TIME_SCALE * 10) / 10 : null,
    endedEarlySec: m.last != null ? Math.max(0, Math.round(durationSec - m.last / TIME_SCALE)) : null,
    fillers: fillers.length, fillerList: fillers, stt: status.stt
  };
  mr = null; rec = null;
  return { blob, transcript, metrics };
}

export function abort() { clearInterval(meterH); recOn = false; try { rec && rec.stop(); } catch (e) { } try { mr && mr.state !== 'inactive' && mr.stop(); } catch (e) { } rec = null; mr = null; }
