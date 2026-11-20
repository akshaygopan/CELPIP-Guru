import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuWandSparkles, LuTrash2, LuCircleCheck, LuTriangleAlert } from 'react-icons/lu';
import * as store from '../lib/store.js';
import * as bank from '../lib/bank.js';
import * as ai from '../lib/ai.js';
import { PART_LIST, partName, SKILL } from '../lib/bankShape.js';
import { validateTestPart, HINTS } from '../lib/genValidate.js';
import { PageHeader, Card, Button, Badge, Spinner, SKILL_META, stagger, confirmDialog } from '../components/ui.jsx';
import { uid, cx } from '../lib/util.js';

export default function Generator() {
  const [comp, setComp] = useState('L'); const [n, setN] = useState(1);
  const [log, setLog] = useState([]); const [busy, setBusy] = useState(false); const [, refresh] = useState(0);
  const add = (msg, tone) => setLog(l => [...l, { msg, tone, id: Math.random() }]);
  const customs = store.customTests();

  async function genOne(t, c, k) {
    const ex = await bank.fullExample('t01');
    const example = c === 'L' ? ex.L.parts.find(p => p.n === k) : c === 'R' ? ex.R['p' + k] : c === 'W' ? ex.W : ex.S;
    for (let attempt = 1; attempt <= 2; attempt++) {
      add(`Generating ${SKILL[c]} ${c === 'L' || c === 'R' ? 'Part ' + k : 'tasks'}${attempt > 1 ? ' (retry)' : ''}…`, 'run');
      try {
        const p = await ai.generatePart(c, k, example, HINTS(c, k), { onStatus: m => add(m) });
        const errs = validateTestPart(c, k, p);
        if (errs.length) { add('Rejected by the validator: ' + errs.slice(0, 3).join('; '), 'warn'); continue; }
        if (c === 'L') { t.L = t.L || { parts: [] }; p.n = k; t.L.parts = t.L.parts.filter(x => x.n !== k).concat([p]); }
        if (c === 'R') { t.R = t.R || {}; t.R['p' + k] = p; }
        if (c === 'W') t.W = { t1: p.t1, t2: p.t2 };
        if (c === 'S') { t.S = {}; for (let i = 1; i <= 8; i++) t.S['t' + i] = p['t' + i]; }
        store.saveCustomTest(t); add('Saved.', 'ok'); return true;
      } catch (e) { add(e.message, 'warn'); if (e.code === 'auth') return false; }
    }
    return false;
  }
  const one = async () => { setBusy(true); setLog([]); const t = { id: 'c' + uid(), title: `AI ${SKILL[comp]}${comp === 'L' || comp === 'R' ? ' Part ' + n : ''} – ${new Date().toLocaleDateString()}`, custom: true }; await genOne(t, comp, n); setBusy(false); refresh(x => x + 1); };
  const full = async () => {
    setBusy(true); setLog([]);
    const t = { id: 'c' + uid(), title: `AI Test ${customs.filter(x => /^AI Test/.test(x.title)).length + 1}`, custom: true };
    for (const k of PART_LIST.L) await genOne(t, 'L', k);
    for (const k of PART_LIST.R) await genOne(t, 'R', k);
    await genOne(t, 'W', 0); await genOne(t, 'S', 0);
    add(bank.customComplete(t) ? 'Full test ready – find it in the Test library.' : 'Some parts failed; the ones that succeeded are saved and can be used as drills.', bank.customComplete(t) ? 'ok' : 'warn');
    setBusy(false); refresh(x => x + 1);
  };
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-5xl">
      <PageHeader eyebrow="Never run out" title="AI test generator" />
      <p className="mb-6 max-w-3xl text-sm text-slate-400">The library has {bank.builtIn().length} complete, hand-checked tests. With a free AI key you can generate more. Every generated part is checked automatically (question counts, answer keys, evidence quotes) before it is saved to this browser.</p>
      {!ai.available() && <Card className="mb-5 border-amber-400/20 bg-amber-500/10"><p className="text-sm text-amber-200">Add a free Gemini or Groq key in <a className="font-bold underline" href="#/settings">Settings</a> first.</p></Card>}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-bold">Generate one part</h3>
          <div className="mb-3 grid grid-cols-4 gap-2">{['L', 'R', 'W', 'S'].map(c => { const M = SKILL_META[c]; return <button key={c} onClick={() => { setComp(c); setN(1); }} className={cx('rounded-xl border p-2 text-sm font-semibold', comp === c ? `${M.bg} border-white/25` : 'border-white/10 bg-white/5')}><M.icon className={cx('mx-auto mb-1', M.text)} />{M.name}</button>; })}</div>
          {(comp === 'L' || comp === 'R') && <select value={n} onChange={e => setN(+e.target.value)} className="mb-3 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm">{PART_LIST[comp].map(k => <option key={k} value={k}>Part {k}: {partName(comp, k)}</option>)}</select>}
          <Button icon={LuWandSparkles} onClick={one} disabled={busy || !ai.available()}>Generate</Button>
        </Card>
        <Card>
          <h3 className="mb-1 font-bold">Generate a full test</h3>
          <p className="mb-3 text-sm text-slate-400">12 AI requests: 6 Listening parts, 4 Reading parts, the Writing pair and the Speaking set. This takes a few minutes on free tiers.</p>
          <Button icon={LuWandSparkles} onClick={full} disabled={busy || !ai.available()}>Generate full test</Button>
        </Card>
      </div>
      <AnimatePresence>{log.length > 0 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass mb-6 space-y-1.5 p-4 text-sm">
          {log.map((l, i) => <motion.div key={l.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={cx('flex items-center gap-2', l.tone === 'ok' ? 'text-emerald-300' : l.tone === 'warn' ? 'text-amber-300' : 'text-slate-300')}>{l.tone === 'run' && i === log.length - 1 && busy ? <Spinner /> : l.tone === 'ok' ? <LuCircleCheck /> : l.tone === 'warn' ? <LuTriangleAlert /> : <span className="w-4" />}{l.msg}</motion.div>)}
        </motion.div>)}
      </AnimatePresence>
      <h2 className="mb-3 text-lg font-bold">Your generated material</h2>
      {customs.length ? <div className="space-y-2">{customs.map(t => (
        <Card key={t.id} className="flex items-center justify-between py-3">
          <div><div className="font-semibold">{t.title}</div><div className="mt-1 flex flex-wrap gap-1">{['L', 'R', 'W', 'S'].flatMap(c => PART_LIST[c].filter(k => bank.hasPart(t, c, k)).map(k => <Badge key={c + k} className={cx(SKILL_META[c].bg, SKILL_META[c].text)}>{c}{k}</Badge>))}</div></div>
          <button onClick={async () => { if (await confirmDialog({ title: 'Delete this material?', body: t.title, ok: 'Delete', tone: 'danger' })) { store.deleteCustomTest(t.id); refresh(x => x + 1); } }} className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"><LuTrash2 /></button>
        </Card>))}</div> : <p className="text-sm text-slate-400">None yet.</p>}
    </motion.div>
  );
}
