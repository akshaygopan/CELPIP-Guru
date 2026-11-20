import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuPrinter, LuRefreshCw, LuCircleCheck, LuCircleX, LuChevronDown, LuSparkles, LuPlay, LuPencil, LuTriangleAlert, LuQuote, LuCalendarDays, LuLightbulb, LuArrowLeft, LuCircleMinus } from 'react-icons/lu';
import * as store from '../lib/store.js';
import * as ai from '../lib/ai.js';
import { loadTestsFor, summarize, evalWriting, evalSpeaking, makePlan, DIM_NAMES } from '../lib/evaluate.js';
import { collectLR, levelLabel, typeName } from '../lib/grading.js';
import { SKILL, S_TASKS, W_TASKS, L_PARTS, R_PARTS, partName } from '../lib/bankShape.js';
import { ReadingPassage, WritingPrompt, SpeakingPrompt } from '../test/steps.jsx';
import { Card, Button, Badge, Spinner, Ring, Tabs, BarRow, PageHeader, SKILL_META, stagger, fadeUp, toast } from '../components/ui.jsx';
import { fmtDate, highlightIn, wordCount, cx, round1 } from '../lib/util.js';

const keyOf = k => { const [tid, part] = k.split('.'); return { tid, comp: part[0], n: +part.slice(1) }; };
const LEVEL_TEXT = l => l == null ? '' : l >= 10 ? 'Advanced proficiency in workplace and community contexts' : l >= 9 ? 'Effective proficiency' : l >= 8 ? 'Good proficiency' : l >= 7 ? 'Adequate proficiency' : l >= 6 ? 'Developing proficiency' : l >= 5 ? 'Acquiring proficiency' : l >= 4 ? 'Adequate proficiency for daily life activities' : l >= 3 ? 'Some proficiency in limited contexts' : 'Minimal proficiency or insufficient information';

export default function Report({ id }) {
  const [att, setAtt] = useState(() => store.getAttempt(id));
  const [tests, setTests] = useState(null);
  const [tab, setTab] = useState('sum');
  const [printing, setPrinting] = useState(false);
  const [busy, setBusy] = useState('');
  useEffect(() => { setAtt(store.getAttempt(id)); setTests(null); if (store.getAttempt(id)) loadTestsFor(store.getAttempt(id)).then(setTests); }, [id]);
  const items = useMemo(() => tests && att ? collectLR(att.session, tests) : [], [tests, att]);
  if (!att) return <Card><p className="text-slate-300">This report was not found. It may have been deleted.</p><Button className="mt-4" variant="secondary" icon={LuArrowLeft} onClick={() => (location.hash = '#/history')}>History</Button></Card>;

  const persist = a => { const c = JSON.parse(JSON.stringify(a)); store.saveAttempt(c); setAtt(c); };
  const has = c => (c === 'L' || c === 'R') ? !!att[c] : !!att[c] || Object.keys(att.session[c === 'W' ? 'writing' : 'speaking'] || {}).length > 0;
  const tabs = [['sum', 'Summary'], ...['L', 'R', 'W', 'S'].filter(has).map(c => [c, SKILL[c]]), ['plan', '7-day plan']];
  const offlineKeys = Object.keys(att.evals || {}).filter(k => att.evals[k] && !att.evals[k].ai);

  const regrade = async keys => {
    if (!ai.available()) { toast('Add a Gemini or Groq key in Settings first.', 'error'); return; }
    const a = JSON.parse(JSON.stringify(att)); const T = tests || await loadTestsFor(a);
    for (const k of keys) {
      setBusy(`Grading ${k.includes('.W') ? 'Writing' : 'Speaking'} Task ${keyOf(k).n}…`);
      try { if (k.includes('.W')) await evalWriting(a, k, T, false, m => setBusy(m)); else await evalSpeaking(a, k, T, false, m => setBusy(m)); } catch (e) { toast(e.message, 'error'); }
    }
    summarize(a); setBusy('Updating your plan…'); await makePlan(a, false, m => setBusy(m)); summarize(a);
    persist(a); setBusy('');
    const failed = keys.filter(k => a.evals[k] && !a.evals[k].ai);
    toast(failed.length ? `${failed.length} task(s) could not be AI-graded – offline estimate kept.` : 'Re-graded with AI.', failed.length ? 'error' : 'ok');
  };
  const doPrint = () => { setPrinting(true); setTimeout(() => { window.print(); setTimeout(() => setPrinting(false), 400); }, 700); };

  const panel = (k, node) => <div key={k} className={printing ? 'print-panel mb-10' : ''}>{printing && <h2 className="mb-4 mt-2 text-2xl font-extrabold">{tabs.find(t => t[0] === k)[1]}</h2>}{node}</div>;
  const render = k => k === 'sum' ? <Summary att={att} /> : k === 'plan' ? <Plan att={att} /> : k === 'L' || k === 'R' ? (tests ? <LRPanel comp={k} att={att} items={items} tests={tests} persist={persist} printing={printing} /> : <Loading />) : k === 'W' ? (tests ? <WritingPanel att={att} tests={tests} regrade={regrade} busy={busy} /> : <Loading />) : (tests ? <SpeakingPanel att={att} tests={tests} regrade={regrade} busy={busy} persist={persist} /> : <Loading />);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <PageHeader eyebrow={`${{ full: 'Full mock test', component: 'Component test', part: 'Part drill', daily: 'Daily workout' }[att.mode] || 'Practice'} · ${fmtDate(att.date)} · ${att.durationMin} min`} title={att.title}>
        <div className="no-print flex flex-wrap gap-2">
          {offlineKeys.length > 0 && ai.available() && <Button variant="secondary" icon={LuSparkles} disabled={!!busy} onClick={() => regrade(offlineKeys)}>Re-grade {offlineKeys.length} with AI</Button>}
          <Button variant="secondary" icon={LuPrinter} onClick={doPrint}>Print / Save PDF</Button>
        </div>
      </PageHeader>
      <AnimatePresence>{busy && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="no-print glass mb-4 flex items-center gap-3 px-4 py-3 text-sm"><Spinner />{busy}</motion.div>}</AnimatePresence>
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs text-slate-400">Unofficial practice estimate. Listening and Reading use the published approximate raw-score charts (the lower level is used where ranges overlap). Writing and Speaking are rated on the four official performance-standard dimensions{att.W && att.W.offline || att.S && att.S.offline ? '; tasks marked “offline estimate” were not rated by AI and are less reliable' : ''}.</div>
      {printing ? tabs.map(([k]) => panel(k, render(k))) : (<>
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-6" />
        <AnimatePresence mode="wait"><motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>{render(tab)}</motion.div></AnimatePresence>
      </>)}
    </motion.div>
  );
}
const Loading = () => <div className="flex items-center gap-3 p-8 text-slate-400"><Spinner /> Loading the answer key…</div>;

/* ---------------- Summary ---------------- */
function Summary({ att }) {
  const target = store.settings().targetLevel || 10;
  const comps = ['L', 'R', 'W', 'S'].filter(c => att.levels && att.levels[c] != null);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['L', 'R', 'W', 'S'].map((c, i) => { const M = SKILL_META[c], v = att.levels && att.levels[c]; return (
          <motion.div key={c} variants={fadeUp} initial="hidden" animate="show" transition={{ delay: i * 0.07 }} className="glass print-keep flex flex-col items-center p-5 text-center">
            <Ring value={v} color={M.color} label={v == null ? '–' : levelLabel(v, c)} sub={v == null ? 'not tested' : 'CELPIP level'} target={target} size={104} />
            <div className="mt-3 flex items-center gap-1.5 font-bold"><M.icon className={M.text} />{M.name}</div>
            {(c === 'L' || c === 'R') && att[c] && <div className="text-sm text-slate-300">{att[c].raw} / {att[c].total} correct{!att[c].full && <span className="text-slate-500"> (≈{att[c].scaled}/38)</span>}</div>}
            {(c === 'W' || c === 'S') && att[c] && <div className="text-sm text-slate-300">{att[c].n} task{att[c].n > 1 ? 's' : ''} · {att[c].ai ? 'AI rated' : 'offline estimate'}</div>}
            <div className="mt-1 text-xs text-slate-500">{LEVEL_TEXT(v)}</div>
          </motion.div>); })}
      </div>
      {!comps.length && <Card><p className="text-slate-400">No scored responses in this attempt.</p></Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        {['L', 'R'].filter(c => att[c]).map(c => (
          <Card key={c} className="print-keep"><h3 className="mb-3 font-bold">{SKILL[c]} by part</h3><div className="space-y-2.5">{Object.entries(att[c].parts).map(([n, [ok, tot]]) => <BarRow key={n} label={`Part ${n} · ${partName(c, +n)}`} value={ok / tot} right={`${ok}/${tot}`} color={SKILL_META[c].color} />)}</div>
            <h4 className="mb-2 mt-5 text-sm font-bold text-slate-300">By question type</h4><div className="space-y-2">{Object.entries(att[c].types).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]).map(([t, [ok, tot]]) => <BarRow key={t} label={typeName(t)} value={ok / tot} right={`${ok}/${tot}`} />)}</div></Card>))}
        {['W', 'S'].filter(c => att[c] && Object.keys(att[c].dims || {}).length).map(c => (
          <Card key={c} className="print-keep"><h3 className="mb-3 font-bold">{SKILL[c]} – performance dimensions</h3><div className="space-y-2.5">{Object.entries(att[c].dims).map(([d, v]) => <BarRow key={d} label={DIM_NAMES[d]} value={v / 12} right={`≈ ${v}`} color={SKILL_META[c].color} />)}</div></Card>))}
      </div>
      {att.plan && att.plan.weaknesses && att.plan.weaknesses.length > 0 && <Card className="print-keep"><h3 className="mb-3 font-bold">Your three priorities</h3><Weak list={att.plan.weaknesses} /></Card>}
    </div>
  );
}
const Weak = ({ list }) => <div className="grid gap-3 md:grid-cols-3">{list.map((w, i) => <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><div className="mb-1 flex items-center gap-2 font-bold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-xs text-rose-300">{i + 1}</span>{w.title}</div><p className="text-sm text-slate-400">{w.why}</p><p className="mt-2 text-sm"><LuLightbulb className="mr-1 inline text-amber-300" />{w.fix}</p></div>)}</div>;

/* ---------------- Listening / Reading answer key ---------------- */
function LRPanel({ comp, att, items, tests, persist, printing }) {
  const parts = att.parts.filter(p => p.comp === comp);
  return <div className="space-y-5">{parts.map(p => <PartKey key={p.testId + p.n} comp={comp} p={p} att={att} items={items.filter(i => i.comp === comp && i.n === p.n && i.testId === p.testId)} content={tests[p.testId] && tests[p.testId].content} persist={persist} open={printing || parts.length === 1} />)}</div>;
}
function PartKey({ comp, p, att, items, content, persist, open: open0 }) {
  const [open, setOpen] = useState(open0); const [exp, setExp] = useState(false);
  useEffect(() => { if (open0) setOpen(true); }, [open0]);
  const ok = items.filter(i => i.correct).length, akey = `${p.testId}.${comp}${p.n}`;
  const wrong = items.filter(i => !i.correct);
  const explained = (att.aiExplain || {})[akey] || [];
  const explain = async () => {
    setExp(true);
    try { const r = await ai.explainWrong(comp, content, p.n, wrong, {}); const a = Object.assign({}, att, { aiExplain: Object.assign({}, att.aiExplain, { [akey]: r }) }); persist(a); }
    catch (e) { toast(e.message, 'error'); }
    setExp(false);
  };
  if (!content) return null;
  const M = SKILL_META[comp];
  return (
    <Card className="p-0">
      <button onClick={() => setOpen(!open)} className="no-print flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <div><div className="font-bold">{comp === 'L' ? 'Listening' : 'Reading'} Part {p.n}: {partName(comp, p.n)}</div><div className="text-xs text-slate-400">{att.tests.length > 1 ? `Test ${p.testId} · ` : ''}{ok}/{items.length} correct</div></div>
        <div className="flex items-center gap-3"><div className="hidden h-2 w-32 overflow-hidden rounded-full bg-white/10 sm:block"><motion.div className="h-full" style={{ background: M.color }} initial={{ width: 0 }} animate={{ width: `${(ok / items.length) * 100}%` }} /></div><motion.span animate={{ rotate: open ? 180 : 0 }}><LuChevronDown /></motion.span></div>
      </button>
      <div className={cx('hidden px-5 pt-4 font-bold print:block')}>{comp === 'L' ? 'Listening' : 'Reading'} Part {p.n}: {partName(comp, p.n)} – {ok}/{items.length}</div>
      <AnimatePresence initial={false}>{open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
          <div className="grid gap-5 border-t border-white/10 p-5 xl:grid-cols-[1fr_1.1fr]">
            <Source comp={comp} n={p.n} content={content} items={items} />
            <div className="space-y-3">
              {wrong.length > 0 && ai.available() && !explained.length && <Button size="sm" variant="secondary" icon={LuSparkles} disabled={exp} onClick={explain} className="no-print">{exp ? 'Asking the AI tutor…' : `Explain my ${wrong.length} mistake${wrong.length > 1 ? 's' : ''} with AI`}</Button>}
              {items.map((it, k) => <QItem key={it.id} it={it} num={k + 1} ex={explained.find(e => e.id === it.id)} />)}
            </div>
          </div>
        </motion.div>)}
      </AnimatePresence>
    </Card>
  );
}
function Source({ comp, n, content, items }) {
  const ref = useRef(null);
  useEffect(() => { if (!ref.current) return; items.forEach((it, k) => { if (it.ev) highlightIn(ref.current, it.ev, `Evidence for question ${k + 1}`); }); }, [items.length]);
  let body;
  if (comp === 'L') {
    const part = content.L.parts.find(x => x.n === n);
    body = <div className="space-y-4">{part.context && <p className="text-sm italic text-slate-500">{part.context}</p>}{part.sections.map((s, i) => <div key={i}>{part.sections.length > 1 && <div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Section {i + 1}{s.title ? ` – ${s.title}` : ''}</div>}{s.lines.map((l, j) => <p key={j} className="mb-1.5"><b className="mr-1">{(part.sp[l[0]] || {}).name || l[0]}:</b>{l[1]}</p>)}</div>)}</div>;
  } else {
    const part = content.R['p' + n];
    const extra = n === 1 ? part.reply : n === 2 ? part.email : n === 4 ? part.comment : null;
    body = <><ReadingPassage part={part} n={n} />{extra && <div className="mt-5 border-t border-[#d5d9e0] pt-4"><div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{n === 1 ? 'Response' : n === 2 ? 'Email' : 'Reader comment'} (blanks shown as numbers)</div><p className="whitespace-pre-line text-[15px] leading-relaxed">{extra.text.replace(/\{(\d)\}/g, (m, d) => `[${d}]`)}</p></div>}</>;
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400"><span>{comp === 'L' ? 'Transcript' : 'Text'}</span><span className="flex items-center gap-1 normal-case"><mark className="ev-mark">highlighted</mark> = evidence</span></div>
      <div ref={ref} className="exam scrollbar-thin rounded-2xl bg-white p-5 text-[15px] leading-relaxed text-slate-900 shadow-inner xl:max-h-[75vh] xl:overflow-auto print:max-h-none">{body}</div>
    </div>
  );
}
function QItem({ it, num, ex }) {
  const status = it.your == null ? 'skip' : it.correct ? 'ok' : 'bad';
  return (
    <div className={cx('print-keep rounded-2xl border p-4', status === 'ok' ? 'border-emerald-400/25 bg-emerald-500/[0.06]' : status === 'bad' ? 'border-rose-400/25 bg-rose-500/[0.06]' : 'border-amber-400/25 bg-amber-500/[0.06]')}>
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 shrink-0">{status === 'ok' ? <LuCircleCheck className="text-emerald-400" /> : status === 'bad' ? <LuCircleX className="text-rose-400" /> : <LuCircleMinus className="text-amber-400" />}</span>
        <div className="flex-1"><div className="text-sm font-semibold"><span className="text-slate-400">{num}.</span> {it.kind === 'blank' ? `Blank ${it.label || ''}` : it.q}</div><div className="mt-0.5"><Badge className="text-[10px]">{typeName(it.t)}</Badge></div></div>
      </div>
      <div className="space-y-1 pl-6 text-sm">
        {it.o.map((o, k) => <div key={k} className={cx('rounded-lg px-2.5 py-1', k === it.a ? 'bg-emerald-500/15 text-emerald-200' : k === it.your ? 'bg-rose-500/15 text-rose-200 line-through decoration-rose-400/60' : 'text-slate-400')}>{k === it.a ? '✓ ' : k === it.your ? '✗ ' : ''}{o}{k === it.your && k !== it.a ? ' (your answer)' : ''}</div>)}
        {it.your == null && <div className="text-xs text-amber-300">Not answered</div>}
        {it.ev && <div className="mt-2 flex gap-2 text-slate-300"><LuQuote className="mt-1 shrink-0 text-amber-300" /><span><span className="text-xs font-bold uppercase text-slate-500">Evidence: </span>“{it.ev}”</span></div>}
        {it.x && <div className="text-slate-300"><span className="text-xs font-bold uppercase text-slate-500">Why: </span>{it.x}</div>}
        {ex && <div className="mt-2 rounded-xl border border-brand-400/20 bg-brand-500/10 p-3 text-slate-200"><div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase text-brand-300"><LuSparkles /> AI tutor</div>{ex.why_candidate_wrong && <p className="mb-1">{ex.why_candidate_wrong}</p>}{(ex.options || []).map((o, k) => <p key={k} className="text-xs text-slate-400">• <b>{o.option}</b> – {o.why_wrong}</p>)}{ex.strategy_tip && <p className="mt-1.5 text-xs"><LuLightbulb className="mr-1 inline text-amber-300" />{ex.strategy_tip}</p>}</div>}
      </div>
    </div>
  );
}

/* ---------------- Writing ---------------- */
function withFixes(text, corrections) {
  if (!corrections || !corrections.length) return text;
  const lower = text, spans = [];
  corrections.forEach(c => { const i = lower.indexOf(c.original); if (i >= 0 && !spans.some(s => i < s.e && i + c.original.length > s.s)) spans.push({ s: i, e: i + c.original.length, c }); });
  spans.sort((a, b) => a.s - b.s); const out = []; let p = 0;
  spans.forEach((sp, k) => { out.push(text.slice(p, sp.s)); out.push(<span key={k} title={sp.c.reason}><del className="fix">{sp.c.original}</del> <ins className="fix">{sp.c.corrected}</ins></span>); p = sp.e; });
  out.push(text.slice(p)); return out;
}
function Dims({ ev, comp }) {
  if (!ev || !ev.dims) return <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-200">{(ev && ev.notes && ev.notes[0]) || 'Not enough to evaluate.'}</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(ev.dims).map(([d, v]) => (
        <div key={d} className="print-keep rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
          <div className="mb-1.5 flex items-center justify-between"><span className="text-sm font-bold">{DIM_NAMES[d]}</span><span className="rounded-lg px-2 py-0.5 text-sm font-extrabold" style={{ background: SKILL_META[comp].color + '26', color: SKILL_META[comp].color }}>{v}</span></div>
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: SKILL_META[comp].color }} initial={{ width: 0 }} animate={{ width: `${v / 12 * 100}%` }} transition={{ duration: 0.8 }} /></div>
          {ev.comments && ev.comments[d] && <p className="text-xs text-slate-300">{ev.comments[d]}</p>}
          {ev.evidence && (ev.evidence[d] || []).map((q, i) => <p key={i} className="mt-1 text-xs italic text-slate-400">“{q}”</p>)}
        </div>))}
    </div>
  );
}
function Feedback({ ev, comp }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-2xl px-4 py-2 text-center" style={{ background: SKILL_META[comp].color + '22' }}><div className="text-[10px] font-bold uppercase text-slate-300">Task level</div><div className="text-2xl font-extrabold">{ev && ev.overall != null ? levelLabel(ev.overall, comp) : '–'}</div></div>
        {ev && (ev.ai ? <Badge tone="brand"><LuSparkles /> Rated by {ai.providerLabel(ev.provider)}</Badge> : <Badge tone="amber"><LuTriangleAlert /> Offline estimate{ev.error ? ` – AI failed: ${ev.error}` : ''}</Badge>)}
      </div>
      <Dims ev={ev} comp={comp} />
      {ev && ev.strengths && ev.strengths.length > 0 && <div><h4 className="mb-1 text-sm font-bold text-emerald-300">Strengths</h4><ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-300">{ev.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
      {ev && ev.top_fixes && ev.top_fixes.length > 0 && <div><h4 className="mb-1 text-sm font-bold text-amber-300">Top fixes to move up a level</h4><ol className="list-decimal space-y-0.5 pl-5 text-sm text-slate-300">{ev.top_fixes.map((s, i) => <li key={i}>{s}</li>)}</ol></div>}
      {ev && ev.notes && ev.notes.length > 0 && <div><h4 className="mb-1 text-sm font-bold text-slate-300">Notes</h4><ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-400">{ev.notes.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
      {ev && ev.corrections && ev.corrections.length > 0 && <div><h4 className="mb-2 text-sm font-bold text-slate-300">Corrections ({ev.corrections.length})</h4><div className="space-y-1.5">{ev.corrections.map((c, i) => <div key={i} className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm"><del className="fix">{c.original}</del> → <ins className="fix">{c.corrected}</ins>{c.reason && <div className="mt-0.5 text-xs text-slate-400">{c.reason}</div>}</div>)}</div></div>}
      {ev && ev.useful_phrases && ev.useful_phrases.length > 0 && <div><h4 className="mb-1 text-sm font-bold text-slate-300">Useful phrases</h4><div className="flex flex-wrap gap-1.5">{ev.useful_phrases.map((p, i) => <Badge key={i}>{p}</Badge>)}</div></div>}
    </div>
  );
}
function Model({ text, label = 'Level 12 model answer' }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="print-keep rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06]">
      <button onClick={() => setOpen(!open)} className="no-print flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-emerald-200"><span>{label} ({wordCount(text)} words)</span><motion.span animate={{ rotate: open ? 180 : 0 }}><LuChevronDown /></motion.span></button>
      <div className={cx('px-4 pb-4 text-[15px] leading-relaxed text-slate-200 whitespace-pre-line', !open && 'hidden print:block')}>{text}</div>
    </div>
  );
}
function WritingPanel({ att, tests, regrade, busy }) {
  const keys = Object.keys(att.session.writing || {});
  return <div className="space-y-6">{keys.map(k => {
    const { tid, n } = keyOf(k); const T = tests[tid]; if (!T) return null; const task = T.content.W['t' + n]; const rec = att.session.writing[k]; const ev = att.evals[k];
    const wc = wordCount(rec.text);
    return (
      <Card key={k}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-extrabold">Writing Task {n}: {W_TASKS[n].name}</h3>{ai.available() && <Button size="sm" variant="ghost" icon={LuRefreshCw} disabled={!!busy} onClick={() => regrade([k])} className="no-print">Re-grade</Button>}</div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-4">
            <div className="exam rounded-2xl bg-white p-4 text-[15px] leading-relaxed text-slate-900"><WritingPrompt task={task} n={n} /></div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400"><span>Your response{n === 2 && rec.choice ? ` · Option ${rec.choice}` : ''}</span><span className={wc < 150 || wc > 200 ? 'text-amber-300' : 'text-emerald-300'}>{wc} words</span></div>
              <div className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-ink-900/70 p-4 text-[15px] leading-relaxed">{rec.text ? withFixes(rec.text, ev && ev.corrections) : <span className="text-slate-500">(no response)</span>}</div>
            </div>
            <Model text={(T.key.models || {})['W' + n]} />
            {ev && ev.model_answer && <Model text={ev.model_answer} label="AI model answer for this prompt" />}
          </div>
          <Feedback ev={ev} comp="W" />
        </div>
      </Card>);
  })}</div>;
}

/* ---------------- Speaking ---------------- */
function Player({ k }) {
  const [url, setUrl] = useState(null); const [none, setNone] = useState(false);
  useEffect(() => { let u; store.getAudio(k).then(b => { if (b) { u = URL.createObjectURL(b); setUrl(u); } else setNone(true); }).catch(() => setNone(true)); return () => u && URL.revokeObjectURL(u); }, [k]);
  if (none) return <div className="text-xs text-slate-500">No recording saved for this task.</div>;
  return url ? <audio controls src={url} className="no-print h-10 w-full" /> : <div className="text-xs text-slate-500"><Spinner /> </div>;
}
function SpeakingPanel({ att, tests, regrade, busy, persist }) {
  const keys = Object.keys(att.session.speaking || {}).sort((a, b) => keyOf(a).n - keyOf(b).n);
  const [edit, setEdit] = useState(null); const [draft, setDraft] = useState('');
  const saveTx = async k => {
    const a = JSON.parse(JSON.stringify(att)); const rec = a.session.speaking[k];
    rec.transcript = draft.trim(); rec.metrics = Object.assign({}, rec.metrics || {}, { words: wordCount(draft), edited: true });
    if (rec.metrics.durationSec) rec.metrics.wpm = Math.round(rec.metrics.words / (rec.metrics.durationSec / 60));
    persist(a); setEdit(null);
    if (ai.available()) setTimeout(() => regrade([k]), 50); else toast('Transcript saved. Add an AI key to re-grade it.');
  };
  return <div className="space-y-6">{keys.map(k => {
    const { tid, n } = keyOf(k); const T = tests[tid]; if (!T) return null; const task = T.content.S['t' + n]; const rec = att.session.speaking[k]; const ev = att.evals[k]; const m = rec.metrics || {};
    return (
      <Card key={k}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-extrabold">Speaking Task {n}: {S_TASKS[n].name}</h3><div className="flex gap-2 text-xs text-slate-400"><Badge>Prep {S_TASKS[n].prep} s</Badge><Badge>Speak {S_TASKS[n].speak} s</Badge></div></div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-4">
            <div className="exam rounded-2xl bg-white p-4 text-[15px] leading-relaxed text-slate-900"><SpeakingPrompt task={task} n={n} content={T.content} choice={n === 5 || n === 6 ? (rec.choice ?? null) : undefined} /></div>
            <Player k={rec.audioKey} />
            <div className="flex flex-wrap gap-1.5 text-xs">{m.durationSec != null && <Badge>{Math.round(m.durationSec)} s recorded</Badge>}{m.wpm ? <Badge tone={m.wpm >= 110 && m.wpm <= 170 ? 'green' : 'amber'}>{m.wpm} words/min</Badge> : null}{m.fillers != null && <Badge tone={m.fillers > 4 ? 'amber' : 'slate'}>{m.fillers} fillers</Badge>}{m.longPauses != null && <Badge tone={m.longPauses > 3 ? 'amber' : 'slate'}>{m.longPauses} long pauses</Badge>}{m.endedEarlySec > 0 && <Badge tone={m.endedEarlySec > 10 ? 'amber' : 'slate'}>{m.endedEarlySec} s unused</Badge>}{m.edited && <Badge tone="brand">transcript edited</Badge>}</div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400"><span>Transcript (speech recognition)</span>{edit !== k && <button className="no-print flex items-center gap-1 normal-case text-brand-300 hover:text-white" onClick={() => { setEdit(k); setDraft(rec.transcript || ''); }}><LuPencil /> Edit</button>}</div>
              {edit === k ? <div><textarea value={draft} onChange={e => setDraft(e.target.value)} rows={6} className="w-full rounded-2xl border border-brand-400/40 bg-ink-900 p-3 text-sm outline-none" placeholder="Type exactly what you said…" /><div className="mt-2 flex gap-2"><Button size="sm" onClick={() => saveTx(k)}>Save{ai.available() ? ' & re-grade' : ''}</Button><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div></div>
                : <div className="rounded-2xl border border-white/10 bg-ink-900/70 p-4 text-[15px] leading-relaxed">{rec.transcript ? withFixes(rec.transcript, ev && ev.corrections) : <span className="text-slate-500">No transcript was captured. Press Edit and type what you said to get it graded.</span>}</div>}
            </div>
            <Model text={(T.key.models || {})['S' + n]} label="Level 12 sample response" />
          </div>
          <div className="space-y-3">{ai.available() && <div className="no-print flex justify-end"><Button size="sm" variant="ghost" icon={LuRefreshCw} disabled={!!busy} onClick={() => regrade([k])}>Re-grade</Button></div>}<Feedback ev={ev} comp="S" /></div>
        </div>
      </Card>);
  })}</div>;
}

/* ---------------- Plan ---------------- */
function Plan({ att }) {
  const p = att.plan;
  if (!p) return <Card><p className="text-slate-400">No plan was generated.</p></Card>;
  return (
    <div className="space-y-6">
      {p.offline && <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">Built from your scores without AI. Add a key in Settings and re-grade for a personalised plan.</div>}
      {p.weaknesses && p.weaknesses.length > 0 && <Card><h3 className="mb-3 font-bold">Biggest gaps</h3><Weak list={p.weaknesses} /></Card>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {p.plan.map((d, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="glass print-keep p-4">
            <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-300"><LuCalendarDays /> Day {d.day || i + 1}</span><Badge>{d.minutes || 40} min</Badge></div>
            <div className="mb-2 font-bold">{d.focus}</div>
            <ul className="space-y-1.5 text-sm text-slate-300">{(d.tasks || []).map((t, j) => <li key={j} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />{t}</li>)}</ul>
          </motion.div>))}
      </div>
    </div>
  );
}
