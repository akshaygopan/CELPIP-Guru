// Free AI grading via a free-tier Google Gemini or Groq key (pasted in Settings, stored only in this browser).
// Rubric prompts follow the published CELPIP-General Performance Standards (four dimensions per skill,
// with the official factors) and ask for strict, evidence-based scores in structured JSON.
import * as store from './store.js';
import { S_TASKS, W_TASKS } from './bankShape.js';
import { clamp, avg, sleep, wordCount } from './util.js';

export class AIError extends Error { constructor(msg, code, retryAfter) { super(msg); this.code = code; this.retryAfter = retryAfter; } }

export function provider() {
  const s = store.settings();
  const ok = { gemini: !!s.geminiKey, groq: !!s.groqKey };
  if (s.provider === 'offline') return 'offline';
  if (s.provider !== 'auto' && ok[s.provider]) return s.provider;
  return ok.gemini ? 'gemini' : ok.groq ? 'groq' : 'offline';
}
export const providerLabel = p => ({ gemini: 'Google Gemini (free tier)', groq: 'Groq (free tier)', offline: 'Offline estimate (no AI)' }[p || provider()]);
export const available = () => provider() !== 'offline';

function parseJSON(text) {
  let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch (e) { }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { } }
  throw new AIError('The AI reply was not valid JSON.', 'bad_json');
}

async function callGemini(system, user, s) {
  const model = (s.geminiModel || 'gemini-flash-latest').trim();
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.geminiKey.trim() }, referrerPolicy: 'strict-origin', credentials: 'omit', cache: 'no-store',
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 16384 } })
    });
  } catch (e) { throw new AIError('Could not reach Gemini – check your internet connection.', 'network'); }
  if (r.status === 429) throw new AIError('Gemini free-tier rate limit reached.', 'rate');
  if (r.status === 404) throw new AIError(`Gemini model “${model}” was not found – change it in Settings.`, 'auth');
  if ([400, 401, 403].includes(r.status)) { const t = await r.text(); throw new AIError('Gemini rejected the request (check the key and model in Settings). ' + t.slice(0, 160), 'auth'); }
  if (!r.ok) throw new AIError('Gemini error ' + r.status, 'server');
  const d = await r.json();
  const text = d.candidates && d.candidates[0] && d.candidates[0].content && (d.candidates[0].content.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
  if (!text) throw new AIError('Gemini returned an empty answer.', 'server');
  return parseJSON(text);
}
async function callGroq(system, user, s) {
  const model = (s.groqModel || 'openai/gpt-oss-120b').trim();
  const body = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.2, max_completion_tokens: 6000, response_format: { type: 'json_object' } };
  if (/gpt-oss/.test(model)) body.reasoning_effort = 'medium';
  let r;
  try { r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.groqKey.trim() }, referrerPolicy: 'strict-origin', credentials: 'omit', cache: 'no-store', body: JSON.stringify(body) }); }
  catch (e) { throw new AIError('Could not reach Groq – check your internet connection.', 'network'); }
  if (r.status === 429) throw new AIError('Groq free-tier rate limit reached.', 'rate', +r.headers.get('retry-after') || 0);
  if (r.status === 401 || r.status === 403) throw new AIError('Groq rejected the API key – check it in Settings.', 'auth');
  if (r.status === 400 || r.status === 404) { const t = await r.text(); throw new AIError('Groq request error (check the model name): ' + t.slice(0, 160), 'auth'); }
  if (!r.ok) throw new AIError('Groq error ' + r.status, 'server');
  const d = await r.json();
  return parseJSON(d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content);
}

let lastCall = 0;
export async function ask(system, user, { onStatus, tries = 4, validate } = {}) {
  const p = provider(), s = store.settings();
  if (p === 'offline') throw new AIError('No AI provider is set up.', 'none');
  const gap = p === 'gemini' ? 6500 : 2500;
  for (let attempt = 1; ; attempt++) {
    const wait = lastCall + gap - Date.now(); if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      const out = p === 'gemini' ? await callGemini(system, user, s) : await callGroq(system, user, s);
      if (validate) validate(out);
      return out;
    } catch (e) {
      const code = e.code || 'other';
      if (code === 'auth' || code === 'none' || attempt >= tries) throw e;
      const delay = code === 'rate' ? Math.max((e.retryAfter || 0) * 1000, 15000 * attempt) : code === 'bad_json' ? 1500 : 4000 * attempt;
      onStatus && onStatus(`${e.message} Retrying in ${Math.round(delay / 1000)} s…`);
      await sleep(delay);
    }
  }
}

/* ---------------- Official-standard rubric prompts ---------------- */
const LEVELS = `Official CELPIP level descriptors (use whole numbers; "M" = 2 or below), with rating guidance:
• 12 Expert proficiency in high-stakes social, educational, or workplace contexts – virtually flawless, sophisticated and precise.
• 11 Advanced proficiency in high-stakes social, educational, or workplace contexts – highly effective, only rare minor slips.
• 10 Highly effective proficiency in some high-stakes social, educational, or workplace contexts – fully developed; a few minor errors that never affect meaning.
• 9 Effective proficiency in some high-stakes social, educational, or workplace contexts – clear, well organised, good range; occasional imprecision or errors.
• 8 Good proficiency in more demanding social, educational, or workplace contexts – generally clear; development or range somewhat limited; noticeable but non-impeding errors.
• 7 Adequate proficiency in somewhat demanding social, educational, or workplace contexts – adequate but uneven development; mostly common vocabulary; frequent errors, meaning still clear.
• 6 Developing proficiency in everyday social, educational, or workplace contexts – limited development and range; errors sometimes obscure meaning.
• 5 Acquiring proficiency in everyday social, educational, or workplace contexts – basic ideas; simple vocabulary; frequent errors that often obscure meaning.
• 4 Adequate proficiency for daily life activities – very limited, simple sentences.
• 3 Some proficiency in limited contexts – fragments and memorised phrases.
• M (2 or below): limited ability in contexts related to immediate needs, or insufficient information to assess.`;

const STRICT = `Score like a trained, certified CELPIP rater: strict, conservative and evidence-based. Rate each dimension independently, using only what the response shows.
Do not inflate: most competent non-native responses fall between 6 and 9; award 10 only when the response is effective and well developed with very few errors, and 11–12 only when it is exceptional.
Hard caps (apply them):
• A required part of the task (a bullet point, a clear choice, a comparison, the person addressed) is missing → Task Fulfillment at most 7; two parts missing → at most 5.
• Off-topic or memorised generic content → Task Fulfillment and Content/Coherence at most 4.
• Repeated basic grammar errors (verb tense, articles, subject–verb agreement) → Readability/Listenability at most 7.`;

const W_SYS = `You are a certified rater for the CELPIP-General Writing Test. You give an UNOFFICIAL practice estimate using the official CELPIP Writing Performance Standards. The four dimensions and their official factors are:
1. Content/Coherence – number of ideas; quality of ideas; organization of ideas; examples and supporting details. (How well are the ideas organized and supported?)
2. Vocabulary – word choice; suitable use of words and phrases; range of words and phrases; precision and accuracy.
3. Readability – format and paragraphing; connectors and transitions; grammar and sentence structure; spelling and punctuation. (How easy is it to read and understand the response?)
4. Task Fulfillment – relevance; completeness (every bullet point / a clear choice of ONE option with reasons); tone (appropriate register for the reader and purpose); word count (150–200 words; under 150 is penalised, extra length is not rewarded).
${LEVELS}
${STRICT}
Evidence must be quoted EXACTLY from the response. In "corrections", "original" is an exact substring of the response (a phrase or one sentence) and "corrected" is the fix; list every grammar, spelling, punctuation, word-choice or tone error (max 25), most serious first.
Write a model answer for the SAME prompt at Level 12, 175–200 words, natural Canadian English, paragraphs separated by \\n\\n.
Return ONLY JSON:
{"dimensions":{"content_coherence":{"level":0,"evidence":["…"],"comment":"…"},"vocabulary":{"level":0,"evidence":["…"],"comment":"…"},"readability":{"level":0,"evidence":["…"],"comment":"…"},"task_fulfillment":{"level":0,"evidence":["…"],"comment":"…"}},"overall_level":0,"strengths":["…"],"corrections":[{"original":"…","corrected":"…","reason":"…"}],"top_fixes":["…","…","…"],"model_answer":"…"}`;

const S_SYS = `You are a certified rater for the CELPIP-General Speaking Test. You give an UNOFFICIAL practice estimate using the official CELPIP Speaking Performance Standards. The four dimensions and their official factors are:
1. Content/Coherence – number of ideas; quality of ideas; organization of ideas; examples and supporting details.
2. Vocabulary – word choice; suitable use of words and phrases; range of words and phrases; precision and accuracy.
3. Listenability – rhythm, pronunciation and intonation; pauses, interjections and self-correction; grammar and sentence structure; variety of sentence structure. (How easy is it to listen to and understand the response?)
4. Task Fulfillment – relevance; completeness; tone (appropriate for the listener and situation); length (use of the speaking time).
${LEVELS}
${STRICT}
The transcript comes from automatic speech recognition: it lacks punctuation, often drops fillers such as “um”, and may mis-hear words – do not penalise punctuation and give the benefit of the doubt for obvious mis-recognitions. Judge Listenability from the transcript PLUS the measures provided (words per minute, filler count, long pauses, delay before starting, unused time). Around 120–160 wpm with few long pauses is fluent; under 90 wpm, many long pauses or a late start indicates hesitancy. Using less than 75% of the speaking time caps Task Fulfillment at 7.
In "corrections", "original" is an exact substring of the transcript.
Model answer: Level 12, spoken Canadian English, about 2.2 words per second of speaking time.
Return ONLY JSON:
{"dimensions":{"content_coherence":{"level":0,"evidence":["…"],"comment":"…"},"vocabulary":{"level":0,"evidence":["…"],"comment":"…"},"listenability":{"level":0,"evidence":["…"],"comment":"…"},"task_fulfillment":{"level":0,"evidence":["…"],"comment":"…"}},"overall_level":0,"strengths":["…"],"corrections":[{"original":"…","corrected":"…","reason":"…"}],"top_fixes":["…","…","…"],"useful_phrases":["…"],"model_answer":"…"}`;

const SHORT = { content_coherence: 'content', vocabulary: 'vocabulary', readability: 'readability', listenability: 'listenability', task_fulfillment: 'task' };
function normalize(r, keys) {
  const D = r && r.dimensions;
  if (!D || keys.some(k => !D[k] || !(+D[k].level >= 1))) throw new AIError('The AI reply was missing rubric scores.', 'bad_json');
  const out = { ai: true, dims: {}, evidence: {}, comments: {}, provider: provider() };
  keys.forEach(k => { const s = SHORT[k]; out.dims[s] = clamp(Math.round(+D[k].level), 1, 12); out.evidence[s] = (D[k].evidence || []).slice(0, 4); out.comments[s] = D[k].comment || ''; });
  // Official practice: the task score combines the four dimension ratings – we average them (no rounding up).
  out.overall = Math.floor(avg(Object.values(out.dims)) + 0.25);
  out.corrections = (r.corrections || []).filter(c => c && c.original && c.corrected).slice(0, 25);
  out.top_fixes = (r.top_fixes || []).slice(0, 3); out.strengths = (r.strengths || []).slice(0, 4);
  out.model_answer = r.model_answer || ''; out.useful_phrases = (r.useful_phrases || []).slice(0, 10);
  return out;
}

export function writingPromptText(task, n) {
  if (n === 1) return `${task.situation}\nWrite an email of about 150–200 words in which you:\n- ${task.bullets.join('\n- ')}`;
  return `${task.intro}\n${task.question}\nOption A: ${task.a}\nOption B: ${task.b}\nChoose the option you prefer and explain why. Write about 150–200 words.`;
}
export async function gradeWriting(task, n, rec, opts) {
  const user = `TASK ${n} – ${W_TASKS[n].name} (${W_TASKS[n].mins} minutes)\n${writingPromptText(task, n)}\n${n === 2 && rec.choice ? `The candidate selected Option ${rec.choice}.\n` : ''}\nCANDIDATE RESPONSE (${wordCount(rec.text)} words):\n"""\n${rec.text || '(no response)'}\n"""`;
  const keys = ['content_coherence', 'vocabulary', 'readability', 'task_fulfillment'];
  return normalize(await ask(W_SYS, user, Object.assign({}, opts, { validate: r => normalize(r, keys) })), keys);
}

export function speakingPromptText(task, n, content, rec) {
  const T = S_TASKS[n];
  if (n === 5) { const mine = task.options[rec.choice ?? 0]; return `${task.intro}\nCandidate chose: ${mine.title} (${mine.details.join('; ')}). The other person prefers: ${task.other.title} (${task.other.details.join('; ')}). ${task.persuade}`; }
  if (n === 6) return `${task.situation}\nOptions (choose ONE): ${task.options.join(' OR ')}`;
  let p = task.prompt;
  if (n === 3 || n === 4) p += `\nThe picture shows: ${content.S.t3.scene.alt}`;
  if (n === 8) p += `\nThe picture shows: ${task.scene.alt}`;
  return `${p}\n(Preparation ${T.prep} s, speaking ${T.speak} s)`;
}
export async function gradeSpeaking(task, n, rec, content, opts) {
  const T = S_TASKS[n], m = rec.metrics || {};
  const user = `TASK ${n}: ${T.name}. Speaking time ${T.speak} s.\nPROMPT:\n${speakingPromptText(task, n, content, rec)}\n\nMEASURES: recorded ${m.durationSec || T.speak} s; ${m.words || wordCount(rec.transcript)} words; ${m.wpm || '?'} words per minute; fillers counted ${m.fillers || 0} (${(m.fillerList || []).join(', ') || 'none'}); long pauses (≥2 s) ${m.longPauses ?? 'not measured'}; short pauses ${m.shortPauses ?? 'not measured'}; seconds before starting ${m.startDelaySec ?? '?'}; unused seconds at end ${m.endedEarlySec ?? '?'}${m.edited ? '; transcript was typed/edited by the candidate' : ''}.\n\nTRANSCRIPT:\n"""\n${rec.transcript || '(empty)'}\n"""`;
  const keys = ['content_coherence', 'vocabulary', 'listenability', 'task_fulfillment'];
  return normalize(await ask(S_SYS, user, Object.assign({}, opts, { validate: r => normalize(r, keys) })), keys);
}

export async function explainWrong(comp, content, n, items, opts) {
  let source;
  if (comp === 'L') { const part = content.L.parts.find(p => p.n === n); source = part.sections.map((s, i) => `[Section ${i + 1}]\n` + s.lines.map(l => `${(part.sp[l[0]] || {}).name || l[0]}: ${l[1]}`).join('\n')).join('\n\n'); }
  else { const p = content.R['p' + n]; source = n === 2 ? JSON.stringify(p.diagram) + '\n\nEMAIL:\n' + p.email.text : n === 3 ? p.paras.map((x, i) => 'ABCD'[i] + '. ' + x).join('\n') : p.text + '\n\n' + ((p.reply || p.comment || {}).text || ''); }
  const qs = items.map(it => ({ id: it.id, question: it.q, options: it.o, correct: it.o[it.a], candidate_answer: it.your == null ? '(no answer)' : it.o[it.your], evidence: it.ev }));
  const sys = 'You are an expert CELPIP tutor. For each question the candidate got wrong, explain concretely, quoting the source. Return ONLY JSON: {"items":[{"id":"…","why_correct":"…","why_candidate_wrong":"…","options":[{"option":"…","why_wrong":"…"}],"strategy_tip":"…"}]} – "options" covers every incorrect option.';
  const r = await ask(sys, `${comp === 'L' ? 'LISTENING TRANSCRIPT' : 'READING TEXT'} (Part ${n}):\n${source}\n\nQUESTIONS ANSWERED INCORRECTLY:\n${JSON.stringify(qs, null, 1)}`, opts);
  return r.items || [];
}

export async function plan(summary, opts) {
  const target = store.settings().targetLevel || 10;
  const sys = `You are a certified CELPIP instructor. Create a realistic, personalised 7-day plan (35–50 minutes a day) for a learner aiming for CELPIP Level ${target}+ in all four skills, prioritising the biggest gaps against the official performance standards. Return ONLY JSON: {"weaknesses":[{"title":"…","why":"…","fix":"…"}],"plan":[{"day":1,"focus":"…","minutes":40,"tasks":["…"]}]} with exactly 3 weaknesses and 7 days. Tasks must be concrete and use the app (e.g. "Reading Part 3 drill, then write the missing detail for every E-trap you fell for").`;
  return ask(sys, 'LEARNER RESULTS:\n' + JSON.stringify(summary, null, 1), opts);
}

export async function generatePart(comp, n, example, hint, opts) {
  const sys = `You write ORIGINAL practice material for the CELPIP-General test at Levels 9–12 difficulty: paraphrased correct answers, tempting distractors that reuse words from the text in the wrong relationship, plan changes, attitudes inferred from tone, and "not given" traps. Canadian everyday settings, no real brand names. Every "ev" must be an EXACT substring of the transcript/passage proving the answer. "a" is the 0-based index of the correct option; spread correct answers across positions and keep all options similar in length. Return ONLY JSON with exactly the same structure as the example. ${hint}`;
  const user = `Create a NEW, completely different ${comp === 'L' ? 'Listening Part ' + n : comp === 'R' ? 'Reading Part ' + n : comp === 'W' ? 'Writing set' : 'Speaking set'} on a different topic. Example of the exact JSON structure (do NOT copy its content):\n${JSON.stringify(example)}`;
  return ask(sys, user, opts);
}
