import React from 'react';
import { motion } from 'framer-motion';
import { LuTrash2, LuArrowRight } from 'react-icons/lu';
import * as store from '../lib/store.js';
import { levelLabel } from '../lib/grading.js';
import { PageHeader, Card, Badge, SKILL_META, stagger, confirmDialog } from '../components/ui.jsx';
import { fmtDate, cx } from '../lib/util.js';

export default function History() {
  const hist = store.history().slice().reverse();
  const del = async (e, id) => { e.preventDefault(); if (await confirmDialog({ title: 'Delete this attempt?', body: 'It will be removed from your history and charts.', ok: 'Delete', tone: 'danger' })) store.deleteAttempt(id); };
  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <PageHeader eyebrow="Your progress" title="History" />
      {!hist.length && <Card><p className="text-slate-400">No attempts yet.</p></Card>}
      <div className="space-y-3">
        {hist.map(a => (
          <Card key={a.id} className="p-0">
            <a href={'#/report/' + a.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.03]">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="font-bold">{a.title}</span><Badge>{{ full: 'Full mock', component: 'Component', part: 'Drill', daily: 'Daily' }[a.mode] || a.mode}</Badge>{(a.W && !a.W.ai) || (a.S && !a.S.ai) ? <Badge tone="amber">offline estimate</Badge> : null}</div>
                <div className="text-xs text-slate-400">{fmtDate(a.date)} · {a.durationMin} min</div>
              </div>
              <div className="flex items-center gap-2">
                {['L', 'R', 'W', 'S'].map(c => { const M = SKILL_META[c]; const v = a.levels && a.levels[c]; return v == null ? null : (
                  <div key={c} className={cx('rounded-xl px-3 py-1.5 text-center', M.bg)}><div className={cx('text-[10px] font-bold uppercase', M.text)}>{M.name}</div><div className="text-sm font-extrabold">{levelLabel(v, c)}{(c === 'L' || c === 'R') && a[c] ? <span className="ml-1 text-[10px] font-medium text-slate-400">{a[c].raw}/{a[c].total}</span> : null}</div></div>); })}
                <button onClick={e => del(e, a.id)} className="ml-2 rounded-lg p-2 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300" title="Delete"><LuTrash2 /></button>
                <LuArrowRight className="text-slate-500" />
              </div>
            </a>
          </Card>))}
      </div>
    </motion.div>
  );
}
