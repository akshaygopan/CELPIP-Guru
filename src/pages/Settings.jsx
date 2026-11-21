import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LuKeyRound, LuVolume2, LuDownload, LuUpload, LuTrash2, LuCircleCheck, LuCircleX, LuShieldCheck, LuEraser } from 'react-icons/lu';
import * as store from '../lib/store.js';
import * as ai from '../lib/ai.js';
import * as audio from '../lib/audio.js';
import { PageHeader, Card, Button, Badge, Spinner, stagger, toast, confirmDialog } from '../components/ui.jsx';
import { download, todayKey, cx } from '../lib/util.js';

const Field = ({ label, hint, children }) => <label className="block"><div className="mb-1 text-sm font-semibold">{label}</div>{children}{hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}</label>;
const input = 'w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm outline-none focus:border-brand-400';

export default function Settings() {
  const [s, setS] = useState(store.settings());
  const [test, setTest] = useState(null);
  const up = p => setS(Object.assign({}, s, p));
  const save = () => { store.saveSettings(s); toast('Settings saved'); };
  const check = async () => {
    store.saveSettings(s); setTest({ busy: true });
    try { const r = await ai.ask('Reply with JSON only.', 'Return {"ok":true}', { tries: 1 }); setTest({ ok: !!(r && r.ok), msg: r && r.ok ? `Connected – ${ai.providerLabel()} is ready for strict grading.` : 'Connected, but the reply was unexpected.' }); }
    catch (e) { setTest({ ok: false, msg: e.message }); }
  };
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-4xl">
      <PageHeader eyebrow="Preferences" title="Settings" />
      <Card className="mb-5">
        <div className="mb-1 flex items-center gap-2"><LuKeyRound className="text-brand-300" /><h3 className="text-lg font-bold">Free AI grading</h3><Badge tone={ai.available() ? 'green' : 'amber'}>{ai.providerLabel()}</Badge></div>
        <p className="mb-5 text-sm text-slate-400">Listening and Reading are always scored from the answer key. AI scores Writing and Speaking strictly on the official four dimensions, explains wrong answers, builds your 7-day plan and generates new tests. Keys are stored only in this browser and never included in backups.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Provider"><select value={s.provider} onChange={e => up({ provider: e.target.value })} className={input}><option value="auto">Automatic (Gemini → Groq → offline)</option><option value="gemini">Google Gemini</option><option value="groq">Groq</option><option value="offline">Offline estimates only</option></select></Field>
          <div />
          <Field label="Google Gemini API key" hint={<>Free at aistudio.google.com → Get API key.</>}><input type="password" value={s.geminiKey} onChange={e => up({ geminiKey: e.target.value.trim() })} className={input} autoComplete="off" /></Field>
          <Field label="Gemini model" hint="If you hit free-tier limits, try a “flash-lite” model."><input value={s.geminiModel} onChange={e => up({ geminiModel: e.target.value })} className={input} /></Field>
          <Field label="Groq API key" hint="Free at console.groq.com → API Keys."><input type="password" value={s.groqKey} onChange={e => up({ groqKey: e.target.value.trim() })} className={input} autoComplete="off" /></Field>
          <Field label="Groq model"><input value={s.groqModel} onChange={e => up({ groqModel: e.target.value })} className={input} /></Field>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <input type="checkbox" checked={!!s.rememberKeys} onChange={e => up({ rememberKeys: e.target.checked })} className="mt-1 h-4 w-4 accent-brand-500" />
          <span className="text-sm"><b>Remember keys on this device</b><span className="block text-xs text-slate-400">Off = keys are kept only until you close this tab (safer on shared computers). On = kept in this browser’s storage until you press “Forget keys”.</span></span>
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={save}>Save</Button><Button variant="secondary" onClick={check}>Test connection</Button>
          <Button variant="ghost" icon={LuEraser} onClick={() => { store.forgetKeys(); setS(store.settings()); setTest(null); toast('Keys removed from this browser'); }}>Forget keys</Button>
          {test && (test.busy ? <span className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Testing…</span> : <span className={cx('flex items-center gap-1.5 text-sm', test.ok ? 'text-emerald-300' : 'text-rose-300')}>{test.ok ? <LuCircleCheck /> : <LuCircleX />}{test.msg}</span>)}
        </div>
        <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] p-4 text-sm text-slate-300">
          <div className="mb-1.5 flex items-center gap-2 font-bold text-emerald-200"><LuShieldCheck /> How your key is protected</div>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed">
            <li>Your key is <b>never</b> uploaded to GitHub or any server of this app. Other visitors cannot see it: each browser has its own private storage.</li>
            <li>It travels only from your browser straight to Google or Groq over HTTPS, in a request header (not in the URL), and is left out of backups.</li>
            <li>A strict Content-Security-Policy blocks scripts from other sites, and test content is sanitised before it is drawn.</li>
            <li><b>Best practice:</b> use a free key from a Google project with <b>no billing account</b>, so it can never cost money. In Google AI Studio → Google Cloud console → Credentials, restrict the key to the <i>Generative Language API</i> and to the website <code className="rounded bg-black/30 px-1">{location.host || 'your-site'}/*</code>.</li>
            <li>Only use your key on your own device, and press “Forget keys” on shared computers. If a key ever leaks, delete it in AI Studio or the Groq console and create a new one.</li>
          </ul>
        </div>
        <p className="mt-3 text-xs text-slate-500">A full mock test uses about 11 AI requests. If a free-tier limit is reached, the app waits and retries, then falls back to an offline estimate; you can re-grade later from the report.</p>
      </Card>
      <Card className="mb-5">
        <h3 className="mb-4 text-lg font-bold">Practice preferences</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Your first name (optional)"><input value={s.name} onChange={e => up({ name: e.target.value })} className={input} /></Field>
          <Field label="Target CELPIP level"><select value={s.targetLevel} onChange={e => up({ targetLevel: +e.target.value })} className={input}>{[7, 8, 9, 10, 11, 12].map(v => <option key={v} value={v}>CLB {v}</option>)}</select></Field>
          <Field label={`Listening voice speed: ${Number(s.voiceRate).toFixed(2)}×`} hint="Keep at 1.00 for realistic practice."><input type="range" min="0.85" max="1.15" step="0.05" value={s.voiceRate} onChange={e => up({ voiceRate: +e.target.value })} className="mt-3 w-full accent-brand-500" /></Field>
        </div>
        <div className="mt-5 flex gap-3"><Button onClick={save}>Save</Button><Button variant="secondary" icon={LuVolume2} onClick={() => { store.saveSettings(s); audio.testVoice(); }}>Test listening voice</Button></div>
      </Card>
      <Card>
        <h3 className="mb-1 text-lg font-bold">Your data</h3>
        <p className="mb-4 text-sm text-slate-400">Everything lives in this browser (scores in localStorage, recordings in IndexedDB). Export a backup regularly – clearing browser data erases it.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" icon={LuDownload} onClick={() => download(`celpip-guru-backup-${todayKey()}.json`, store.exportAll())}>Export backup</Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/15"><LuUpload /> Import backup<input type="file" accept="application/json" hidden onChange={e => { const f = e.target.files[0]; if (f) f.text().then(t => { try { store.importAll(t); toast('Backup imported'); setS(store.settings()); } catch (err) { toast(err.message, 'error'); } }); }} /></label>
          <Button variant="danger" icon={LuTrash2} onClick={async () => { if (await confirmDialog({ title: 'Delete all history?', body: 'This removes every attempt, your streak and charts. Settings and keys are kept.', ok: 'Delete everything', tone: 'danger' })) { store.clearHistory(); toast('History deleted'); } }}>Delete history</Button>
        </div>
      </Card>
    </motion.div>
  );
}
