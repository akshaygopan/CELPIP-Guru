import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuX, LuPlay, LuClock } from 'react-icons/lu';
import * as bank from '../lib/bank.js';
import * as store from '../lib/store.js';
import { PART_LIST, partName, partWord, SKILL } from '../lib/bankShape.js';
import { fullPlan, componentPlan, partPlan } from '../test/plans.jsx';
import { startPractice } from '../App.jsx';
import { Button, SKILL_META } from './ui.jsx';
import { cx } from '../lib/util.js';

const DUR = { L: '47–55 min', R: '55–60 min', W: '53 min', S: '15–20 min' };

/* Modal to start a full mock test, a component or a single part from any test */
export default function StartDialog({ open, onClose, initialTest, initialMode = 'full', initialComp = 'L' }) {
  const tests = bank.all();
  const [mode, setMode] = useState(initialMode || 'full');
  const [tid, setTid] = useState(initialTest || (tests[0] && tests[0].id));
  const [comp, setComp] = useState(initialComp || 'L');
  const [n, setN] = useState(1);
  const available = useMemo(() => tests.filter(t => mode === 'full' ? (bank.isBuiltIn(t.id) || bank.customComplete(store.customTests().find(x => x.id === t.id))) : PART_LIST[comp].some(k => bank.testHas(t.id, comp, k))), [mode, comp, tests.length]);
  const tidOk = available.find(t => t.id === tid) ? tid : (available[0] && available[0].id);
  const start = () => {
    onClose();
    if (mode === 'full') startPractice(fullPlan(tidOk));
    else if (mode === 'component') startPractice(componentPlan(tidOk, comp));
    else startPractice(partPlan(tidOk, comp, n));
  };
  return (
    <AnimatePresence>{open && (
      <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div onClick={e => e.stopPropagation()} initial={{ y: 30, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="glass-strong w-full max-w-2xl bg-ink-800/95 p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-extrabold">Start practice</h2><button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><LuX /></button></div>
          <div className="mb-5 grid grid-cols-3 gap-2">
            {[['full', 'Full mock test', '≈ 3 hours, real order'], ['component', 'One component', 'Listening, Reading…'], ['part', 'Part / task drill', '5–15 minutes']].map(([k, t, s]) => (
              <button key={k} onClick={() => setMode(k)} className={cx('rounded-xl border p-3 text-left transition-colors', mode === k ? 'border-brand-400 bg-brand-500/15' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
                <div className="text-sm font-bold">{t}</div><div className="text-xs text-slate-400">{s}</div>
              </button>))}
          </div>
          {mode !== 'full' && (
            <div className="mb-4 grid grid-cols-4 gap-2">
              {['L', 'R', 'W', 'S'].map(c => { const M = SKILL_META[c]; return (
                <button key={c} onClick={() => { setComp(c); setN(1); }} className={cx('flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors', comp === c ? `border-white/30 ${M.bg}` : 'border-white/10 bg-white/5 hover:bg-white/10')}>
                  <M.icon className={cx('text-xl', M.text)} /><span className="text-sm font-semibold">{M.name}</span><span className="text-[11px] text-slate-400">{DUR[c]}</span>
                </button>); })}
            </div>)}
          {mode === 'part' && (
            <div className="mb-4 flex flex-wrap gap-2">
              {PART_LIST[comp].map(k => <button key={k} onClick={() => setN(k)} className={cx('rounded-lg border px-3 py-1.5 text-xs font-semibold', n === k ? 'border-brand-400 bg-brand-500/20 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10')}>{partWord(comp)} {k}: {partName(comp, k)}</button>)}
            </div>)}
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Test</label>
          <select value={tidOk || ''} onChange={e => setTid(e.target.value)} className="mb-5 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm">
            {available.map(t => { const done = ['L', 'R', 'W', 'S'].some(c => store.seenCount(`${t.id}.${c}1`)); return <option key={t.id} value={t.id}>{t.title}{t.custom ? ' (AI)' : ''}{done ? ' ✓ practised' : ''}{t.topics && t.topics[0] ? ` – ${t.topics[0]}` : ''}</option>; })}
          </select>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400"><LuClock /> {mode === 'full' ? 'About 3 hours · answers revealed only after you submit' : 'Answers and scores revealed only after you finish'}</div>
            <Button icon={LuPlay} onClick={start} disabled={!tidOk}>Begin</Button>
          </div>
        </motion.div>
      </motion.div>)}
    </AnimatePresence>
  );
}
