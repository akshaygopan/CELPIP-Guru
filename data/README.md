# CELPIP Guru question bank – authoring guide

Every test is one JSON file in `data/tests/` named after its id (`t11.json`). A test is complete only when it passes:

```
node scripts/validate-bank.mjs data/tests/t11.json
```
For tests t11+, every check is an error, including lengths and explanation detail. The original t01–t10 are "legacy" and still get length warnings until they are upgraded.

All content must be **original**: no copying or paraphrasing of official materials, no real brand or company names (invent them), no real public figures. Use Canadian everyday settings, spelling (colour, centre, neighbour), cities, seasons and institutions in a generic way.

## JSON rules (read carefully – broken JSON wastes time)
- Write the file with the Write tool as a single JSON object. No comments, no trailing commas.
- Inside strings, use typographic apostrophes and quotes: `’` `“` `”` (never a raw `"` inside a string). Use `\n` for line breaks (letters, emails, models). Do not put real line breaks inside strings.
- Use `–` (en dash) for ranges, e.g. `9:00–11:00`.

## Structure (see `data/tests/t01.json` for a complete example – but note its texts are SHORTER than the minimums below; follow the minimums)
```
{ "id": "t11", "title": "Test 11",
  "L": { "parts": [ LPART n=1 … n=6 ] },
  "R": { "p1": …, "p2": …, "p3": …, "p4": … },
  "W": { "t1": …, "t2": … },
  "S": { "t1": … "t8": … } }
```
**Question object Q** (all multiple-choice questions and drop-down blanks):
`{ "q": "question text", "o": ["opt A","opt B","opt C","opt D"], "a": 0-3, "t": TYPE, "ev": "verbatim quote", "x": "explanation" }`
- Blanks (`R1 reply`, `R2 email`, `R4 comment`) use the same object without `"q"`.
- `ev` must be copied **exactly** (word for word) from the transcript/passage that proves the answer – a phrase or one sentence, not invented. For R2, the evidence may come from the diagram text (table cell, card line or note).
- `x` (12–45 words): why the answer is right AND why the most tempting wrong option is wrong.
- `t` is one of: `detail, inference, attitude, main, purpose, prediction, paraphrase, vocab, notgiven, viewpoint, diagram, coherence`.

### Listening – `L.parts` (6 parts, 38 questions)
`{ "n": 1, "context": "one sentence shown before the audio", "sp": { "A": {"name":"Priya","g":"f","acc":"en-CA","rate":1.02}, "B": {…} }, "sections": [ { "lines": [["A","spoken text"],["B","…"]], "qs": [Q, …] } ] }`
- `acc`: one of `en-CA, en-US, en-GB, en-AU, en-IN`. `rate` 0.92–1.08. Give speakers in one part different accents/genders where natural.
- Part 1 Problem Solving: **3 sections with 3, 3, 2 questions**; 2 speakers; 220–300 words per section (≥600 total). A problem, then options considered and rejected, then a decision.
- Part 2 Daily Life Conversation: 1 section, **5** questions, 330–420 words, 2 speakers.
- Part 3 Listening for Information: 1 section, **6** questions, 400–520 words, 2 speakers (one gives detailed information: rules, dates, prices, conditions).
- Part 4 News Item: 1 section, **5** questions, 320–420 words; news anchor (+ optionally one interviewee).
- Part 5 Discussion: 1 section, **8** questions, 520–700 words, **3 speakers** with distinct, shifting positions; ends with a decision.
- Part 6 Viewpoints: 1 section, **6** questions, 450–600 words; a reporter (+ optional interviewee) presenting at least two nuanced viewpoints.

### Reading – `R`
- `p1` Correspondence: `{ "meta": "From: … | To: … | Subject: …", "text": "letter 300–420 words", "qs": [Q×6], "reply": { "intro": "Here is …’s response. Complete it by choosing the best option for each blank.", "text": "reply 130–180 words with {1} {2} {3} {4} {5}", "blanks": [Q×5] } }`
- `p2` Apply a Diagram: `{ "diagram": { "title", "intro", "table": {"cols":[…], "rows":[[…],…]}, "cards": [{"h":"…","lines":["…"]}], "notes": ["…"] }, "email": { "intro", "text": "140–190 words with {1}…{5}", "blanks": [Q×5] }, "qs": [Q×3] }` – the diagram must be rich (table ≥5 rows and/or cards, plus ≥3 notes with conditions/exceptions). Blanks and questions must require **applying** the diagram: calculations (discounts, totals, differences), combining two conditions, exceptions in notes, schedule logic.
- `p3` Reading for Information: `{ "title", "paras": ["A text","B text","C text","D text"], "qs": [{ "q": "statement", "a": "A"|"B"|"C"|"D"|"E", "t", "ev", "x" } ×9] }` – paragraphs 120–160 words each; **2–3 answers must be "E"** (not given) and for those set `"ev": ""`. Each of A–D must be the answer at least once. E-statements must be traps: the topic IS discussed, but the specific claim (a number, a comparison, a cause, a future plan) is not stated.
- `p4` Viewpoints: `{ "title", "byline": "Opinion | by Name, role", "text": "article 520–650 words", "qs": [Q×5], "comment": { "intro", "text": "reader comment 140–190 words with {1}…{5}", "blanks": [Q×5] } }` – the comment writer partly agrees and partly disagrees; blanks test understanding of BOTH texts.

### Writing – `W`
- `t1`: `{ "situation": "…", "bullets": ["…","…","…"], "model": "Level 12 email, 175–200 words, \n\n between paragraphs, with greeting and sign-off" }`
- `t2`: `{ "intro": "…", "question": "Which option do you prefer?", "a": "Option A text", "b": "Option B text", "model": "Level 12 survey response, 175–200 words" }` – A and B must be genuinely balanced.
- **Model answers must be 160–200 words** (validator enforces).

### Speaking – `S`
- `t1` Giving Advice (90 s), `t2` Personal Experience (60 s), `t7` Expressing Opinions (90 s): `{ "prompt": "…", "model": "…" }`
- `t3` Describing a Scene: `{ "scene": SCENE, "prompt": "Describe some things that are happening in the picture as well as you can. The person you are speaking to cannot see the picture.", "model": "…" }`
- `t4` Making Predictions (same scene as t3): `{ "prompt": "In this picture, what do you think will most probably happen next?", "model": "…" }`
- `t5` Comparing and Persuading: `{ "intro": "…Choose the option you prefer…", "options": [{"title","details":[5 short facts]}, {…}], "other": {"title","details":[5]}, "otherWho": "Your sister prefers", "persuade": "Your sister prefers … Persuade her that your choice is better.", "model": "…" }`
- `t6` Difficult Situation: `{ "situation": "…", "options": ["Talk to X and …", "Talk to Y and …"], "note": "Choose ONE option and speak to that person.", "model": "…" }`
- `t8` Unusual Situation: `{ "scene": SCENE, "prompt": "…call/describe… explain whether…", "model": "…" }`
- Model sizes: 90-second tasks 190–220 words, 60-second tasks 130–150 words, natural spoken Canadian English, Level 11–12.

### SCENE (SVG illustration; canvas 640×400, ground roughly y=300–390)
`{ "bg": "park|street|indoor|office|kitchen|classroom|beach|lake|winter|market", "alt": "detailed 60–120 word description of everything in the picture (the AI grader only sees this)", "items": [ [primitive, x, y, …args], … ] }` – 8–16 items, with people doing different things.
Primitives (x,y = base/feet position unless noted):
- `["person", x, y, {shirt, pants, skin, hair, hairStyle: short|long|bun|curly|bald, pose: stand|walk|run|sit|wave|point|both, hold: phone|cup|bag|book|box|umbrella|leash|balloon|camera|tray|racket|rod|map|flowers|shovel|paint, holdColor, kid: true, flip: true, dress: true, hat: colour, glasses: true, s: scale}]`
- nature: `tree(x,y,s,col)`, `pine(x,y,s)`, `bush(x,y,s)`, `flowers(x,y,n)`, `sun(x,y)`, `cloud(x,y,s)`, `raincloud(x,y)`, `pond(x,y,w)`, `duck(x,y)`, `mountain(x,y,s)`, `puddle(x,y)`, `snowman(x,y)`, `dog(x,y,col,flip)`, `cat(x,y,col)`, `bird(x,y)`
- objects: `bench(x,y,w)`, `table(x,y,w,col)`, `picnic(x,y,w)`, `basket(x,y)`, `chair(x,y,col)`, `sofa(x,y,w,col)`, `tv(x,y)`, `lamp(x,y)`, `streetlamp(x,y)`, `shelf(x,y,w)`, `desk(x,y,w)`, `laptop(x,y)`, `monitor(x,y)`, `mug(x,y,col)`, `plant(x,y,s)`, `window(x,y,w,h)` (x,y = top-left), `door(x,y,col)`, `clock(x,y)` (centre), `box(x,y,w,h,label,col)`, `ladder(x,y,h)`, `sign(x,y,text,col)`, `banner(x,y,w,text,col)` (top-left), `fence(x1,x2,y)`, `ball(x,y,col)`, `kite(x,y,col)`, `balloons(x,y)`, `cake(x,y)`, `grill(x,y)`, `tent(x,y,col)`, `campfire(x,y)`, `stall(x,y,w,label,col)`, `cart(x,y)`, `stroller(x,y)`, `bike(x,y,col,flip)`, `car(x,y,col,flip)`, `bus(x,y,col,label)`, `truck(x,y,col,label)`, `house(x,y,col,roof)`, `building(x,y,w,h,col,label)`, `shop(x,y,w,label,col)`, `cone(x,y)`, `hydrant(x,y)`, `whiteboard(x,y,w,text)` (top-left), `counter(x,y,w,col)`, `register(x,y)`, `boat(x,y,col)`, `canoe(x,y,col)`, `umbrellaBeach(x,y,col)`, `sandcastle(x,y)`, `towel(x,y,col)`, `swing(x,y)`, `slide(x,y)`, `easel(x,y)`, `bin(x,y,col,label)`, `text(x,y,t,size,col)`, `speech(x,y,text)`, `water(x,y,w,h)`, `rect(x,y,w,h,col)`
- unusual objects (for t8; each may be used by at most 2 tests in the whole bank): `teapotHouse, shoeCar, bookChair, upsideDownHouse, pianoStairs, giantChair, robotWalker, busGarden, bedBoat, longBike` – all `(x,y)`.
- **wrappers for creating your own unusual situations** (preferred for t8): `["big", primitive, x, y, scale, …args]` draws any primitive scaled (e.g. a giant dog standing taller than a house: `["big","dog",320,370,4,"#a0522d"]`), and `["flip", primitive, x, y, …args]` draws it upside down above its base point (e.g. a car parked upside down on a roof).

## Difficulty – target CELPIP Levels 9–12 (the candidate wants hard practice)
1. **Paraphrase every correct answer.** The right option must not reuse the key words of the evidence sentence. Wrong options SHOULD reuse words that were actually said/written, but in the wrong relationship (wrong person, wrong time, rejected plan, condition reversed).
2. **Plan changes:** in conversations, a first plan/number/time is stated, then corrected or rejected – distractors use the first version.
3. **Attitude and implied meaning:** at least 6 Listening and 4 Reading questions per test must require inferring opinion or intention from tone or hedging (e.g. “I suppose that could work” = reluctant agreement).
4. **Balanced options:** all four options similar in length and grammatical form; the correct answer may be the single longest option in at most 40% of questions and at least 12% (validator enforces 12–45%), so candidates can neither always pick nor always rule out the longest option.
5. **No giveaways:** never “all of the above”; no option that is obviously silly; no answer that can be guessed without the text.
6. **Spread answers:** correct-answer positions roughly even across A–D (and A–D/E in Part 3).
7. **Part 3 E-traps** as described above; Part 2 diagram questions need real computation or rule application.
8. Distinct names, places and topics in every part. Don’t repeat scenarios used in t01–t10 (fundraiser venue, bike repair, green bin, library of things, 4-day week, backyard chickens, furniture misdelivery, dental reschedule, program transfer, heated shelters, condo EV chargers, school start times, renovation joist, laptop return, food bank volunteer, snow day, school trip cost, park reservations, camping booking error, ceiling leak, daycare waitlist, food waste, grandmother housing, mandatory voting, café espresso machine, airport rebooking, HR benefits, health app, soccer fees, native lawns, lost dog, roaming charges, museum desk, right to repair, student project, heritage tower, field trip bus, pharmacy transfer, tree planting, open office, AI in schools, youth soccer flood, car rental, engineer credentials, e-bike rebate, family cottage, daylight time, dental software outage, hotel room, library card, noise cameras, dog park, leaf blowers, road trip overheating, sofa delivery, energy rebate, bridge delay, no-tipping, youth scorekeeping).
