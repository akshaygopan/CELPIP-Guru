import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LuFlame, LuPlay, LuZap, LuTarget, LuArrowRight, LuSparkles, LuGraduationCap, LuShieldCheck, LuBrain, LuTrophy } from 'react-icons/lu';
import * as store from '../lib/store.js';
import * as bank from '../lib/bank.js';
import * as ai from '../lib/ai.js';
import { SKILL, partName, partWord } from '../lib/bankShape.js';
import { typeName, levelLabel } from '../lib/grading.js';
import { dailyItems, dailyPlan, skillAverages, weakTypes } from '../test/plans.jsx';
import { startPractice, go } from '../App.jsx';
import { Card, Button, Badge, Ring, AnimatedNumber, LineChart, BarRow, SKILL_META, stagger, fadeUp } from '../components/ui.jsx';
import StartDialog from '../components/StartDialog.jsx';
import ImprovementPanel from '../components/ImprovementPanel.jsx';
import { fmtDate, cx } from '../lib/util.js';

export default function Dashboard() {
  const [dlg, setDlg] = useState(null);
  const s = store.settings(), target = s.targetLevel || 10;
  const hist = store.history(), st = store.streak(), av = skillAverages();
  const daily = useMemo(() => dailyItems(), [hist.length]);
  const wts = weakTypes().slice(0, 6);
  const lv = hist.filter(a => a.levels && Object.values(a.levels).some(v => v != null)).slice(-16);
  const series = ['L', 'R', 'W', 'S'].map(c => ({ name: SKILL[c], color: SKILL_META[c].color, pts: lv.map(a => a.levels[c] == null ? null : { v: a.levels[c], label: `${levelLabel(a.levels[c], c)} · ${fmtDate(a.date)}` }) }));
  const testsDone = new Set(hist.flatMap(a => a.tests || [])).size;
  const hour = new Date().getHours(); const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* HERO */}
      <motion.section variants={fadeUp} className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-600/30 via-ink-800/60 to-cyan-600/20 p-7 md:p-10">
        <motion.div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 8 }} />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Badge tone="brand" className="mb-4"><LuSparkles /> {bank.builtIn().length} full original mock tests · strict AI scoring</Badge>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight md:text-5xl">{greet}{s.name ? `, ${s.name}` : ''}.<br /><span className="text-gradient">Train for CLB {target}+</span> under real exam conditions.</h1>
            <p className="mt-4 max-w-xl text-slate-300">Exact CELPIP-General structure and timing, audio that plays once, no going back, and no answers until you submit. After the test you get the full answer key and strict scoring on the official performance standards.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" icon={LuZap} onClick={() => startPractice(dailyPlan(daily))}>Today’s 30-min workout</Button>
              <Button size="lg" variant="secondary" icon={LuPlay} onClick={() => setDlg({ mode: 'full' })}>Full mock test</Button>
            </div>
            {!ai.available() && <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"><LuBrain /> Add a free Gemini or Groq key in <a href="#/settings" className="font-bold underline">Settings</a> for strict AI scoring of Writing & Speaking.</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['L', 'R', 'W', 'S'].map((c, i) => { const M = SKILL_META[c]; const v = av[c]; return (
              <motion.div key={c} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 + i * 0.08 }} className="glass flex flex-col items-center p-4">
                <Ring value={v} color={M.color} label={v == null ? '–' : levelLabel(v, c)} sub="level" target={target} size={88} />
                <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold"><M.icon className={M.text} />{M.name}</div>
                <div className="text-[11px] text-slate-400">{v == null ? 'not yet tested' : v >= target ? 'on target ✓' : `${(target - v).toFixed(1)} to go`}</div>
              </motion.div>); })}
          </div>
        </div>
      </motion.section>

      {/* KPIs */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4"><div className="rounded-2xl bg-orange-500/15 p-3 text-2xl text-orange-300"><LuFlame /></div><div><div className="text-xs text-slate-400">Daily streak</div><div className="text-2xl font-extrabold"><AnimatedNumber value={st.current} /> <span className="text-sm font-medium text-slate-400">days</span></div><div className="text-xs text-slate-500">{st.doneToday ? 'Practised today ✓' : 'Practise today to keep it'} · best {st.best}</div></div></Card>
        <Card className="flex items-center gap-4"><div className="rounded-2xl bg-brand-500/15 p-3 text-2xl text-brand-300"><LuGraduationCap /></div><div><div className="text-xs text-slate-400">Attempts</div><div className="text-2xl font-extrabold"><AnimatedNumber value={hist.length} /></div><div className="text-xs text-slate-500">{testsDone} of {bank.all().length} tests used</div></div></Card>
        <Card className="flex items-center gap-4"><div className="rounded-2xl bg-emerald-500/15 p-3 text-2xl text-emerald-300"><LuTarget /></div><div><div className="text-xs text-slate-400">Target</div><div className="text-2xl font-extrabold">CLB {target}</div><div className="text-xs text-slate-500"><a href="#/settings" className="hover:text-slate-300">change in Settings</a></div></div></Card>
        <Card className="p-4"><div className="mb-2 text-xs text-slate-400">Last 4 weeks</div><div className="grid grid-cols-14 gap-1" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>{st.cal.map((d, i) => <motion.div key={d.key} title={d.key} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.012 }} className={cx('aspect-square rounded-[4px]', d.on ? 'bg-gradient-to-br from-orange-400 to-rose-500' : 'bg-white/[0.07]')} />)}</div></Card>
      </div>

      {/* WHERE TO IMPROVE */}
      <ImprovementPanel />

      {/* PRACTICE */}
      <motion.h2 variants={fadeUp} className="mb-4 text-xl font-extrabold">Practise</motion.h2>
      <div className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card hover className="relative overflow-hidden lg:col-span-2" onClick={() => startPractice(dailyPlan(daily))}>
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="relative">
            <div className="mb-2 flex items-center gap-2 text-brand-300"><LuZap /><span className="text-xs font-bold uppercase tracking-wider">Adaptive daily workout</span></div>
            <h3 className="text-lg font-bold">30 minutes on your weakest areas</h3>
            <p className="mt-1 text-sm text-slate-400">{daily.reason}{daily.wt ? ` · most-missed: ${typeName(daily.wt.type)}` : ''}</p>
            <div className="mt-3 flex flex-wrap gap-2">{daily.items.map((i, k) => <Badge key={k} className={cx(SKILL_META[i.c].bg, SKILL_META[i.c].text)}>{SKILL_META[i.c].name} {partWord(i.c)} {i.n}</Badge>)}</div>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white">Start now <LuArrowRight /></div>
          </div>
        </Card>
        {['L', 'R', 'W', 'S'].map(c => { const M = SKILL_META[c]; return (
          <Card key={c} hover onClick={() => setDlg({ mode: 'component', comp: c })} className="group">
            <div className={cx('mb-3 inline-flex rounded-2xl p-3 text-2xl bg-gradient-to-br text-white shadow-lg', M.grad)}><M.icon /></div>
            <h3 className="font-bold">{M.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{{ L: '6 parts · 38 questions · audio plays once', R: '4 parts · 38 questions · 43–56 min', W: '2 tasks · 53 min · no spellcheck', S: '8 tasks · auto-recorded · ≈15 min' }[c]}</p>
            <div className="mt-3 flex gap-2 text-xs"><button onClick={e => { e.stopPropagation(); setDlg({ mode: 'part', comp: c }); }} className="rounded-lg bg-white/10 px-2.5 py-1 font-semibold hover:bg-white/20">Drill a part</button></div>
          </Card>); })}
        <Card hover onClick={() => go('library')} className="flex flex-col justify-between"><div><div className="mb-3 inline-flex rounded-2xl bg-gradient-to-br from-fuchsia-500 to-brand-500 p-3 text-2xl text-white shadow-lg"><LuTrophy /></div><h3 className="font-bold">Test library</h3><p className="mt-1 text-sm text-slate-400">Browse all {bank.all().length} tests and track which ones you’ve done.</p></div><div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">Open <LuArrowRight /></div></Card>
      </div>

      {/* PROGRESS */}
      <div className="mb-10 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Estimated level over time</h3><Badge tone="amber">approximate</Badge></div>
          {lv.length ? <LineChart series={series} ymin={2} ymax={12} ticks={[4, 6, 8, 10, 12]} target={target} /> : <Empty text="Finish any test or drill to see your progress chart." />}
        </Card>
        <Card>
          <h3 className="mb-3 font-bold">Question types you miss most</h3>
          {wts.length ? <div className="space-y-3">{wts.map(w => <BarRow key={w.comp + w.type} label={`${SKILL[w.comp]} · ${typeName(w.type)}`} value={w.acc} right={`${w.ok}/${w.tot}`} />)}</div> : <Empty text="Answer at least 3 questions of a type to see it here." />}
        </Card>
      </div>

      <motion.div variants={fadeUp} className="mb-3 flex items-center justify-between"><h2 className="text-xl font-extrabold">Recent attempts</h2><a href="#/history" className="text-sm font-semibold text-brand-300 hover:text-white">See all →</a></motion.div>
      <Card className="p-0">{hist.length ? hist.slice(-5).reverse().map(a => (
        <a key={a.id} href={'#/report/' + a.id} className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-3.5 last:border-0 hover:bg-white/5">
          <div className="min-w-0"><div className="truncate font-semibold">{a.title}</div><div className="text-xs text-slate-400">{fmtDate(a.date)} · {a.durationMin} min</div></div>
          <div className="flex shrink-0 gap-1.5">{['L', 'R', 'W', 'S'].map(c => a.levels && a.levels[c] != null && <span key={c} className={cx('rounded-lg px-2 py-1 text-xs font-bold', SKILL_META[c].bg, SKILL_META[c].text)}>{c} {levelLabel(a.levels[c], c)}</span>)}</div>
        </a>)) : <div className="p-5"><Empty text="No attempts yet – start with today’s workout or a full mock test." /></div>}
      </Card>

      <motion.div variants={fadeUp} className="mt-10 grid gap-4 md:grid-cols-3">
        {[[LuShieldCheck, 'Exam-faithful', 'Same parts, question counts, timers, one-play audio and one-way navigation as the computer-delivered test.'], [LuBrain, 'Strict AI rater', 'Writing and Speaking scored on Content/Coherence, Vocabulary, Readability or Listenability, and Task Fulfillment, with quoted evidence and corrections.'], [LuTarget, 'Hard on purpose', 'Paraphrased answers, plan changes, tone-based inference and “not given” traps, so test day feels easier.']].map(([I, t, d]) => (
          <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><I className="mb-2 text-2xl text-brand-300" /><div className="font-bold">{t}</div><p className="mt-1 text-sm text-slate-400">{d}</p></div>))}
      </motion.div>
      <StartDialog open={!!dlg} onClose={() => setDlg(null)} initialMode={dlg && dlg.mode} initialComp={dlg && dlg.comp} key={dlg ? dlg.mode + dlg.comp : 'x'} />
    </motion.div>
  );
}
const Empty = ({ text }) => <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">{text}</div>;
