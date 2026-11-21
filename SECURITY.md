# Security

CELPIP Guru is a static site with no backend, no accounts and no database. Everything you do is stored in your own browser.

## Your AI key

- **Where it lives:** your Gemini or Groq key exists only in your browser.
  - With "Remember keys on this device" on, it is kept in `localStorage`; with it off, in `sessionStorage`, which is erased when the tab closes.
  - It is never committed to this repository and never sent to any server of this project. Other visitors cannot see it.
- **Where it goes:** it is sent only to the provider you chose (`generativelanguage.googleapis.com` or `api.groq.com`), over HTTPS, in a request header.
- **Backups:** it is not included in backup exports.
- **Recommended:**
  - Create the key in a Google project **without billing**.
  - Restrict it to the *Generative Language API* and to your site's address (`https://<user>.github.io/*`).
  - Press **Forget keys** on shared computers.
  - Rotate the key if you ever suspect it leaked.
- **Shared origin:** all GitHub Pages projects under one account share the origin `https://<user>.github.io`, so they can read each other's browser storage. Only host your own trusted projects there, or use "Remember keys" off.

## Hardening in place

- A strict Content-Security-Policy (`script-src 'self'`; network access limited to the two AI providers; no objects, frames or form posts).
- Referrer policy `strict-origin-when-cross-origin`.
- Picture scenes, AI-generated tests and imported backups are treated as untrusted:
  - colours are allow-listed and markup characters are stripped;
  - only known drawing primitives can run;
  - backups are imported only through a whitelist, with key fields ignored.
- All other content is rendered as text by React (no `innerHTML`).
- CI uses least-privilege tokens, runs `npm audit` (fails on critical issues) and the strict question-bank validator. Dependabot keeps dependencies and actions up to date.

## About the answer key

The answer key is shipped encoded and is only decoded after you submit, so it cannot be seen while you take a test. Because the app runs entirely in your browser, a determined user could still decode it with developer tools. This is a practice tool, so that would only spoil your own practice.

## Reporting a problem

Please open a GitHub issue (do not include any API keys).
