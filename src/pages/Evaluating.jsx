import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuCircleCheck, LuTriangleAlert, LuBrain } from 'react-icons/lu';
import { evaluate } from '../lib/evaluate.js';
import * as ai from '../lib/ai.js';
import { Card, Button, Spinner } from '../components/ui.jsx';
import { cx } from '../lib/util.js';

/* Shown right after submission: scoring runs here, then the report opens. */
export default function Evaluating({ session, onDone }) {
  const [steps, setSteps] = useState([]); const skip = useRef(false); const [skipping, setSkipping] = useState(false); const started = useRef(false);
  useEffect(() => {
    if (started.current) return; started.current = true;
    evaluate(session, { onProgress: setSteps, shouldSkip: () => skip.current }).then(att => setTimeout(() => onDone(att.id), 600)).catch(e => { console.error(e); });
  }, []);
  const done = steps.filter(s => s.state === 'done' || s.state === 'err').length;
  return (
    <div className="mx-auto max-w-2xl py-6">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-cyan-500 text-5xl shadow-2xl shadow-brand-500/40">
        <motion.span animate={{ rotate: [0, 8, -8, 0] }} transition={{ repeat: Infinity, duration: 2.4 }}><LuBrain /></motion.span>
      </motion.div>
      <h1 className="text-center text-3xl font-extrabold">Your test is submitted</h1>
      <p className="mt-2 text-center text-slate-400">Listening and Reading are scored from the answer key. {ai.available() ? <>Writing and Speaking are being rated by <b className="text-white">{ai.providerLabel()}</b> on the official four dimensions.</> : 'No AI provider is set up, so Writing and Speaking get an offline estimate (you can re-grade later).'}</p>
      <div className="my-6 h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-gradient-to-r from-brand-500 to-cyan-400" animate={{ width: `${steps.length ? (done / steps.length) * 100 : 5}%` }} transition={{ duration: 0.5 }} /></div>
      <Card className="space-y-1 p-3">
        <AnimatePresence>{steps.map((s, i) => (
          <motion.div key={s.k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={cx('flex items-start gap-3 rounded-xl px-3 py-2.5', s.state === 'run' && 'bg-white/5')}>
            <span className="mt-0.5 w-5">{s.state === 'done' ? <LuCircleCheck className="text-emerald-400" /> : s.state === 'err' ? <LuTriangleAlert className="text-amber-400" /> : s.state === 'run' ? <Spinner /> : <span className="block h-2 w-2 translate-x-1.5 translate-y-1.5 rounded-full bg-white/25" />}</span>
            <div className="min-w-0"><div className={cx('text-sm font-semibold', !s.state && 'text-slate-500')}>{s.label}</div>{s.msg && <div className="text-xs text-slate-400">{s.msg}</div>}</div>
          </motion.div>))}
        </AnimatePresence>
      </Card>
      {ai.available() && <div className="mt-5 text-center"><Button variant="ghost" size="sm" disabled={skipping} onClick={() => { skip.current = true; setSkipping(true); }}>{skipping ? 'Skipping remaining AI grading…' : 'Skip AI grading (use offline estimates)'}</Button></div>}
    </div>
  );
}
