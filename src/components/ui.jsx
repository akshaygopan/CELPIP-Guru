import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuX, LuHeadphones, LuBookOpen, LuPenLine, LuMic } from 'react-icons/lu';
import { cx } from '../lib/util.js';

export const SKILL_META = {
  L: { name: 'Listening', icon: LuHeadphones, color: '#38bdf8', text: 'text-sky-300', bg: 'bg-sky-500/15', ring: 'ring-sky-400/30', grad: 'from-sky-500 to-cyan-400' },
  R: { name: 'Reading', icon: LuBookOpen, color: '#fbbf24', text: 'text-amber-300', bg: 'bg-amber-500/15', ring: 'ring-amber-400/30', grad: 'from-amber-500 to-orange-400' },
  W: { name: 'Writing', icon: LuPenLine, color: '#34d399', text: 'text-emerald-300', bg: 'bg-emerald-500/15', ring: 'ring-emerald-400/30', grad: 'from-emerald-500 to-teal-400' },
  S: { name: 'Speaking', icon: LuMic, color: '#fb7185', text: 'text-rose-300', bg: 'bg-rose-500/15', ring: 'ring-rose-400/30', grad: 'from-rose-500 to-pink-400' }
};

export const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } } };
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };

export function Card({ children, className, hover, onClick, ...rest }) {
  return (
    <motion.div variants={fadeUp} whileHover={hover ? { y: -4, transition: { type: 'spring', stiffness: 400, damping: 22 } } : undefined}
      onClick={onClick} className={cx('glass p-5', hover && 'cursor-pointer hover:border-white/25 hover:bg-white/[0.07] transition-colors', className)} {...rest}>
      {children}
    </motion.div>
  );
}

const BTN = {
  primary: 'bg-gradient-to-r from-brand-500 to-cyan-500 text-white shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40',
  secondary: 'bg-white/10 text-white hover:bg-white/15 border border-white/10',
  ghost: 'text-slate-300 hover:text-white hover:bg-white/10',
  danger: 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-400/20',
  light: 'bg-white text-ink-900 hover:bg-slate-100'
};
export function Button({ variant = 'primary', size = 'md', className, children, icon: Icon, disabled, ...rest }) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-sm gap-1.5' : size === 'lg' ? 'px-6 py-3.5 text-base gap-2.5' : 'px-4 py-2.5 text-sm gap-2';
  return (
    <motion.button whileHover={disabled ? undefined : { scale: 1.03 }} whileTap={disabled ? undefined : { scale: 0.97 }} disabled={disabled}
      className={cx('inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed', sz, BTN[variant], className)} {...rest}>
      {Icon && <Icon className={size === 'lg' ? 'text-xl' : 'text-base'} />}{children}
    </motion.button>
  );
}

export function Badge({ children, className, tone = 'slate' }) {
  const tones = { slate: 'bg-white/10 text-slate-300', green: 'bg-emerald-500/15 text-emerald-300', amber: 'bg-amber-500/15 text-amber-300', red: 'bg-rose-500/15 text-rose-300', brand: 'bg-brand-500/20 text-brand-300', sky: 'bg-sky-500/15 text-sky-300' };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }) {
  return <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} className={cx('inline-block h-4 w-4 rounded-full border-2 border-white/25 border-t-brand-400', className)} />;
}

export function AnimatedNumber({ value, decimals = 0, duration = 900 }) {
  const [v, setV] = useState(0); const from = useRef(0);
  useEffect(() => {
    if (value == null || isNaN(value)) return; const start = performance.now(); const a = from.current; let raf;
    const tick = t => { const p = Math.min(1, (t - start) / duration); const e = 1 - Math.pow(1 - p, 3); setV(a + (value - a) * e); if (p < 1) raf = requestAnimationFrame(tick); else from.current = value; };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value]);
  if (value == null || isNaN(value)) return <>–</>;
  return <>{v.toFixed(decimals)}</>;
}

/* Animated circular progress used for levels */
export function Ring({ value, max = 12, size = 92, stroke = 8, color = '#818cf8', label, sub, target }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, frac = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        {target && <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={2} fill="none" strokeDasharray={`2 ${c}`} strokeDashoffset={-c * (target / max)} />}
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - frac) }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-xl font-extrabold">{label}</span>
        {sub && <span className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('no-print flex flex-wrap gap-1 rounded-2xl bg-white/5 p-1 border border-white/10', className)}>
      {tabs.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={cx('relative rounded-xl px-4 py-2 text-sm font-semibold transition-colors', value === k ? 'text-white' : 'text-slate-400 hover:text-slate-200')}>
          {value === k && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-xl bg-white/10 border border-white/10" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- global modal / confirm / toast (simple external stores) ---------- */
function createStore(initial) { let s = initial; const l = new Set(); return { get: () => s, set: v => { s = v; l.forEach(f => f()); }, sub: f => { l.add(f); return () => l.delete(f); } }; }
const modalStore = createStore(null);
const toastStore = createStore([]);
export function confirmDialog({ title, body, ok = 'Continue', cancel = 'Cancel', tone = 'primary', light = false }) {
  return new Promise(res => modalStore.set({ title, body, ok, cancel, tone, light, res }));
}
export function toast(msg, tone = 'info') { const id = Math.random(); toastStore.set([...toastStore.get(), { id, msg, tone }]); setTimeout(() => toastStore.set(toastStore.get().filter(t => t.id !== id)), 3800); }

export function Overlays() {
  const m = useSyncExternalStore(modalStore.sub, modalStore.get);
  const toasts = useSyncExternalStore(toastStore.sub, toastStore.get);
  const close = v => { m && m.res(v); modalStore.set(null); };
  return (
    <>
      <AnimatePresence>
        {m && (
          <motion.div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close(false)}>
            <motion.div onClick={e => e.stopPropagation()} initial={{ scale: 0.92, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={cx('w-full max-w-md rounded-2xl p-6 shadow-2xl', m.light ? 'bg-white text-slate-900 font-exam' : 'glass-strong bg-ink-800/90')} role="dialog" aria-modal="true">
              <div className="flex items-start justify-between gap-4"><h3 className="text-lg font-bold">{m.title}</h3><button onClick={() => close(false)} className="opacity-60 hover:opacity-100" aria-label="Close"><LuX /></button></div>
              <div className={cx('mt-2 text-sm leading-relaxed', m.light ? 'text-slate-600' : 'text-slate-300')}>{m.body}</div>
              <div className="mt-6 flex justify-end gap-2">
                {m.cancel !== null && <Button variant={m.light ? 'light' : 'secondary'} className={m.light ? 'border border-slate-300' : ''} onClick={() => close(false)}>{m.cancel}</Button>}
                <Button variant={m.tone} onClick={() => close(true)}>{m.ok}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[110] flex -translate-x-1/2 flex-col items-center gap-2">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
              className={cx('rounded-xl px-4 py-2.5 text-sm font-medium shadow-xl', t.tone === 'error' ? 'bg-rose-600 text-white' : 'bg-white text-ink-900')}>{t.msg}</motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

/* Line chart (one y-axis, hover tooltips, animated draw) */
export function LineChart({ series, ymin, ymax, ticks, target, height = 240 }) {
  const W = 900, H = height, pl = 34, pr = 86, pt = 12, pb = 18;
  const n = Math.max(1, ...series.map(s => s.pts.length));
  const x = i => pl + (n <= 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1));
  const y = v => pt + (1 - (Math.max(ymin, Math.min(ymax, v)) - ymin) / (ymax - ymin)) * (H - pt - pb);
  const [tip, setTip] = useState(null);
  const labels = [];
  series.forEach(s => { const pts = s.pts.map((p, i) => p && [x(i), y(p.v)]).filter(Boolean); if (pts.length) labels.push({ y: pts[pts.length - 1][1], name: s.name, color: s.color }); });
  labels.sort((a, b) => a.y - b.y); for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {ticks.map(t => <g key={t}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.07)" /><text x={pl - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#94a3b8">{t}</text></g>)}
        {target != null && <><line x1={pl} x2={W - pr} y1={y(target)} y2={y(target)} stroke="#a5b4fc" strokeDasharray="5 5" opacity="0.6" /><text x={W - pr + 6} y={y(target) - 6} fontSize="11" fill="#a5b4fc">target {target}</text></>}
        {series.map(s => {
          const pts = s.pts.map((p, i) => p && { x: x(i), y: y(p.v), p }).filter(Boolean); if (!pts.length) return null;
          return (
            <g key={s.name}>
              <motion.path d={'M' + pts.map(p => `${p.x},${p.y}`).join(' L')} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
              {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="5" fill={s.color} stroke="#0b1124" strokeWidth="2" onMouseEnter={() => setTip({ x: p.x / W, y: p.y / H, text: `${s.name}: ${p.p.label}` })} onMouseLeave={() => setTip(null)} style={{ cursor: 'pointer' }} />)}
            </g>
          );
        })}
        {labels.map(l => <text key={l.name} x={W - pr + 8} y={l.y + 4} fontSize="12" fill="#e2e8f0">{l.name}</text>)}
      </svg>
      {tip && <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-ink-900 shadow-lg" style={{ left: `${tip.x * 100}%`, top: `calc(${tip.y * 100}% - 10px)` }}>{tip.text}</div>}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">{series.map(s => <span key={s.name} className="inline-flex items-center gap-1.5"><i className="inline-block h-1 w-4 rounded" style={{ background: s.color }} />{s.name}</span>)}</div>
    </div>
  );
}

export function BarRow({ label, value, right, color }) {
  const c = color || (value >= 0.85 ? '#34d399' : value >= 0.65 ? '#fbbf24' : '#fb7185');
  return (
    <div className="grid grid-cols-[minmax(120px,220px)_1fr_56px] items-center gap-3 text-sm">
      <span className="truncate text-slate-300">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10 print-keep"><motion.div className="h-full rounded-full" style={{ background: c }} initial={{ width: 0 }} animate={{ width: `${Math.round(value * 100)}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} /></div>
      <span className="text-right tabular-nums text-slate-400">{right}</span>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }) {
  return (
    <motion.div variants={fadeUp} className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>{eyebrow && <div className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-300">{eyebrow}</div>}<h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1></div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </motion.div>
  );
}
