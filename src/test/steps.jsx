import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuVolume2, LuMic, LuTriangleAlert, LuCircleCheck } from 'react-icons/lu';
import * as audio from '../lib/audio.js';
import * as recorder from '../lib/recorder.js';
import * as store from '../lib/store.js';
import { renderScene, listeningScene } from '../lib/scenes.js';
import { L_PARTS, R_PARTS, W_TASKS, S_TASKS, qid, partQuestions } from '../lib/bankShape.js';
import { wordCount, fmtClock, cx, FAST, sleep } from '../lib/util.js';

const Svg = ({ html, className }) => <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
const paras = t => String(t || '').split(/\n\s*\n|\n/).filter(x => x.trim()).map((p, i) => <p key={i} className="mb-3 last:mb-0">{p}</p>);
const Practice = () => <span className="mb-3 inline-block rounded-full border border-slate-300 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600">Practice – not scored</span>;
const Box = ({ children, className }) => <div className={cx('rounded-[4px] border border-[#d5d9e0] bg-[#fafbfc] px-6 py-5', className)}>{children}</div>;

/* ---------------- Instruction screens ---------------- */
function InfoStep({ step, ctx }) {
  useEffect(() => { ctx.setNext({ label: step.nextLabel || 'NEXT' }); }, []);
  return <div className="max-w-3xl text-[15.5px] leading-relaxed">{step.body}</div>;
}

function ListeningIntro({ ctx }) {
  const [v, setV] = useState(null);
  useEffect(() => { ctx.setNext(); audio.ready.then(x => setV(x.length)); }, []);
  return (
    <div className="max-w-3xl text-[15.5px] leading-relaxed">
      <h2 className="mb-3 text-2xl font-bold">Listening Test</h2>
      <Box>
        <p>The Listening Test has one practice task and six scored parts, about 46–55 minutes in total, with 38 scored questions.</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6">
          <li>You will hear each recording <b>only once</b>. There is no pause or replay.</li>
          <li>The questions appear <b>after</b> the recording ends. Choose the best answer to each question.</li>
          <li>Each part has its own timer for answering. When time runs out, you move on automatically.</li>
          <li>Once you leave a part, you <b>cannot go back</b> to it. No feedback is given until the whole test is submitted.</li>
          <li>Use headphones and set a comfortable volume now. You may take notes on paper.</li>
        </ul>
      </Box>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={audio.testVoice} className="inline-flex items-center gap-2 rounded-[3px] border border-[#8c96a3] bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"><LuVolume2 /> Test my audio</button>
        <span className="text-sm text-slate-500">{v == null ? 'Checking voices…' : v ? `${v} English voice(s) available on this computer.` : 'No speech voices found – recordings will be shown as timed text. Use Chrome or Edge for audio.'}</span>
      </div>
    </div>
  );
}

/* ---------------- Listening part ---------------- */
const SECS_PER_Q = 40;
function ListeningPart({ step, ctx }) {
  const part = step.part, scored = !step.practice;
  const nq = part.sections.reduce((k, s) => k + s.qs.length, 0);
  const [st, set] = useReducer((s, a) => ({ ...s, ...a }), { phase: 'audio', si: 0, k: 0, gi: 0, prog: 0, shown: [] });
  const [, force] = useState(0);
  const timer = useRef(null);
  const store_ = scored ? ctx.session.answers : ctx.session.practice;
  useEffect(() => {
    if (scored) ctx.session.scoredParts.push({ comp: 'L', testId: step.testId, n: part.n });
    timer.current = ctx.timer(nq * SECS_PER_Q + (scored ? 0 : 30));
  }, []);
  useEffect(() => {
    if (st.phase !== 'audio') return;
    ctx.hideNext(); timer.current.pause(); ctx.clearTime();
    let cancelled = false;
    (async () => {
      await audio.ready;
      const sec = part.sections[st.si];
      const ok = (audio.available() || FAST)
        ? await audio.play(sec.lines, part.sp, { onProgress: p => !cancelled && set({ prog: p }) })
        : await audio.playAsText(sec.lines, i => !cancelled && set({ shown: sec.lines.slice(0, i + 1) }), { onProgress: p => !cancelled && set({ prog: p }) });
      if (cancelled || !ok || !ctx.alive()) return;
      await sleep(FAST ? 10 : 700);
      if (!cancelled && ctx.alive()) set({ phase: 'q', k: 0, shown: [], prog: 0 });
    })();
    return () => { cancelled = true; };
  }, [st.phase, st.si]);
  useEffect(() => {
    if (st.phase !== 'q') return;
    timer.current.resume();
    ctx.setNext({
      onClick: () => {
        const sec = part.sections[st.si];
        if (st.k + 1 < sec.qs.length) set({ k: st.k + 1, gi: st.gi + 1 });
        else if (st.si + 1 < part.sections.length) set({ phase: 'audio', si: st.si + 1, gi: st.gi + 1 });
        else { timer.current.stop(); ctx.next(); }
      }
    });
  }, [st.phase, st.si, st.k]);

  if (st.phase === 'audio') {
    const scene = part.n === 0 ? listeningScene(2, part.sp) : listeningScene(part.n, part.sp);
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
        {part.sections.length > 1 && <div className="text-sm font-semibold text-slate-500">Section {st.si + 1} of {part.sections.length}</div>}
        <div className="w-full overflow-hidden rounded border border-[#d5d9e0] shadow-sm"><Svg html={scene} /></div>
        <div className="flex w-full items-center gap-3">
          <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="text-2xl text-exam-blue"><LuVolume2 /></motion.span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#e3e7ec]"><div className="h-full bg-exam-blue transition-[width] duration-300" style={{ width: `${st.prog * 100}%` }} /></div>
        </div>
        <div className="text-sm text-slate-500">Playing… The recording will play only once.</div>
        {st.shown.length > 0 && <div className="w-full rounded border border-dashed border-amber-400 bg-amber-50 p-4 text-[15px]"><div className="mb-2 text-xs font-semibold text-amber-800">No speech voices found on this computer – shown as text at speaking pace (it disappears before the questions).</div>{st.shown.map((l, i) => <div key={i} className="mb-1"><b>{(part.sp[l[0]] || {}).name || l[0]}:</b> {l[1]}</div>)}</div>}
      </div>
    );
  }
  const q = part.sections[st.si].qs[st.k];
  const id = scored ? qid(step.testId, 'L', part.n, st.gi) : 'practice.L';
  const sel = store_[id];
  return (
    <div className="max-w-3xl">
      {!scored && <Practice />}
      <div className="mb-1 text-sm text-slate-500">Question {st.gi + 1} of {nq}</div>
      <div className="mb-4 text-[18px] font-semibold">{q.q}</div>
      <div className="flex flex-col gap-2.5">
        {q.o.map((o, i) => (
          <label key={i} className={cx('exam-opt', sel === i && 'sel')}>
            <input type="radio" name={id} checked={sel === i} onChange={() => { store_[id] = i; force(x => x + 1); }} className="mt-1 accent-exam-blue" />
            <span className="text-[16px]">{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Reading ---------------- */
function ReadingIntro({ ctx }) {
  useEffect(() => { ctx.setNext(); }, []);
  return (
    <div className="max-w-3xl text-[15.5px] leading-relaxed">
      <h2 className="mb-3 text-2xl font-bold">Reading Test</h2>
      <Box><p>The Reading Test has one practice task and four scored parts, about 43–56 minutes in total, with 38 scored questions.</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6"><li>The reading text is on the left and the questions are on the right; each side scrolls separately.</li><li>Choose answers with the round buttons or the drop-down menus.</li><li>Each part has its own timer. When you press NEXT or time runs out, you move on and <b>cannot return</b>.</li><li>Unanswered questions are marked wrong, so answer every question.</li></ul></Box>
    </div>
  );
}
function Mcq({ q, id, num, store_ }) {
  const [, f] = useState(0); const sel = store_[id];
  return (
    <div className="mb-5">
      <div className="mb-2 text-[15px] font-bold">{num}. {q.q}</div>
      <div className="flex flex-col gap-1.5">{q.o.map((o, i) => <label key={i} className={cx('exam-opt !py-1.5 text-[15px]', sel === i && 'sel')}><input type="radio" name={id} checked={sel === i} onChange={() => { store_[id] = i; f(x => x + 1); }} className="mt-1 accent-exam-blue" /><span>{o}</span></label>)}</div>
    </div>
  );
}
function BlankText({ text, blanks, idFor, store_ }) {
  const [, f] = useState(0);
  const parts = String(text).split(/(\{\d\})/g);
  return (
    <div className="blank-text text-[15.5px]">
      {parts.map((p, i) => {
        const m = p.match(/^\{(\d)\}$/);
        if (m) { const bi = +m[1] - 1, b = blanks[bi], id = idFor(bi); return <select key={i} className="exam-select" aria-label={`Blank ${bi + 1}`} value={store_[id] ?? ''} onChange={e => { if (e.target.value === '') delete store_[id]; else store_[id] = +e.target.value; f(x => x + 1); }}><option value="">{bi + 1}. Select…</option>{b.o.map((o, k) => <option key={k} value={k}>{o}</option>)}</select>; }
        return <React.Fragment key={i}>{p.split('\n').map((line, j, arr) => <React.Fragment key={j}>{line}{j < arr.length - 1 && <br />}</React.Fragment>)}</React.Fragment>;
      })}
    </div>
  );
}
export function Diagram({ d }) {
  return (
    <div className="diagram text-[15px]">
      <h3 className="mb-1 text-lg font-bold">{d.title}</h3>
      {d.intro && <p className="mb-2">{d.intro}</p>}
      {d.table && <table><thead><tr>{d.table.cols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{d.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>}
      {(d.cards || []).map((c, i) => <div key={i} className="my-2 rounded border border-[#d5d9e0] bg-white px-3 py-2"><div className="font-bold">{c.h}</div>{c.lines.map((l, j) => <div key={j}>{l}</div>)}</div>)}
      {d.notes && <ul className="mt-2 list-disc space-y-1 pl-5">{d.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </div>
  );
}
export function ReadingPassage({ part, n }) {
  if (n === 1 || n === 0) return <div className="text-[15.5px] leading-relaxed">{part.meta && <div className="mb-3 border-b border-[#d5d9e0] pb-2 text-sm text-slate-500">{part.meta}</div>}{paras(part.text)}</div>;
  if (n === 2) return <Diagram d={part.diagram} />;
  if (n === 3) return <div className="text-[15.5px] leading-relaxed"><h3 className="mb-3 text-lg font-bold">{part.title}</h3>{part.paras.map((p, i) => <p key={i} className="mb-3"><b className="mr-1.5">{'ABCD'[i]}.</b>{p}</p>)}</div>;
  if (n === 4) return <div className="text-[15.5px] leading-relaxed"><h3 className="mb-1 text-lg font-bold">{part.title}</h3>{part.byline && <div className="mb-3 border-b border-[#d5d9e0] pb-2 text-sm text-slate-500">{part.byline}</div>}{paras(part.text)}</div>;
  return null;
}
function ReadingPart({ step, ctx }) {
  const part = step.part, n = step.n, scored = !step.practice;
  const store_ = scored ? ctx.session.answers : ctx.session.practice;
  const idFor = i => scored ? qid(step.testId, 'R', n, i) : 'practice.R.' + i;
  const [, f] = useState(0);
  useEffect(() => {
    if (scored) ctx.session.scoredParts.push({ comp: 'R', testId: step.testId, n });
    ctx.timer(scored ? R_PARTS[n].mins * 60 : 180).start();
    ctx.setNext({ confirm: 'You still have time left. Once you move on, you cannot return to this part.' });
  }, []);
  const sep = t => <div className="mb-3 mt-6 border-t border-[#d5d9e0] pt-4 text-[15px] font-bold">{t}</div>;
  const hint = t => <div className="mb-4 text-sm text-slate-500">{t}</div>;
  let right;
  if (n === 0) right = <>{hint('Read the note on the left and answer the question.')}<Mcq q={part.q} id={idFor(0)} num={1} store_={store_} /></>;
  else if (n === 1) right = <>{hint('Read the message on the left. Choose the best option to answer each question.')}{part.qs.map((q, i) => <Mcq key={i} q={q} id={idFor(i)} num={i + 1} store_={store_} />)}{sep(part.reply.intro || 'Here is a response to the message. Complete the response by choosing the best option for each blank.')}<BlankText text={part.reply.text} blanks={part.reply.blanks} idFor={i => idFor(6 + i)} store_={store_} /></>;
  else if (n === 2) right = <>{hint(part.email.intro || 'Read the following email. Complete it by choosing the best option for each blank.')}<BlankText text={part.email.text} blanks={part.email.blanks} idFor={i => idFor(i)} store_={store_} />{sep('Choose the best answer to each question.')}{part.qs.map((q, i) => <Mcq key={i} q={q} id={idFor(5 + i)} num={6 + i} store_={store_} />)}</>;
  else if (n === 3) right = <>{hint('Decide which paragraph, A to D, contains the information in each statement. Choose E if the information is not given in any of the paragraphs.')}{part.qs.map((q, i) => (
    <div key={i} className="mb-3 flex items-start gap-3"><select className="exam-select min-w-[150px]" value={store_[idFor(i)] ?? ''} onChange={e => { if (e.target.value === '') delete store_[idFor(i)]; else store_[idFor(i)] = +e.target.value; f(x => x + 1); }}><option value="">Select…</option>{['A', 'B', 'C', 'D', 'E'].map((L, j) => <option key={j} value={j}>{L}{L === 'E' ? ' – Not given' : ''}</option>)}</select><div className="text-[15px]">{i + 1}. {q.q}</div></div>))}</>;
  else right = <>{hint('Read the article on the left. Choose the best option for each question.')}{part.qs.map((q, i) => <Mcq key={i} q={q} id={idFor(i)} num={i + 1} store_={store_} />)}{sep(part.comment.intro || 'Here is a comment by a reader. Complete the comment by choosing the best option for each blank.')}<BlankText text={part.comment.text} blanks={part.comment.blanks} idFor={i => idFor(5 + i)} store_={store_} /></>;
  return (
    <div>
      {!scored && <Practice />}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="exam-pane scrollbar-thin bg-[#fcfcfd] p-5 lg:max-h-[calc(100vh-140px)]"><ReadingPassage part={part} n={n} /></div>
        <div className="exam-pane scrollbar-thin p-5 lg:max-h-[calc(100vh-140px)]">{right}</div>
      </div>
    </div>
  );
}

/* ---------------- Writing ---------------- */
function WritingIntro({ ctx }) {
  useEffect(() => { ctx.setNext(); }, []);
  return (
    <div className="max-w-3xl text-[15.5px] leading-relaxed">
      <h2 className="mb-3 text-2xl font-bold">Writing Test</h2>
      <Box><p>The Writing Test has two tasks and takes 53 minutes.</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6"><li><b>Task 1 – Writing an Email:</b> 27 minutes, about 150–200 words.</li><li><b>Task 2 – Responding to Survey Questions:</b> 26 minutes, about 150–200 words.</li><li>The editor has <b>no spellcheck and no autocorrect</b>. You can use Cut, Copy, Paste, Undo and Redo, and a word counter is shown.</li><li>Your response is saved automatically and submitted when time runs out. You cannot return to a task.</li></ul></Box>
    </div>
  );
}
export function WritingPrompt({ task, n }) {
  if (n === 1) return <div><p className="mb-3">{task.situation}</p><p className="mb-1">Write an email of about 150–200 words in which you:</p><ul className="list-disc space-y-1 pl-6">{task.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul></div>;
  if (n === 2) return <div><p className="mb-3">{task.intro}</p><p className="mb-2 font-bold">{task.question}</p><div className="mb-2 rounded border border-[#d5d9e0] bg-white p-3"><b>Option A:</b> {task.a}</div><div className="mb-3 rounded border border-[#d5d9e0] bg-white p-3"><b>Option B:</b> {task.b}</div><p>Choose the option that you prefer. Explain the reasons for your choice. Write about 150–200 words.</p></div>;
  return <p>{task.prompt}</p>;
}
function Editor({ onChange }) {
  const ta = useRef(null); const [wc, setWc] = useState(0);
  const h = useRef({ undo: [{ v: '', s: 0, e: 0 }], redo: [], clip: '', deb: null });
  const update = () => { const v = ta.current.value; setWc(wordCount(v)); onChange(v); };
  const snap = () => { if (!ta.current) return; const H = h.current, top = H.undo[H.undo.length - 1]; if (!top || top.v !== ta.current.value) { H.undo.push({ v: ta.current.value, s: ta.current.selectionStart, e: ta.current.selectionEnd }); if (H.undo.length > 300) H.undo.shift(); H.redo = []; } };
  const setVal = st => { ta.current.value = st.v; ta.current.setSelectionRange(st.s, st.e); update(); };
  const cmd = {
    undo() { clearTimeout(h.current.deb); snap(); const H = h.current; if (H.undo.length > 1) { H.redo.push(H.undo.pop()); setVal(H.undo[H.undo.length - 1]); } },
    redo() { const H = h.current; if (H.redo.length) { const st = H.redo.pop(); H.undo.push(st); setVal(st); } },
    copy() { const t = ta.current; h.current.clip = t.value.slice(t.selectionStart, t.selectionEnd); if (h.current.clip && navigator.clipboard) navigator.clipboard.writeText(h.current.clip).catch(() => { }); },
    cut() { cmd.copy(); if (!h.current.clip) return; const t = ta.current; t.setRangeText('', t.selectionStart, t.selectionEnd, 'end'); update(); snap(); },
    async paste() { let x = h.current.clip; try { const c = await navigator.clipboard.readText(); if (c) x = c; } catch (e) { } if (!x) return; const t = ta.current; t.focus(); t.setRangeText(x, t.selectionStart, t.selectionEnd, 'end'); update(); snap(); }
  };
  useEffect(() => { setTimeout(() => ta.current && ta.current.focus(), 60); return () => clearTimeout(h.current.deb); }, []);
  const color = wc === 0 ? 'text-slate-500' : wc < 150 || wc > 200 ? 'text-amber-700' : 'text-emerald-700';
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border border-b-0 border-[#d5d9e0] bg-[#f4f5f7] p-1.5">
        {['cut', 'copy', 'paste', 'undo', 'redo'].map(c => <button key={c} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { cmd[c](); ta.current.focus(); }} className="rounded-[2px] border border-[#cfd6df] bg-white px-3 py-1 text-sm capitalize hover:bg-slate-50">{c}</button>)}
        <span className={cx('ml-auto pr-2 text-sm', color)}>Word count: <b>{wc}</b></span>
      </div>
      <textarea ref={ta} spellCheck={false} autoCorrect="off" autoCapitalize="off" autoComplete="off" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" aria-label="Your response"
        className="editor block min-h-[460px] w-full resize-y border border-[#d5d9e0] p-3.5 text-[16px] leading-relaxed outline-none focus:border-exam-blue"
        onInput={() => { update(); clearTimeout(h.current.deb); h.current.deb = setTimeout(snap, 350); }}
        onKeyDown={e => { const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase(); if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); cmd.undo(); } else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); cmd.redo(); } }} />
    </div>
  );
}
function WritingTask({ step, ctx }) {
  const n = step.n, scored = !step.practice, task = step.task;
  const rec = useRef({ text: '', choice: null, startedAt: Date.now() }).current;
  const [choice, setChoice] = useState(null);
  useEffect(() => {
    if (scored) { ctx.session.writing[`${step.testId}.W${n}`] = rec; ctx.session.scoredParts.push({ comp: 'W', testId: step.testId, n }); }
    ctx.timer(scored ? W_TASKS[n].mins * 60 : 180).start();
    const fin = () => { rec.secondsUsed = Math.round((Date.now() - rec.startedAt) / 1000); };
    ctx.onTimeUp(fin);
    ctx.setNext({ confirm: 'You still have time left. Your response will be submitted and you cannot return to this task.', onClick: () => { fin(); ctx.next(); } });
  }, []);
  return (
    <div>
      {!scored && <Practice />}
      <div className="grid gap-5 lg:grid-cols-[minmax(280px,38%)_1fr]">
        <div>
          <div className="rounded-[4px] border border-[#d5d9e0] bg-[#fcfcfd] p-5 text-[15.5px] leading-relaxed"><WritingPrompt task={task} n={scored ? n : 0} /></div>
          {n === 2 && scored && <div className="mt-3 flex gap-5 text-[15px]">{['A', 'B'].map(o => <label key={o} className="flex cursor-pointer items-center gap-2"><input type="radio" name="wch" checked={choice === o} onChange={() => { rec.choice = o; setChoice(o); }} className="accent-exam-blue" /> I choose Option {o}</label>)}</div>}
        </div>
        <Editor onChange={v => { rec.text = v; rec.words = wordCount(v); }} />
      </div>
    </div>
  );
}

/* ---------------- Speaking ---------------- */
function SpeakingIntro({ ctx }) {
  const [st, setSt] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { ctx.setNext({ disabled: true }); if (FAST) recorder.init().then(s => { setSt(s); ctx.enableNext(true); }); }, []);
  const go = async () => { setBusy(true); const s = await recorder.init(); setSt(s); setBusy(false); ctx.enableNext(true); };
  return (
    <div className="max-w-3xl text-[15.5px] leading-relaxed">
      <h2 className="mb-3 text-2xl font-bold">Speaking Test</h2>
      <Box><p>The Speaking Test has one practice task and eight scored tasks, about 15 minutes in total.</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-6"><li>For each task you will see the prompt and get <b>preparation time</b>. When it ends, <b>recording starts automatically</b>.</li><li>The recording bar shows how much speaking time is left. When it ends, the test moves on automatically.</li><li>Speak clearly at a normal volume. Your recordings stay on this computer so you can replay them in your report.</li></ul></Box>
      <div className={cx('mt-4 rounded border p-4 text-[15px]', !st ? 'border-blue-200 bg-blue-50' : st.mic ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50')}>
        {!st && <>Press <b>Start microphone</b> and allow access before you begin.</>}
        {st && st.mic && <span className="flex items-center gap-2"><LuCircleCheck className="text-emerald-600" /><b>Microphone ready.</b> {st.stt === 'webspeech' ? 'Speech-to-text: browser speech recognition (needs internet).' : 'Speech-to-text is not available in this browser – you can type what you said in your report.'}</span>}
        {st && !st.mic && <span className="flex items-start gap-2"><LuTriangleAlert className="mt-1 text-amber-600" /><span><b>{st.error}</b><br />You can still practise with the timers, but nothing will be recorded.</span></span>}
      </div>
      <button onClick={go} disabled={busy || (st && st.mic)} className="mt-4 inline-flex items-center gap-2 rounded-[3px] bg-exam-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"><LuMic /> {busy ? 'Requesting…' : 'Start microphone'}</button>
    </div>
  );
}
export function SpeakingPrompt({ task, n, content, choice, onChoose }) {
  const scene = (n === 3 || n === 4) ? content.S.t3.scene : n === 8 ? task.scene : null;
  return (
    <div>
      {scene && <div className="mx-auto mb-4 max-w-[640px] overflow-hidden rounded border border-[#d5d9e0]"><Svg html={renderScene(scene)} /></div>}
      {n === 5 ? (choice == null ? (
        <>
          <div className="mb-3 rounded border border-[#d5d9e0] bg-[#fcfcfd] p-4 text-[16.5px]">{task.intro}<div className="mt-2 font-bold">Choose one option by clicking on it.</div></div>
          <div className="grid gap-3 md:grid-cols-2">{task.options.map((o, i) => <motion.button key={i} whileHover={onChoose ? { y: -2 } : undefined} onClick={() => onChoose && onChoose(i)} className="option-card rounded border-2 border-[#d5d9e0] bg-white p-4 text-left hover:border-exam-blue" data-i={i}><div className="mb-1.5 font-bold">{o.title}</div><ul className="list-disc pl-5 text-[15px]">{o.details.map((d, j) => <li key={j}>{d}</li>)}</ul></motion.button>)}</div>
        </>) : (
        <>
          <div className="mb-3 rounded border border-[#d5d9e0] bg-[#fcfcfd] p-4 text-[16.5px]">{task.persuade}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border-2 border-exam-blue bg-[#eef4ff] p-4"><div className="text-xs text-slate-500">Your choice</div><div className="mb-1.5 font-bold">{task.options[choice].title}</div><ul className="list-disc pl-5 text-[15px]">{task.options[choice].details.map((d, j) => <li key={j}>{d}</li>)}</ul></div>
            <div className="rounded border-2 border-dashed border-[#c5ccd6] bg-white p-4"><div className="text-xs text-slate-500">{task.otherWho || 'Their preference'}</div><div className="mb-1.5 font-bold">{task.other.title}</div><ul className="list-disc pl-5 text-[15px]">{task.other.details.map((d, j) => <li key={j}>{d}</li>)}</ul></div>
          </div>
        </>)) : n === 6 ? (
        <div className="rounded border border-[#d5d9e0] bg-[#fcfcfd] p-4 text-[16.5px]">{task.situation}<div className="mt-3 font-bold">Choose ONE of the following:</div><ul className="mt-1 list-disc pl-6">{task.options.map((o, i) => <li key={i}>{o}</li>)}</ul>{task.note && <div className="mt-2">{task.note}</div>}</div>
      ) : <div className="rounded border border-[#d5d9e0] bg-[#fcfcfd] p-4 text-[16.5px]">{task.prompt}</div>}
    </div>
  );
}
function PhaseBar({ phase, left, frac }) {
  const rec = phase === 'rec';
  return (
    <div className={cx('mt-4 flex items-center gap-4 rounded border p-3.5', rec ? 'border-rose-300 bg-rose-50' : 'border-[#d5d9e0] bg-white')}>
      <div className="flex min-w-[170px] items-center gap-2 font-bold">{rec && <motion.span className="inline-block h-3 w-3 rounded-full bg-rose-600" animate={{ opacity: [1, 0.25, 1] }} transition={{ repeat: Infinity, duration: 1 }} />}{phase === 'choose' ? 'Selection Time' : rec ? 'Recording…' : phase === 'save' ? 'Saving…' : 'Preparation Time'}</div>
      <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-[#e3e7ec]"><div className={cx('h-full transition-[width] duration-200', rec ? 'bg-rose-600' : 'bg-exam-blue')} style={{ width: `${frac * 100}%` }} /></div>
      <div className="min-w-[56px] text-right tabular-nums">{fmtClock(left)}</div>
    </div>
  );
}
function SpeakingTask({ step, ctx }) {
  const n = step.n, scored = !step.practice, task = step.task;
  const cfg = scored ? S_TASKS[n] : { prep: 30, speak: 60 };
  const [phase, setPhase] = useState(n === 5 ? 'choose' : 'prep');
  const [bar, setBar] = useState({ left: 0, frac: 0 });
  const [choice, setChoice] = useState(null);
  const key = scored ? `${step.testId}.S${n}` : 'practice.S';
  const rec = useRef({ n, transcript: '', metrics: null, audioKey: ctx.session.id + '.' + key, choice: null }).current;
  const resolver = useRef(null);
  useEffect(() => {
    if (scored) { ctx.session.speaking[key] = rec; ctx.session.scoredParts.push({ comp: 'S', testId: step.testId, n }); }
    const run = (secs) => new Promise(res => {
      resolver.current = res;
      const t = ctx.timer(secs, () => res()); const orig = t.onTick;
      t.onTick = (s, tm) => { orig(s, tm); setBar({ left: s, frac: tm.fraction() }); };
      t.start(); resolver.current.timer = t;
    });
    (async () => {
      if (n === 5) { setPhase('choose'); await run(cfg.choose); if (!ctx.alive()) return; ctx.hideNext(); if (rec.choice == null) { rec.choice = Math.random() < 0.5 ? 0 : 1; setChoice(rec.choice); } }
      setPhase('prep'); await run(cfg.prep); if (!ctx.alive()) return;
      recorder.start(); setPhase('rec'); await run(cfg.speak);
      if (!ctx.alive()) { recorder.abort(); return; }
      setPhase('save'); ctx.clearTime();
      const out = await recorder.stop();
      rec.transcript = out.transcript; rec.metrics = out.metrics;
      if (out.blob && scored) { await store.saveAudio(rec.audioKey, out.blob); rec.hasAudio = true; }
      if (ctx.alive()) ctx.next();
    })();
  }, []);
  const choose = i => {
    if (phase !== 'choose') return;
    rec.choice = i; setChoice(i);
    ctx.setNext({ onClick: () => { const r = resolver.current; if (r) { r.timer && r.timer.stop(); r(); } } });
  };
  return (
    <div className="mx-auto max-w-4xl">
      {!scored && <Practice />}
      <SpeakingPrompt task={task} n={scored ? n : 0} content={step.content} choice={phase === 'choose' ? null : choice} onChoose={choose} />
      {phase === 'choose' && choice != null && <div className="mt-2 text-sm text-slate-600">You chose <b>{task.options[choice].title}</b>. Press NEXT to continue, or wait for the timer.</div>}
      <PhaseBar phase={phase} left={bar.left} frac={bar.frac} />
    </div>
  );
}

export const STEP_COMPONENTS = {
  info: InfoStep, 'L-intro': ListeningIntro, 'L-part': ListeningPart, 'R-intro': ReadingIntro, 'R-part': ReadingPart,
  'W-intro': WritingIntro, 'W-task': WritingTask, 'S-intro': SpeakingIntro, 'S-task': SpeakingTask
};
