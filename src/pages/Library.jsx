import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LuSearch, LuPlay, LuListChecks, LuCircleCheck } from 'react-icons/lu';
import * as bank from '../lib/bank.js';
import * as store from '../lib/store.js';
import { PART_LIST } from '../lib/bankShape.js';
import { levelLabel } from '../lib/grading.js';
import { PageHeader, Card, Badge, Button, SKILL_META, stagger } from '../components/ui.jsx';
import StartDialog from '../components/StartDialog.jsx';
import { cx } from '../lib/util.js';

export default function Library() {
  const [q, setQ] = useState(''); const [filter, setFilter] = useState('all'); const [dlg, setDlg] = useState(null);
  const tests = bank.all(); const hist = store.history();
  const best = useMemo(() => {
    const b = {};
    hist.forEach(a => (a.tests || []).forEach(id => { b[id] = b[id] || {}; ['L', 'R', 'W', 'S'].forEach(c => { if (a.levels && a.levels[c] != null && (a.tests.length === 1)) b[id][c] = Math.max(b[id][c] || 0, a.levels[c]); }); }));
    return b;
  }, [hist.length]);
  const progress = id => ['L', 'R', 'W', 'S'].map(c => ({ c, done: PART_LIST[c].filter(n => store.seenCount(`${id}.${c}${n}`)).length, total: PART_LIST[c].length }));
  const list = tests.filter(t => {
    const p = progress(t.id); const any = p.some(x => x.done), all = p.every(x => x.done === x.total);
    if (filter === 'new' && any) return false; if (filter === 'started' && (!any || all)) return false; if (filter === 'done' && !all) return false;
    if (!q) return true; const hay = (t.title + ' ' + (t.topics || []).join(' ') + ' ' + (t.listening || []).join(' ')).toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <PageHeader eyebrow="Question bank" title="Test library">
        <div className="relative"><LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search topics…" className="w-56 rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400" /></div>
        <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 text-sm">{[['all', 'All'], ['new', 'Not started'], ['started', 'In progress'], ['done', 'Completed']].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={cx('rounded-lg px-3 py-1 font-semibold', filter === k ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white')}>{l}</button>)}</div>
      </PageHeader>
      <p className="mb-6 max-w-3xl text-sm text-slate-400">Every test is complete and original: 6 Listening parts, 4 Reading parts, 2 Writing tasks and 8 Speaking tasks. Questions are hidden behind real exam conditions – the answer key appears only in your report after you submit.</p>
      <motion.div variants={stagger} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(t => { const p = progress(t.id); const b = best[t.id] || {}; const pct = p.reduce((s, x) => s + x.done, 0) / 20; return (
          <Card key={t.id} hover className="flex flex-col">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div><div className="text-lg font-extrabold">{t.title}</div>{t.custom && <Badge tone="brand">AI-generated</Badge>}</div>
              <div className="relative h-11 w-11"><svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90"><circle cx="18" cy="18" r="15" stroke="rgba(255,255,255,.08)" strokeWidth="4" fill="none" /><motion.circle cx="18" cy="18" r="15" stroke="#818cf8" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={94.2} initial={{ strokeDashoffset: 94.2 }} animate={{ strokeDashoffset: 94.2 * (1 - pct) }} transition={{ duration: 1 }} /></svg><span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{Math.round(pct * 100)}%</span></div>
            </div>
            <div className="mb-4 flex-1 space-y-1 text-sm text-slate-400">{(t.topics || []).slice(0, 2).map((x, i) => <div key={i} className="truncate">• {x}</div>)}</div>
            <div className="mb-4 grid grid-cols-4 gap-1.5">{p.map(x => { const M = SKILL_META[x.c]; return (
              <div key={x.c} className={cx('rounded-lg px-1.5 py-1.5 text-center', x.done ? M.bg : 'bg-white/5')} title={`${M.name}: ${x.done}/${x.total} parts done`}>
                <M.icon className={cx('mx-auto', x.done ? M.text : 'text-slate-500')} />
                <div className="mt-0.5 text-[10px] font-bold text-slate-300">{b[x.c] ? levelLabel(b[x.c], x.c) : `${x.done}/${x.total}`}</div>
              </div>); })}</div>
            <div className="flex gap-2">
              <Button size="sm" icon={LuPlay} className="flex-1" onClick={() => setDlg({ id: t.id, mode: 'full' })}>Full test</Button>
              <Button size="sm" variant="secondary" icon={LuListChecks} onClick={() => setDlg({ id: t.id, mode: 'component' })}>Sections</Button>
            </div>
          </Card>); })}
      </motion.div>
      {!list.length && <div className="mt-10 text-center text-slate-400">No tests match.</div>}
      <StartDialog open={!!dlg} onClose={() => setDlg(null)} initialTest={dlg && dlg.id} initialMode={dlg && dlg.mode} key={dlg ? dlg.id + dlg.mode : 'x'} />
    </motion.div>
  );
}
