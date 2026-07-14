# Resilencity: Tyler's Backyard — Development Log

**Blackfox Studios · Climate Jam 2026 · Sprint 2**
A ground-up narrative of what was built, why, and how it changed shape along the way.
Current as of 2026-07-14, commit `7901fb0` + Sprint 2 submission session.

---

## 1. Starting point: figuring out what actually existed

The session started with a simple ask — go look at the project's Google Drive folder, the itch.io page, and the Climate Jam 2026 jam rules, and get oriented on what the game is and what was already done.

The Drive folder held six documents: a full Game Design Document, a Sprint 1 "Ideation" submission writeup, two pitch-deck PDFs, and a spreadsheet called **Resilencity_Macro_Chart** — a feature list with a Sprint Tracker showing Sprint 2 at "86% built." The Sprint 1 doc went further, describing "a running build, verified across 1,000 simulations: optimal play wins 98.8% of the time." Taken at face value, this read like a project that just needed a couple of remaining features finished before the July 13 Sprint 2 deadline.

Two things didn't add up. First, a background exploration of the actual project folder on disk (`Farmbotville - Resilencity/Farmbotville`) turned up **eleven PDF exports and a `.claude` config folder — no code at all.** Second, a separate folder elsewhere on the machine (`Blackfox Studios/resiliencity`) did contain real code, but it turned out to be an unrelated small React/Three.js visualizer with mocked, sine-wave-generated telemetry — not the documented game.

Andrew confirmed the suspicion directly: **the Macro Chart's "Built" statuses were written by a prior AI session projecting forward, not reporting reality.** Nothing was actually built. This got written down as a permanent memory note (`project_macrochart_unverified.md`) so no future session repeats the mistake of trusting status claims in these docs without checking real code first. The plan was rewritten from "finish the last few features" to **"build the whole Sprint 2 prototype from zero, in about two days."**

## 2. First build: a working simulation, but flat

The first version was built as a deliberately simple, no-build-tooling web app — plain `index.html` / `engine.js` / `app.js`, chosen specifically because the GDD itself said "Claude writes HTML5 directly" and because a from-scratch two-day sprint has no room for framework setup risk.

`engine.js` modeled the core "Bottle Loop" the design docs described: scavenge → Polyformer → 3D Printer → FarmBot → food → Composter → soil, wrapped in a 24-turn, 24-stamina-per-turn budget, a Tri-Path build-quality choice (Scrap-Yard Hack / Ancestral Method / Code-Compliant, each trading stamina cost against a machine's breakdown chance), and a Crisis Timeline that stripped away resources on a schedule (inflation, then layoffs, then a benefits cut, then delivery isolation). It was headlessly simulated end to end — full playthroughs on all three build paths reliably won, and a "do-nothing" control run reliably lost to starvation.

Functionally this worked. Visually it didn't. The UI was a stats panel and a row of buttons — no yard, no character, nothing to actually look at.

## 3. First rebuild: an isometric backyard with a power grid

Andrew rejected that version outright: *"very very weak — want something that plays more like Earthquake Survival, Tiny Life... the energy component is what connects other things."* He pointed at three reference games: a walk-around survival sim, an isometric 2.5D life sim, and **Green With Energy**, a Steam title about designing power grids.

That last one reframed the whole architecture. Instead of machines just existing and consuming abstract "energy points," the rebuild made **electricity a physical, connective thing**: solar panels generate only in daylight, batteries bank the surplus, and every machine — Polyformer, Printer, FarmBot, Composter — only runs if it's actually wired into a network that reaches a live power source. Placing a `wire` tile is a real action with a real cost. A machine sitting one tile off the grid just shows a stalled **⚡!** icon and does nothing, which turns "why isn't this working" into the central puzzle the way it is in the reference game.

`engine.js` was rewritten around a tile grid, a day/tick clock, and a `computeNetworks()` flood-fill that finds every connected cluster of wires/solar/battery/machines and resolves power flow through it each tick. `scene.js` became a real isometric renderer — diamond ground tiles, extruded prism buildings, a walking Tyler with basic pathfinding, glowing wires when powered, particle bursts on actions. This got tested two ways: headlessly (unpowered machines never progress; wired ones produce and charge batteries; full playthroughs still win), and in-browser, where a recurring tooling problem first showed up — the preview screenshot tool kept timing out. The workaround that stuck for the rest of the session was drawing to an offscreen canvas, `toDataURL()`-ing it, and inspecting the pixels directly (later replaced by a small local upload server, see §6).

## 4. Second rebuild: the backyard *is* the scene, and the dump is a gamble

Andrew then shared four reference images — the FarmBotVille pitch poster, a digital-twin isometric house mockup, a hydroponics infographic, and a top-down circular-economy diagram of the real house — plus a full concept-art PDF. The direction was specific: **the fenced house-and-backyard lot should be the entire main scene**, with Tyler working inside it as the focus, and the dump should live *off-screen* — described as "more of a crap shoot until he builds and has better systems and community buy-in who start organizing the dump content, then it has a higher return for the high-quality material."

This reshaped the map and the economy again. The grid became one fenced lot: a house with a rooftop solar panel, a row of rain barrels, a gate in the fence. The dump moved entirely off the visible map — reachable only by walking to the gate and taking a **Dump Trip**, which costs real time (three ticks) and rolls loot from a tiered table:

- **Tier 0 (alone):** mostly nothing or one or two bottles; occasionally a lucky haul.
- **Tier 1 (3 food shares over the fence):** the neighbors start sorting piles — consistent yields, occasional seeds or filament-grade scrap.
- **Tier 2 (6 shares + the loop closed once):** the block organizes an actual sorted waste center — reliable high yields, a chance at pre-sorted filament stock, and a **morning drop-off** of bottles waiting at the gate every day.

A new `shareFood` action (spend pantry food at the gate) drives community tier up, and `stone.js`'s advice track was rewritten to lead the player toward it: *"share food — organize the block."* Verified headlessly (gate-adjacency enforcement, tier-based loot minimums, full playthroughs reaching community tier 1–2, neglect still losing) and in-browser by clicking Dump Trip and watching Tyler auto-walk to the gate and return with a logged, randomized haul.

## 5. Making the plan visible: the order-of-operations checklist

Andrew's next note was that it wasn't clear *what to do in what order* — the game knew the intended sequence but never showed it as a plan. `stone.js` gained a `stoneObjectives()` function: a nine-step checklist — scavenge, build solar, wire a battery, run the Polyformer, run the Printer, harvest from the FarmBot, close the loop at the Composter, get the block organized, hold it through Day 12 — computed live from actual game state. The current step is highlighted, finished steps get crossed out. It rendered as **"The Plan"** at the top of Stone's dashboard panel.

(This step also produced the session's first caching bug: the new script loaded but the browser had cached the old `stone.js`, so the checklist silently failed to appear until the `<script>` tags were given `?v=` cache-busting query strings — bumped on every subsequent change since, now at `?v=11`.)

With the checklist in place, the intended 12-day arc could finally be stated plainly: **Days 1–2** scrounge bottles and get the grid live; **Days 3–4**, as layoffs cut the daily stamina budget, build out the production chain; **Days 5–6**, racing the SNAP-cut deadline, get the first harvest in; **Days 7–8**, close the loop right as delivery isolation halves dump yields; **Days 9–12**, with surplus stamina, turn outward and organize the block.

## 6. Art direction: from a painted poster to a spec to real sprites

Andrew shared the FarmBotVille pitch poster art (**"FARMBOTVILLE: Seedfolks"**) and asked for the game to look like it — full design system, sprite list, and machine assets.

The first version of this plan was **spec-only**: a complete, commission-ready `game/ART_SPEC.md` — style guide, technical rules, and a full asset table — meant to be handed to Makko.ai verbatim. Alongside it, `game/assets.js` and every painter in `scene.js` got a **sprite pipeline**: every drawing routine checks a sprite cache first and only falls back to its procedural greybox shape if the file isn't there. Proven end-to-end with a throwaway test PNG dropped into `game/assets/`.

Andrew then changed course: **skip Makko, author the assets directly from the spec.** The loader was extended to try a PNG first, then an SVG, then the procedural fallback. All 47 assets from the spec were generated as hand-authored vector SVGs from a single Python script sharing one palette, one 2:1 isometric projection, and one light source: skyline, fenced lot, house, barrels, grass/paver tiles, trees, all six machines with idle/running frames, FarmBot sprout stages, the original five Tyler poses, a vector Stone owl, and both dump backdrops.

Verifying this required solving the flaky-screenshot problem properly: a small local Python HTTP server was stood up on port 8899 to receive `canvas.toBlob()` PNG uploads from the running page — a much more reliable loop than the built-in screenshot tool. It caught one real bug (a status progress-bar floating at the wrong height above taller sprites), fixed immediately.

## 7. Quality of life: one button to run every machine

Once several machines were placed, the natural friction point was clicking through them individually every cycle. `engine.js` gained `runAllMachines(state)` — loads every idle machine with its inputs on hand, food-chain first, stopping cleanly if stamina runs out. A new **🔁 Do Rounds** button sits next to Sleep. Tested headlessly (loads everything affordable; correct no-op reporting; stops at the right count) and in the browser — built a genuine solar → wire → battery → Polyformer rig through real toolbar clicks, confirmed Do Rounds correctly refused an unaffordable load, then loaded it successfully after a top-up.

## 8. An infrastructure hiccup

The local dev server serving the game stopped responding at `localhost:8811`. Diagnosis ruled out a code problem first — `engine.js` and `app.js` both still parsed cleanly — and confirmed the tracked preview server process had simply stopped. Fixed with a plain restart from `.claude/launch.json`.

## 9. Verifying it for real: reviewing a recorded playthrough

Andrew recorded an 11:53 unscripted playthrough with live narration (`Surviving Nights With Solar and FarmBots.mp4`) and asked for it to actually be watched, not just skimmed. The `Read` tool can't decode video, so `ffmpeg` was needed — no `sudo` was available, so a static binary came in through `pip install imageio-ffmpeg` instead of a system package. Sixteen frames were pulled at 45-second intervals, plus the full audio track, transcribed locally with `openai-whisper` (base model).

The review turned up real, unscripted proof the systems work as designed: a first playthrough that **genuinely lost**, with Andrew reading the exact loss-screen line back ("family went hungry before the loop could carry them... power first, then production"); a real "why isn't this connected" moment on the power-grid puzzle — the intended lesson, arrived at without prompting; an emergent risk the design never explicitly coded but that fell out of the numbers anyway (sharing too much food at the gate nearly starved his own household); Do Rounds discovered and used correctly unprompted; and a final win screen read verbatim, matching the code exactly ("closed the Bottle Loop 14 times..."). Andrew also voiced wanting to see impact reflected at a neighborhood scale — independent confirmation that the Macro Chart's "neighborhood adoption reveal" is the right next big feature.

## 10. Getting it under version control

With a verified playable build in hand, the project went into git for the first time. A private GitHub repo was created (`Cloudenvy7/resilencity-tylers-backyard`) and the initial commit pushed: `game/` (engine, renderer, UI, the 47-asset SVG pack, `ART_SPEC.md`), `DEVLOG.md`, and — at the time — the eleven pitch-deck PDFs sitting at the project root. `.claude/` was gitignored from the start.

Two corrections followed once Andrew looked at what actually got pushed. First: the eleven PDFs were the wrong documents — pitch-deck exports, not the jam materials. They were untracked (not deleted locally) and replaced with the real Climate Jam 2026 source documents in a new `docs/` folder: the Sprint 2 Pre-Production requirements, the Sprint 1 Ideation submission, the Sprint 1 Design Document Template, and the full Design Document. Second, the `Resilencity_Macro_Chart.xlsx` spreadsheet was added to `docs/` as well (explicitly *not* a zip that was also floating around in Downloads).

## 11. Character art v2: Tyler gets his canonical design

Andrew produced a high-fidelity character turnaround for Tyler (`tyler-turnaround-orange-v2`) — curly high-top with faded sides, bright safety-orange bomber/hoodie over a charcoal tee, charcoal cargo pants, orange work boots, insulated gloves, a utility tool belt, and the Blackfox Studios fox mark on the hoodie back — plus a five-pose sheet (idle, walk loop, scavenge, engineer, share). Dropping illustration-grade art straight into a vector world would clash, so the first pass was adaptation: a new generator (`gen_tyler.py`) rebuilt Tyler as clean simplified vectors keeping every identity element, producing eight sprites (front idle/2-frame walk/2-frame engineer-with-holo-panel, plus a new back set carrying the fox mark). `scene.js` gained true **4-way facing** for the first time — tracking tile-movement direction and picking front vs. back art, mirrored for the other two — matching the brief's mapping (front-¾ = SE, back-¾ = NW) exactly. The orange also fixed a real readability problem: the old green hoodie used to blend into the grass.

## 12. From vectors to real pixels: slicing the pose sheet

Andrew then asked to use the actual illustrated art instead of the vector adaptation — the loader's PNG-first design meant this needed no new code, just correctly sliced, transparent, anchored files. A `slice_tyler.py` script keyed out the sheet's checkerboard background (flood-fill from the image edges, tolerant of JPEG noise), isolated each figure by connected-component analysis, and cropped six usable panels — idle and 2-frame walk, front and back. The scavenge/engineer/share panels were skipped: Tyler physically overlapped the gate, console, and second figure in those crops, so they couldn't be cut cleanly, and the vector engineer pose (with its holo cue) stayed in place as the fallback. One inconsistency surfaced in verification — the sheet's idle poses faced the opposite way from its walk poses — fixed by flipping the two idle frames.

While locating the source sheet, a sibling folder turned up inside the project directory: `Resilencity Build By Antigravity - 07122026`, a parallel clone of the same GitHub repo where another AI tool had independently attempted the identical task, going further on paper with an 8-direction, 4-frame-walk system. Its direction-mirroring code was reviewed but not adopted — several of its walk frames were visibly mis-sliced (a second head bleeding in at the crop boundary), and its art style diverged from the approved canon. One idea from it *was* worth keeping: **continuous interpolated depth sorting** for Tyler, so he no longer visually pops in front of or behind objects at tile boundaries mid-walk — ported over on its own. The nested clone was added to `.gitignore` so it can't be accidentally committed into the main repo, and `.claude/launch.json` was changed to auto-select a port after its leftover server was found squatting on 8811.

## 13. The 8-direction Tyler

Andrew followed up with a proper production-grade grid: 8 directions (N through NW) × idle + walk frames in one consistent style, plus an updated turnaround locking goggles and tan work boots into the canon. This solved the previous sheet's weaknesses (inconsistent facing, only two usable directions) and settled the isometric-fit question cleanly: the four diagonal columns are true ¾ views — exactly what a 2:1 isometric character uses — and the game's tile movement only ever produces those four facings. No art modification was needed.

A grid-aware slicer with QA assertions (one figure per cell, height-outlier detection — specifically to catch the mis-slice failure mode just seen in the Antigravity set) cut the sheet into 48 sprites: 8 idles and 5-frame walk loops per direction, with a clean bill of health on the first run. One correction: the sheet's direction labels were horizontally mirrored versus screen convention (its "SE" art walked down-left) — confirmed by checking which way the boots pointed, fixed with a pure file-rename swap (se↔sw, ne↔nw, e↔w), no art touched. The loader gained the 8-direction manifest and a `walkFrameCount()` helper so animation adapts to however many frames exist, and the renderer now prefers direction-specific art with **no mirroring at all**, so the tool belt and back logo stay on the correct side in every facing. Fallback chain (8-dir → old 2-frame set → SVG → procedural) regression-tested by deleting a direction's sprites at runtime and confirming graceful degradation.

## 14. Stone gets the same 8-direction treatment

Andrew produced a matching sheet for Stone the owl (8 directions × idle + 6-frame hover) and asked for identical treatment. The same slicer handled it directly — same source resolution, same layout — and came back clean: 56/56 cells, no height outliers. The owl hovers rather than standing on a ground line, so its crops are center-anchored instead of bottom-anchored.

The same mirrored-label issue repeated (confirmed via the E/W pair — the beak sat on the wrong side in both), consistent with both sheets coming from the same generation pipeline, and fixed with the identical rename swap. `assets.js` gained a shared `countFrames()` helper (de-duplicating the walk/hover frame-counting logic), and the two duplicated owl-drawing call sites in `scene.js` were collapsed into one `drawOwl(ctx, dir, x, y)` function. **Stone now turns to face whatever direction Tyler is walking**, rather than always hovering to his right regardless of movement — a small behavioral upgrade, not just a visual one. Fallback chain regression-tested the same way as Tyler's.

---

## 15. Where things stand

**Playable today:** a full 12-day survival loop in an isometric backyard. Power is physical and has to be wired. The dump is an off-screen gamble that gets better as you invest in the community. Six machines, three build-quality paths each, a live checklist telling you what's next, and a one-click way to run your whole setup once it exists. Both Tyler and Stone now use fully-illustrated, direction-correct 8-way art from the approved character sheets, with vector and procedural fallbacks underneath for anything not yet delivered.

**Repo:** `github.com/Cloudenvy7/resilencity-tylers-backyard` (private), 7 commits on `main`, most recent `7901fb0`.

**File map:**
| Path | Role |
|---|---|
| `game/engine.js` | World state, tick/day clock, power networks, machines, crisis timeline, community tiers — no DOM, fully unit-testable |
| `game/scene.js` | Isometric canvas renderer; 8-dir sprite-first with 4-dir/SVG/procedural fallback for every drawable |
| `game/stone.js` | Dashboard gauges, scripted advice, the live "Plan" checklist |
| `game/app.js` | Click-to-walk input, toolbar, Tri-Path modal, HUD rendering |
| `game/assets.js` | Sprite manifest + PNG→SVG→fallback loader, frame-counting helpers |
| `game/assets/` | 161 files: 50 first-party SVGs (world, machines, original poses) + 110 sliced PNGs (Tyler + Stone, 8-direction) |
| `game/ART_SPEC.md` | Commission-sheet-style spec, updated to also document the 8-direction naming convention |
| `game/index.html` / `style.css` | Page shell and dark-panel UI styling (cache-busted at `?v=11`) |
| `docs/` | The real Climate Jam 2026 materials: GDD, Sprint 1 template + submission, Sprint 2 Pre-Production, Macro Chart |

**Standing project notes worth remembering:**
- Don't trust "Built" status claims in the Drive docs without checking real code first (`project_macrochart_unverified.md` in memory).
- The embedded preview tab throttles background timers — the game can look frozen there even though it's running fine; verify in a focused browser tab, or via the canvas-upload capture method (a local server on port 8899 receiving `canvas.toBlob()` PNGs) built in §6 and used throughout.
- A sibling folder, `Resilencity Build By Antigravity - 07122026`, is a parallel AI attempt at this same repo. It's gitignored on purpose — don't un-ignore it or merge from it without re-reviewing, since its Tyler sprite slicing was found to have real defects.

**Not yet built, and explicitly out of scope for Sprint 2 per the jam's own rules:** the Class A/B/C build-quality depth beyond the current pass/fail reliability roll, the reputation/sales enterprise layer, and the neighborhood-adoption ending reveal — all correctly Sprint 3 scope per the project's own Macro Chart priority tags, once those tags are treated as a planning guide rather than a status report. A FarmBot 8-direction animation sheet is sitting in Downloads, ready for the same slicing treatment whenever the next art pass happens.

---

## 16. Sprint 2 submission: preparing materials and getting the game live

*2026-07-13 to 2026-07-14*

With the playable build verified and committed, the session turned to producing the actual Sprint 2 submission package. The deadline was July 13 at 11:59 PM PDT.

**Reviewing what we had vs. what the rubric needed.** The Sprint 2 rubric required: (a) a video of a prototype/proof-of-concept demonstrating core elements, (b) concepts or early drafts of aesthetic elements, and optionally (c) a way to try the prototype and a production plan link. The gameplay recording from §9 ("Surviving Nights With Solar and FarmBots.mp4") covered the video requirement. The 8-direction sprite sheets and 47 SVG assets covered aesthetics. What remained was the submission form itself, a downloadable build, and a production plan link.

**Reviewing the production plan documents.** Two candidate documents were audited before deciding what to link:

1. **Art Direction & Visual Development Record** (Google Doc) — a comprehensive design authorship record written by Andrew Powers tracing the project from 2022 paper sketchbooks through 2026 AI-assisted production. It establishes the canonical visual thesis (backyard vs. dump vs. city contrast, golden-hour palette, camera projection, Tyler and Stone character canon), the AI correction workflow (six-step process: sketch → constrain → generate → compare → correct → promote), and the five narrative scenarios (F through A, from crisis unchecked to full FarmBotVille transformation). Strong for explaining design intent and authorship; less strong as a milestone tracker.

2. **Resilencity Macro Chart** (Google Sheets) — a three-tab production plan: the main feature list (31 rows, Priority 1–5, Sprint S2–Later, Status column), a Legend tab defining all column values (design pillars P1–P4, priority scale, status meanings), and a Sprint Tracker tab computing completion percentages automatically from the status column. Reading it confirmed Sprint 2 is 100% complete (14/14 Priority 1–3 items built), Sprint 3 is at 20% (2/10 started — the v0.2 map and token work), and the project is 64% complete overall.

Two inaccuracies were found in the Macro Chart and corrected directly in the sheet before submitting: (1) the main tab footer still said "24-move crisis" — changed to "12-day crisis" to match the actual game; (2) the Sprint Tracker S2 deliverable said "Playable 24-move loop" — changed to "Playable 12-day loop." All other statuses matched the real code. The Macro Chart was chosen as the production plan link over the Art Bible because it directly answers what the rubric asks: scope, priorities, what can be cut, and milestones per sprint.

**Creating a downloadable build.** The itch.io stretch goal asks for a way to try the prototype. The game is already live at `http://resilencity.blackfoxstudios.org/`, but itch.io also accepts a downloadable zip. A Python `zipfile` script packaged the entire `game/` directory — all JS, CSS, HTML, and the 161-file `assets/` folder — into `resilencity-tylers-backyard.zip` (0.5 MB), excluding `ART_SPEC.md` which is an internal document. The zip puts `index.html` at the root so players can unzip and open directly in Firefox (a note was added to the itch.io page that Chrome may block local asset loading, and Firefox is recommended for the download version).

**Drafting the submission form.** The five required fields were finalized as follows:

- **Production Plan:** Macro Chart Google Sheets link
- **Game Engine, Platform, Format:** Custom HTML5 Canvas engine in vanilla JavaScript — no framework. Covers the isometric 2:1 tile grid, flood-fill power-network simulation, BFS pathfinding, day/night clock, and 3-tier community progression system. Art generated with ChatGPT, Gemini, and Claude (sprite sheets sliced to transparent PNGs), with Makko.ai planned for Sprint 3. Platform: browser, no install required.
- **Team Name:** Blackfox Studios
- **Primary Team Contact:** Andrew@blackfoxstudios.org
- **Team or Project Change Explanation:** Explained that the Sprint 1 prototype was completely rebuilt from a menu-driven button UI into the current isometric 2.5D world after feedback that the original lacked the spatial "energy connects everything" feel. Core concept unchanged (Tyler → Bottle Loop → survive 12 days); format changed to match references Green With Energy and Tiny Life. Team unchanged: solo.

**Tagline.** The itch.io short description field prompted the question of how to describe the game in one line. Several options were drafted, and Andrew landed on the one that best captures the game's design pillar P4 ("hope over doom — collapse is the opening"):

> **"When the system falls, that's when we build."**

This line also turned out to be the clearest single statement of the game's thesis and will carry forward as the project's primary tagline into Sprint 3 and beyond.
