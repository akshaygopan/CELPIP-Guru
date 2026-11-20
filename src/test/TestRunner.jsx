import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuLogOut, LuClock } from 'react-icons/lu';
import { Timer } from '../lib/timer.js';
import * as audio from '../lib/audio.js';
import * as recorder from '../lib/recorder.js';
import { fmtRemaining, uid, FAST, cx } from '../lib/util.js';
import { confirmDialog } from '../components/ui.jsx';
import { STEP_COMPONENTS } from './steps.jsx';

/* Runs a plan: a strict one-way list of steps (instructions, parts, tasks).
   Each part owns its timer; when time runs out a "Time is up" screen moves on automatically. */
export default function TestRunner({ plan, onExit, onFinish }) {
  const [idx, setIdx] = useState(0);
  const [time, setTime] = useState(null); // { left, total }
  const [nextBtn, setNextBtn] = useState({ visible: false, label: 'NEXT', disabled: false });
  const [timeUp, setTimeUp] = useState(null);
  const session = useRef({ id: uid(), mode: plan.mode, title: plan.title, started: new Date().toISOString(), answers: {}, writing: {}, speaking: {}, scoredParts: [], practice: {} }).current;
  const timers = useRef([]); const nextRef = useRef(null); const idxRef = useRef(0); const timeUpRef = useRef(null); const finished = useRef(false);

  const stopTimers = () => { timers.current.forEach(t => t.stop()); timers.current = []; };
  const advance = useCallback(() => {
    stopTimers(); audio.stop(); setTime(null); setTimeUp(null); timeUpRef.current = null; nextRef.current = null;
    setNextBtn(b => ({ ...b, visible: false }));
    const ni = idxRef.current + 1;
    if (ni >= plan.steps.length) { if (!finished.current) { finished.current = true; onFinish(session); } return; }
    idxRef.current = ni; setIdx(ni); window.scrollTo(0, 0);
  }, [plan, onFinish, session]);

  useEffect(() => () => { stopTimers(); audio.stop(); recorder.abort(); }, []);
  useEffect(() => { const h = e => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, []);

  const step = plan.steps[idx];
  const ctx = useMemo(() => {
    const my = idx; const alive = () => idxRef.current === my && !finished.current && !timeUpRef.current;
    const c = {
      session, alive,
      next: () => { if (idxRef.current === my) advance(); },
      setNext: ({ label = 'NEXT', disabled = false, confirm = null, onClick } = {}) => { nextRef.current = { onClick: onClick || (() => c.next()), confirm }; setNextBtn({ visible: true, label, disabled }); },
      enableNext: on => setNextBtn(b => ({ ...b, disabled: !on })),
      hideNext: () => { nextRef.current = null; setNextBtn(b => ({ ...b, visible: false })); },
      showTime: (left, total) => setTime({ left, total }),
      clearTime: () => setTime(null),
      timer: (secs, onEnd) => { const t = new Timer(secs, { onTick: s => { if (idxRef.current === my) setTime({ left: s, total: secs }); }, onEnd: () => { if (idxRef.current === my) (onEnd || (() => c.timeUp()))(); } }); timers.current.push(t); return t; },
      onTimeUp: fn => { c._onTimeUp = fn; },
      timeUp: (msg) => {
        if (idxRef.current !== my || timeUpRef.current) return;
        stopTimers(); audio.stop(); recorder.abort(); c.hideNext(); setTime(null);
        try { c._onTimeUp && c._onTimeUp(); } catch (e) { console.error(e); }
        timeUpRef.current = msg || 'Your answers for this part have been saved.'; setTimeUp(timeUpRef.current);
        setTimeout(() => { if (idxRef.current === my) advance(); }, FAST ? 150 : 3000);
      }
    };
    return c;
  }, [idx, advance, session]);

  const clickNext = async () => {
    const n = nextRef.current; if (!n || nextBtn.disabled) return;
    if (n.confirm) { const ok = await confirmDialog({ title: 'Move on?', body: n.confirm, ok: 'Yes, continue', cancel: 'Stay here', light: true }); if (!ok || nextRef.current !== n) return; }
    nextRef.current = null; n.onClick();
  };
  const exit = async () => {
    const ok = await confirmDialog({ title: 'Leave the test?', body: 'This attempt will not be scored or saved.', ok: 'Leave test', cancel: 'Keep going', tone: 'danger', light: true });
    if (ok) { finished.current = true; stopTimers(); audio.stop(); recorder.abort(); onExit(); }
  };

  const Comp = STEP_COMPONENTS[step.kind];
  const low = time && (time.total <= 120 ? time.left <= 10 : time.left <= 60);
  const compIdx = ['L', 'R', 'W', 'S'].indexOf(step.comp);
  return (
    <div className="exam">
      <header className="sticky top-0 z-30 bg-exam-bar text-white shadow-md">
        <div className="mx-auto flex min-h-14 max-w-[1320px] items-center justify-between gap-4 px-5 py-2">
          <div className="flex min-w-0 items-center gap-4">
            <button onClick={exit} className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white" title="Leave this test"><LuLogOut /> Exit</button>
            <div className="hidden h-6 w-px bg-white/20 sm:block" />
            <h1 className="truncate text-[15px] font-bold sm:text-[17px]">{step.label}</h1>
          </div>
          <div className="flex items-center gap-4">
            {time && <div className={cx('hidden items-center gap-1.5 whitespace-nowrap text-[14px] sm:flex', low ? 'font-bold text-amber-300' : 'text-white/90')}>
              <motion.span animate={low ? { scale: [1, 1.18, 1] } : {}} transition={{ repeat: Infinity, duration: 1 }}><LuClock /></motion.span>Time remaining: {fmtRemaining(time.left)}</div>}
            {time && <div className={cx('text-sm tabular-nums sm:hidden', low && 'text-amber-300 font-bold')}>{Math.floor(time.left / 60)}:{String(Math.max(0, Math.ceil(time.left % 60))).padStart(2, '0')}</div>}
            <AnimatePresence>{nextBtn.visible && (
              <motion.button key="next" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} whileTap={{ scale: 0.96 }}
                onClick={clickNext} disabled={nextBtn.disabled} id="btn-next"
                className="rounded-[3px] bg-white px-6 py-2 text-sm font-bold tracking-wide text-exam-bar shadow hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">{nextBtn.label}</motion.button>)}
            </AnimatePresence>
          </div>
        </div>
        {compIdx >= 0 && plan.mode === 'full' && <div className="h-1 bg-white/10"><motion.div className="h-full bg-sky-400" animate={{ width: `${((idx + 1) / plan.steps.length) * 100}%` }} transition={{ duration: 0.6 }} /></div>}
      </header>
      <main className="mx-auto w-full max-w-[1320px] px-5 py-6">
        <AnimatePresence mode="wait">
          {timeUp ? (
            <motion.div key="timeup" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-center">
              <div className="text-3xl font-bold">Time is up</div><div>{timeUp}</div><div className="text-sm text-slate-500">Moving to the next part…</div>
            </motion.div>
          ) : (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              {Comp ? <Comp step={step} ctx={ctx} /> : <div>Unknown step {step.kind}</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
