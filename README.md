# CELPIP Guru

A free, browser-only practice platform for the **CELPIP-General** test. It reproduces the structure, timing, navigation and difficulty of the computer-delivered exam (aimed at CLB 9–12), then scores you strictly against the official performance standards once you have submitted.

> **Disclaimer:** CELPIP Guru is an independent, unofficial practice tool. It is not affiliated with or endorsed by Paragon Testing Enterprises, and it does not use their logos or questions. All passages, recordings, prompts and pictures are original, and every score is an estimate.

## Features

- **50 complete original mock tests.** Each test has Listening (6 parts, 38 questions), Reading (4 parts, 38 questions), Writing (2 tasks) and Speaking (8 tasks).
- **Real exam conditions:**
  - Official part order and timers.
  - One question per screen in Listening, and audio plays once.
  - Split-pane Reading with no going back.
  - A Writing editor with no spellcheck, plus cut/copy/paste/undo/redo and a word counter.
  - Speaking with preparation time, then automatic recording.
- **Hard on purpose:**
  - Paraphrased answers and distractors that echo words from the text.
  - Changes of plan and tone-based inference.
  - Reading Part 3 "not given" traps.
  - Diagram tasks that need calculations.
  - Answer positions are balanced, and the correct answer is rarely the longest option.
- **The answer key is locked until you submit.**
  - During a test only the question content is in memory.
  - The key is shipped encoded and decoded only for the report.
- **Strict scoring:**
  - **Listening and Reading** are scored from the answer key using the published approximate raw-score charts. Where ranges overlap, the lower level is used.
  - **Writing and Speaking** are rated by AI on the four official dimensions: Content/Coherence, Vocabulary, Readability (Writing) or Listenability (Speaking), and Task Fulfillment.
  - Each rating includes quoted evidence, line-by-line corrections, and hard caps for missing task points, off-topic answers, repeated grammar errors and unused speaking time.
- **Detailed report:**
  - Highlighted evidence in the transcript or text for every question.
  - An AI explanation of each wrong option.
  - Level-12 model answers.
  - Recordings with transcripts you can edit and re-grade.
  - A personalised 7-day plan.
  - Print or save as PDF.
- **Practice modes:** full mock (about 3 h), single component, single part or task, and an adaptive 30-minute daily workout.
- **Dashboard and "Where to improve":**
  - Streak, 4-week activity and level trend chart.
  - A ranked focus queue of your biggest gaps (parts, question types, rating dimensions) with one-click drills.
  - A skill map of all 20 parts against what your target level needs.
  - Writing and Speaking dimension averages, and the rater's latest advice.
- **AI test generator** (optional): creates new parts that are validated before they are saved.
- **No login and no backend.**
  - Progress is stored in `localStorage`, and recordings in IndexedDB.
  - You can export and import a backup.

## Free AI grading

Open **Settings** and paste one or both of these keys. They are stored only in your browser.

| Provider | Where to get a free key | Default model |
|---|---|---|
| Google Gemini | https://aistudio.google.com → *Get API key* | `gemini-flash-latest` |
| Groq | https://console.groq.com → *API Keys* | `openai/gpt-oss-120b` |

If you have no key, Writing and Speaking get a clearly labelled offline estimate. You can re-grade it with AI later from the report.

**Is my key safe on a public site?** Yes:

- The key never goes into this repository or to any server of this app, and other visitors cannot see it.
- It is stored only in your own browser and sent only to the AI provider, in a request header.
- You can choose "keep for this tab only", and wipe it with **Forget keys**.
- For extra safety, use a key from a Google project without billing and restrict it to your site's address.

See [SECURITY.md](SECURITY.md) for the full model.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # validates the question bank, builds it, then builds the app into dist/
npm run validate   # validate data/tests/*.json only
```

The production build adds a strict Content-Security-Policy. `npm run dev` runs without it, because the dev server needs inline scripts.

Append `?fast=1` to the URL to compress all timers (for development self-tests only).

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys on every push to `main`.

To set it up once, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Project structure

```
data/tests/tNN.json     question bank (human-readable, includes answers)
data/practice.json      unscored practice tasks
data/README.md          authoring guide and schema for new tests
scripts/validate-bank.mjs  strict checks: counts, lengths, verbatim evidence, answer balance, scenes…
scripts/build-bank.mjs  shuffles options, splits answers from content, encodes the key → src/generated/
src/lib/                scoring (grading.js), AI rater (ai.js), evaluation pipeline, audio/TTS, recorder/STT, scenes
src/test/               exam runner, step screens and practice plans
src/pages/              Dashboard, Library, History, Settings, Generator, Evaluating, Report
```

Stack: React 19, Vite 7, Tailwind CSS 4, Framer Motion and Lucide icons (react-icons).

## Browser notes

- Use **Chrome or Edge** for the best experience.
  - Listening uses the Web Speech synthesis voices installed on your device.
  - Speaking transcripts use the browser's speech recognition, which needs an internet connection.
- If no transcript is captured, open the report, type what you said and re-grade.
- Allow microphone access when the Speaking test starts.

## Adding tests

Follow `data/README.md`, add `data/tests/tNN.json`, then run `npm run validate`. The build fails on any test that breaks the rules, so the bank stays consistent.
