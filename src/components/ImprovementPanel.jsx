import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuCrosshair, LuTrendingUp, LuTrendingDown, LuMinus, LuPlay, LuMessageSquareQuote, LuMap, LuSparkles } from 'react-icons/lu';
import { insights, partLabel } from '../lib/insights.js';
import { partPlan, freshest } from '../test/plans.jsx';
import { startPractice } from '../App.jsx';
import { SKILL, partWord } from '../lib/bankShape.js';
import { levelLabel } from '../lib/grading.js';
import { Card, Badge, SKILL_META, toast } from './ui.jsx';
import { cx, fmtDate } from '../lib/util.js';

const STATUS = {
  good: { label: 'On target', cls: 'bg-emerald-400', text: 'text-emerald-300' },
  close: { label: 'Almost', cls: 'bg-amber-400', text: 'text-amber-300' },
  weak: { label: 'Needs work', cls: 'bg-rose-400', text: 'text-rose-300' },
  new: { label: 'Not practised', cls: 'bg-white/15', text: 'text-slate-500' }
};
// Which drill trains a weak question type or rating dimension best.
const TYPE_PART = { L: { attitude: 6, viewpoint: 6, inference: 5, prediction: 2, main: 4, purpose: 3, detail: 1, paraphrase: 3 }, R: { notgiven: 3, attitude: 4, viewpoint: 4, diagram: 2, coherence: 1, vocab: 4, inference: 1, main: 3, purpose: 1, detail: 2, paraphrase: 3 } };
const DIM_TASK = { W: { readability: 1, task: 1, content: 2, vocabulary: 2 }, S: { content: 1, vocabulary: 3, listenability: 7, task: 6 } };

function drill(c, n) {
  const t = freshest(c, n);
  if (!t) { toast('No test available for that part.', 'error'); return; }
  startPractice(partPlan(t.id, c, n));
}
const Trend = ({ v }) => v == null ? null : v > 0.2 ? <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-300"><LuTrendingUp />+{v}</span> : v < -0.2 ? <span className="flex items-center gap-0.5 text-xs font-bold text-rose-300"><LuTrendingDown />{v}</span> : <span className="flex items-center gap-0.5 text-xs text-slate-400"><LuMinus />steady</span>;

export default function ImprovementPanel() {
  const ins = useMemo(() => insights(), []);
  const [skill, setSkill] = useState('L');
  const empty = ins.attempts === 0;

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-xl font-extrabold"><LuCrosshair className="text-rose-300" /> Where to improve</h2><p className="text-sm text-slate-400">Built from your last {Math.max(ins.attempts, 0)} attempt{ins.attempts === 1 ? '' : 's'} and measured against your CLB {ins.target} target.</p></div>
        <div className="flex items-center gap-3 text-xs text-slate-400"><span>Parts practised</span><div className="h-2 w-32 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-gradient-to-r from-brand-500 to-cyan-400" initial={{ width: 0 }} animate={{ width: `${ins.coverage * 100}%` }} transition={{ duration: 1 }} /></div><b className="text-white">{Math.round(ins.coverage * 20)}/20</b></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* Focus queue */}
        <Card>
          <h3 className="mb-1 font-bold">Your focus queue</h3>
          <p className="mb-4 text-xs text-slate-400">Biggest gaps to your target first. One click starts a drill with a test you have not used yet.</p>
          {empty ? <EmptyNote text="Finish any test or drill and your personal focus list appears here." /> : !ins.focus.length ? <EmptyNote text={`Everything you have practised is at CLB ${ins.target} or above. Try a full mock test or a part you have not practised yet.`} good /> : (
            <div className="space-y-2.5">{ins.focus.map((f, i) => {
              const M = SKILL_META[f.c];
              let title, why, pct, go;
              if (f.kind === 'part') { title = `${partLabel(f)}: ${f.name}`; why = f.acc != null ? `${Math.round(f.acc * 100)}% correct (${f.ok}/${f.tot}) · about ${Math.round(f.need * 100)}% needed for CLB ${ins.target}` : `≈ Level ${f.level} on recent tasks · target ${ins.target}`; pct = f.acc != null ? f.acc / f.need : f.level / ins.target; go = () => drill(f.c, f.n); }
              else if (f.kind === 'dim') { const n = DIM_TASK[f.c][f.d] || 1; title = `${SKILL[f.c]}: ${f.label}`; why = `Rated ≈ ${f.level} on average · practise with ${partWord(f.c)} ${n}`; pct = f.level / ins.target; go = () => drill(f.c, n); }
              else { const n = TYPE_PART[f.c][f.t] || 1; title = `${SKILL[f.c]} question type: ${f.label}`; why = `${Math.round(f.acc * 100)}% correct (${f.ok}/${f.tot}) · drill ${partWord(f.c)} ${n}`; pct = f.acc; go = () => drill(f.c, n); }
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:border-white/20">
                  <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold', M.bg, M.text)}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{title}</div>
                    <div className="truncate text-xs text-slate-400">{why}</div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: M.color }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct * 100)}%` }} transition={{ duration: 0.8, delay: 0.1 + i * 0.05 }} /></div>
                  </div>
                  <button onClick={go} className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-brand-500"><LuPlay /> Drill</button>
                </motion.div>); })}
            </div>)}
          {ins.untouched.length > 0 && !empty && <p className="mt-4 text-xs text-slate-400">Not practised yet: {ins.untouched.slice(0, 6).map((p, i) => <button key={i} onClick={() => drill(p.c, p.n)} className="mr-1.5 mt-1 inline-block rounded-md bg-white/5 px-2 py-0.5 text-slate-300 hover:bg-white/15">{p.c}{p.n}</button>)}{ins.untouched.length > 6 ? `+${ins.untouched.length - 6} more` : ''}</p>}
        </Card>

        {/* Skill map */}
        <Card>
          <div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><LuMap className="text-brand-300" /> Skill map</h3>
            <div className="flex rounded-lg bg-white/5 p-0.5">{['L', 'R', 'W', 'S'].map(c => <button key={c} onClick={() => setSkill(c)} className={cx('relative rounded-md px-2.5 py-1 text-xs font-bold', skill === c ? 'text-white' : 'text-slate-400 hover:text-white')}>{skill === c && <motion.span layoutId="skillpill" className={cx('absolute inset-0 rounded-md', SKILL_META[c].bg)} />}<span className="relative">{SKILL_META[c].name}</span></button>)}</div>
          </div>
          <div className="mb-3 flex items-center gap-3 text-xs text-slate-400"><span>Recent trend:</span><Trend v={ins.trend[skill]} />{ins.trend[skill] == null && <span>needs 2+ results</span>}</div>
          <AnimatePresence mode="wait"><motion.div key={skill} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-1.5">
            {ins.map[skill].map(p => { const S = STATUS[p.status]; const v = p.acc != null ? p.acc : p.level != null ? p.level / 12 : 0; return (
              <button key={p.n} onClick={() => drill(p.c, p.n)} title="Start a drill" className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
                <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', S.cls)} />
                <span className="w-44 shrink-0 truncate text-xs"><b>{p.n}.</b> {p.name}</span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <motion.span className={cx('absolute inset-y-0 left-0 rounded-full', S.cls)} initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ duration: 0.7 }} />
                  {p.need && <span className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: `${p.need * 100}%` }} title="needed for your target" />}
                </span>
                <span className={cx('w-20 shrink-0 text-right text-xs font-semibold', S.text)}>{p.acc != null ? `${Math.round(p.acc * 100)}%` : p.level != null ? `≈ ${levelLabel(p.level, p.c)}` : S.label}</span>
              </button>); })}
          </motion.div></AnimatePresence>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">{['good', 'close', 'weak', 'new'].map(k => <span key={k} className="flex items-center gap-1.5"><span className={cx('h-2 w-2 rounded-full', STATUS[k].cls)} />{STATUS[k].label}</span>)}{(skill === 'L' || skill === 'R') && <span className="flex items-center gap-1.5"><span className="h-2.5 w-0.5 bg-white/70" />needed for CLB {ins.target}</span>}</div>
        </Card>
      </div>

      {/* Dimensions + rater advice */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {['W', 'S'].map(c => (
          <Card key={c}>
            <h3 className="mb-3 text-sm font-bold">{SKILL[c]} – rating dimensions</h3>
            {ins.dims[c].length ? <div className="space-y-2.5">{ins.dims[c].map(r => (
              <div key={r.d}>
                <div className="mb-1 flex justify-between text-xs"><span className="text-slate-300">{r.label}</span><span className={cx('font-bold', r.level >= ins.target ? 'text-emerald-300' : r.level >= ins.target - 1 ? 'text-amber-300' : 'text-rose-300')}>≈ {r.level}</span></div>
                <div className="relative h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: SKILL_META[c].color }} initial={{ width: 0 }} animate={{ width: `${r.level / 12 * 100}%` }} transition={{ duration: 0.8 }} /><span className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: `${ins.target / 12 * 100}%` }} /></div>
              </div>))}</div> : <EmptyNote text={`Complete a ${SKILL[c]} task to see Content/Coherence, Vocabulary, ${c === 'W' ? 'Readability' : 'Listenability'} and Task Fulfillment.`} />}
          </Card>))}
        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><LuMessageSquareQuote className="text-amber-300" /> Latest advice from the rater</h3>
          {ins.tips.length ? <ul className="space-y-2.5">{ins.tips.map((t, i) => <li key={i} className="text-xs leading-relaxed text-slate-300"><Badge className={cx('mr-1.5 text-[10px]', SKILL_META[t.c].bg, SKILL_META[t.c].text)}>{t.c}{t.n}</Badge>{t.text}{!t.ai && <span className="text-slate-500"> (offline)</span>}</li>)}</ul> : <EmptyNote text="Fix-it tips from your Writing and Speaking ratings collect here." />}
        </Card>
      </div>
    </section>
  );
}
const EmptyNote = ({ text, good }) => <div className={cx('rounded-xl border border-dashed p-5 text-center text-sm', good ? 'border-emerald-400/30 text-emerald-200' : 'border-white/10 text-slate-400')}>{good && <LuSparkles className="mx-auto mb-1" />}{text}</div>;
