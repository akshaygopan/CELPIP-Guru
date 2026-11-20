// Small shared helpers
const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const FAST = params.get('fast') === '1'; // self-test mode: compresses all timers
export const TIME_SCALE = FAST ? 0.02 : 1;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
export const round1 = v => Math.round(v * 10) / 10;
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const wordCount = t => (String(t || '').trim().match(/[A-Za-z0-9À-ɏ'’-]+/g) || []).length;
export const sentences = t => String(t || '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["')\]”’]*|[^.!?]+$/g) || [];
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fmtClock = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const fmtRemaining = s => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60); return `${m} minute${m === 1 ? '' : 's'} ${String(s % 60).padStart(2, '0')} seconds`; };
export const fmtDate = iso => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const cx = (...a) => a.filter(Boolean).join(' ');

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* Highlight the first occurrence of `phrase` inside a DOM element (works across text nodes). */
export function highlightIn(root, phrase, title) {
  if (!root || !phrase) return null;
  const norm = s => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = []; let full = '';
  while (walker.nextNode()) { nodes.push({ n: walker.currentNode, start: full.length }); full += walker.currentNode.nodeValue; }
  const hay = norm(full);
  // whitespace-insensitive search
  const map = []; let sq = '';
  for (let i = 0; i < hay.length; i++) { const ws = /\s/.test(hay[i]); if (ws && /\s/.test(sq[sq.length - 1] || '')) continue; map.push(i); sq += ws ? ' ' : hay[i]; }
  const needle = norm(phrase.trim()).replace(/\s+/g, ' ');
  const j = sq.indexOf(needle); if (j < 0) return null;
  const a = map[j], b = map[j + needle.length - 1] + 1;
  let first = null;
  for (const { n, start } of nodes) {
    const end = start + n.nodeValue.length; if (end <= a || start >= b) continue;
    const range = document.createRange(); range.setStart(n, Math.max(0, a - start)); range.setEnd(n, Math.min(n.nodeValue.length, b - start));
    const m = document.createElement('mark'); m.className = 'ev-mark'; if (title) m.title = title;
    try { range.surroundContents(m); first = first || m; } catch (e) { /* crosses element boundary */ }
  }
  return first;
}
