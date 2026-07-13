# Resilencity: Tyler's Backyard — Development Log

**Blackfox Studios · Climate Jam 2026 · Sprint 2**
A ground-up narrative of what was built, why, and how it changed shape along the way.

---

## 1. Starting point: figuring out what actually existed

The session started with a simple ask — go look at the project's Google Drive folder, the itch.io page, and the Climate Jam 2026 jam rules, and get oriented on what the game is and what was already done.

The Drive folder held six documents: a full Game Design Document, a Sprint 1 "Ideation" submission writeup, two pitch-deck PDFs, and a spreadsheet called **Resilencity_Macro_Chart** — a feature list with a Sprint Tracker showing Sprint 2 at "86% built." The Sprint 1 doc went further, describing "a running build, verified across 1,000 simulations: optimal play wins 98.8% of the time." Taken at face value, this read like a project that just needed a couple of remaining features finished before the July 13 Sprint 2 deadline.

Two things didn't add up. First, a background exploration of the actual project folder on disk (`Farmbotville - Resilencity/Farmbotville`) turned up **eleven PDF exports and a `.claude` config folder — no code at all.** Second, a separate folder elsewhere on the machine (`Blackfox Studios/resiliencity`) did contain real code, but it turned out to be an unrelated small React/Three.js visualizer with mocked, sine-wave-generated telemetry — not the documented game.

Andrew confirmed the suspicion directly: **the Macro Chart's "Built" statuses were written by a prior AI session projecting forward, not reporting reality.** Nothing was actually built. This got written down as a permanent memory note (`project_macrochart_unverified.md`) so no future session repeats the mistake of trusting status claims in these docs without checking real code first. The plan was rewritten from "finish the last few features" to **"build the whole Sprint 2 prototype from zero, in about two days."**

---

## 2. First build: a working simulation, but flat

The first version was built as a deliberately simple, no-build-tooling web app — plain `index.html` / `engine.js` / `app.js`, chosen specifically because the GDD itself said "Claude writes HTML5 directly" and because a from-scratch two-day sprint has no room for framework setup risk.

`engine.js` modeled the core "Bottle Loop" the design docs described: scavenge → Polyformer → 3D Printer → FarmBot → food → Composter → soil, wrapped in a 24-turn, 24-stamina-per-turn budget, a Tri-Path build-quality choice (Scrap-Yard Hack / Ancestral Method / Code-Compliant, each trading stamina cost against a machine's breakdown chance), and a Crisis Timeline that stripped away resources on a schedule (inflation, then layoffs, then a benefits cut, then delivery isolation). It was headlessly simulated end to end — full playthroughs on all three build paths reliably won, and a "do-nothing" control run reliably lost to starvation, which is exactly the shape a jam judge should be able to see in a five-minute video.

Functionally this worked. Visually it didn't. The UI was a stats panel and a row of buttons — no yard, no character, nothing to actually look at.

## 3. First rebuild: an isometric backyard with a power grid

Andrew rejected that version outright: *"very very weak — want something that plays more like Earthquake Survival, Tiny Life... the energy component is what connects other things."* He pointed at three reference games: a walk-around survival sim, an isometric 2.5D life sim, and **Green With Energy**, a Steam title about designing power grids.

That last one reframed the whole architecture. Instead of machines just existing and consuming abstract "energy points," the rebuild made **electricity a physical, connective thing**: solar panels generate only in daylight, batteries bank the surplus, and every machine — Polyformer, Printer, FarmBot, Composter — only runs if it's actually wired into a network that reaches a live power source. Placing a `wire` tile is a real action with a real cost. A machine sitting one tile off the grid just shows a stalled **⚡!** icon and does nothing, which turns "why isn't this working" into the central puzzle the way it is in the reference game.

`engine.js` was rewritten around a tile grid, a day/tick clock (day and night now matter, because solar only fires in daylight), and a `computeNetworks()` flood-fill that finds every connected cluster of wires/solar/battery/machines and resolves power flow through it each tick. `scene.js` became a real isometric renderer — diamond ground tiles, extruded prism buildings, a walking Tyler with basic pathfinding, glowing wires when powered, particle bursts on actions. This got tested two ways: headlessly (a script placed an unpowered machine and confirmed it never progressed; placed a fully wired one and confirmed it produced output and charged its battery; ran full playthroughs on all three build paths and confirmed they still won), and in-browser, where a recurring tooling problem first showed up — the preview screenshot tool kept timing out. The workaround that stuck for the rest of the session was having the page draw to an offscreen canvas, `toDataURL()` it, and inspect the pixels directly (later replaced by a small local upload server, see §6).

## 4. Second rebuild: the backyard *is* the scene, and the dump is a gamble

Andrew then shared four reference images — the FarmBotVille pitch poster, a digital-twin isometric house mockup, a hydroponics infographic, and a top-down circular-economy diagram of the real house — plus a full concept-art PDF. The direction was specific: **the fenced house-and-backyard lot should be the entire main scene**, with Tyler working inside it as the focus, and the dump should live *off-screen* — described as "more of a crap shoot until he builds and has better systems and community buy-in who start organizing the dump content, then it has a higher return for the high-quality material."

This reshaped the map and the economy again. The grid became one fenced lot: a house with a rooftop solar panel, a row of rain barrels, a gate in the fence. The dump moved entirely off the visible map — reachable only by walking to the gate and taking a **Dump Trip**, which now costs real time (three ticks) and rolls loot from a tiered table instead of a flat yield:

- **Tier 0 (alone):** mostly nothing or one or two bottles; occasionally a lucky haul.
- **Tier 1 (3 food shares over the fence):** the neighbors start sorting piles — consistent yields, occasional seeds or filament-grade scrap.
- **Tier 2 (6 shares + the loop closed once):** the block organizes an actual sorted waste center — reliable high yields, a chance at pre-sorted filament stock, and a **morning drop-off** of bottles waiting at the gate every day.

A new `shareFood` action (spend pantry food at the gate) drives community tier up, and `stone.js`'s advice track was rewritten to lead the player toward it once the core loop is running: *"share food — organize the block."* This was verified headlessly again (gate-adjacency enforcement, tier-based loot minimums, full playthroughs reaching community tier 1–2, neglect still losing) and in-browser by actually clicking the Dump Trip button and watching Tyler auto-walk to the gate and return with a logged, randomized haul.

## 5. Making the plan visible: the order-of-operations checklist

Even with the mechanics right, Andrew's next note was that it wasn't clear *what to do in what order* — the game knew the intended sequence (Stone's advice hinted at it one line at a time) but never showed it as a plan. `stone.js` gained a `stoneObjectives()` function: a nine-step checklist — scavenge, build solar, wire a battery, run the Polyformer, run the Printer, harvest from the FarmBot, close the loop at the Composter, get the block organized, hold it through Day 12 — computed live from actual game state (new `state.stats` counters for filament/parts made, plus existing flags like `harvestedOnce` and `loopClosedCount`). The current step is highlighted, finished steps get crossed out. It rendered as **"The Plan"** at the top of Stone's dashboard panel.

(This step also produced the session's one caching bug: the new script loaded but the browser had cached the old `stone.js`, so the checklist silently failed to appear until the `<script>` tags were given `?v=` cache-busting query strings — now bumped on every subsequent change.)

With the checklist in place, the intended 12-day arc could finally be stated plainly: **Days 1–2** scrounge bottles and get the grid live; **Days 3–4**, as layoffs cut the daily stamina budget, build out the production chain; **Days 5–6**, racing the SNAP-cut deadline, get the first harvest in; **Days 7–8**, close the loop right as delivery isolation halves dump yields, forcing real self-reliance; **Days 9–12**, with surplus stamina, turn outward and organize the block. Each crisis stage is timed to remove exactly the crutch the previous phase depended on.

## 6. Art direction: from a painted poster to a spec to real sprites

Andrew then shared the actual FarmBotVille pitch poster art (**"FARMBOTVILLE: Seedfolks"**) and asked for the game to look like it — full design system, sprite list, and machine assets.

The first version of this plan (written and approved) was **spec-only**: rather than fake painted-illustration quality with placeholder art, the deliverable was a complete, commission-ready `game/ART_SPEC.md` — style guide (palette hexes, isometric projection rules, top-left golden-hour lighting), technical rules (64px tile unit, exact anchor convention, `{asset}_{state}.png` naming), and a full 47-item asset table (terrain, all six machines with idle/running states, five Tyler poses, Stone the owl, both dump backdrops, UI glyphs) — meant to be handed to Makko.ai verbatim. Alongside it, `game/assets.js` and changes to every painter in `scene.js` built a **sprite pipeline**: every drawing routine now checks a sprite cache first and only falls back to its procedural greybox shape if the file isn't there. This was proven end-to-end by generating one throwaway test PNG, dropping it in `game/assets/`, confirming it rendered at the correct anchor in place of the greybox prism, then deleting it.

Andrew then changed course: **skip Makko, author the assets directly from the spec.** The loader was extended to try a PNG first, then an SVG, then the procedural fallback — so a future painted delivery from Makko would still transparently win if ever supplied. All **47 assets from the spec** were then generated as hand-authored vector SVGs, produced by a single Python generator script so every piece shares one palette, one 2:1 isometric projection, and one consistent light source: the neighborhood skyline and highway ring, the fenced lot, a pitched-roof house with rooftop solar and glowing windows, rain barrels, textured grass and paver tiles, two tree variants, all six machines with idle/running animation frames (a spinning filament spool, a shifting print head, a steam wisp), four FarmBot sprout-growth stages, five Tyler animation poses, a wing-flapping Stone owl, and the two dump backdrops — chaotic mounds versus the organized, labeled sorting bins that reward community tier 2.

Verifying this required solving the flaky-screenshot problem properly: a small local Python HTTP server was stood up on port 8899 specifically to receive `canvas.toBlob()` PNG uploads from the running page, which could then be read and inspected directly — a much more reliable loop than the built-in screenshot tool. That process caught one real bug (a status progress-bar was floating at the wrong height above taller sprites) which got fixed immediately.

## 7. Quality of life: one button to run every machine

Once several machines were placed, the natural next friction point was clicking through them individually every cycle. Andrew asked for a single button to load — "harvest" — every ready machine at once. `engine.js` gained `runAllMachines(state)`, which walks the machines in loop order (FarmBot and Composter first, since food matters most, then Polyformer and Printer), loads every idle one that has its inputs on hand, spends the usual 1 stamina each, and stops cleanly with a clear log line if stamina runs out partway through. A new **🔁 Do Rounds** button sits next to Sleep in the toolbar. It was tested three ways headlessly (loads everything affordable in one call; correctly reports nothing-to-do when idle; stops at exactly the right count when stamina is short) and then for real in the browser — built a genuine solar → wire → battery → Polyformer rig through actual toolbar clicks and the Tri-Path modal, confirmed Do Rounds correctly refused to load it once its build cost had eaten the bottles needed to run it, topped up via a real Dump Trip, and confirmed the second click loaded it without ever clicking the machine directly.

## 8. An infrastructure hiccup

Midway through implementing that last feature, the local dev server serving the game stopped responding at `localhost:8811`. Diagnosis ruled out a code problem first — `engine.js` and `app.js` both still parsed cleanly — and confirmed instead that the tracked preview server process had simply stopped (nothing was listening on port 8811, while the unrelated capture-upload helper on 8899 was still alive, so it wasn't a full environment wipe). The fix was a plain restart from the existing `.claude/launch.json` config, after which the in-progress Do Rounds feature was finished and verified as described above.

---

## 9. Where things stand

**Playable today:** a full 12-day survival loop in an isometric backyard. Power is physical and has to be wired. The dump is an off-screen gamble that gets better as you invest in the community. Six machines, three build-quality paths each, a live checklist telling you what's next, and a one-click way to run your whole setup once it exists. All of it rendered in first-party vector art matching the poster's palette and lighting, with a clean seam for painted art to replace any single asset later without touching code.

**File map (`game/` folder):**
| File | Role |
|---|---|
| `engine.js` | World state, tick/day clock, power networks, machines, crisis timeline, community tiers — no DOM, fully unit-testable |
| `scene.js` | Isometric canvas renderer; sprite-first with procedural fallback for every drawable |
| `stone.js` | Dashboard gauges, scripted advice, the live "Plan" checklist |
| `app.js` | Click-to-walk input, toolbar, Tri-Path modal, HUD rendering |
| `assets.js` | Sprite manifest + PNG→SVG→fallback loader |
| `assets/*.svg` | The 47-piece first-party art pack |
| `ART_SPEC.md` | Full commission sheet — still valid if painted art is ever added later |
| `index.html` / `style.css` | Page shell and dark-panel UI styling |

**Two standing project notes worth remembering:** don't trust "Built" status claims in the Drive docs without checking real code (see `project_macrochart_unverified.md` in memory), and the embedded preview tab throttles background timers — the game can look frozen there even though it's running fine; verify in a focused browser tab or via the canvas-upload method described in §6.

## 10. Character art v2: Tyler gets his canonical design

After the repo went up, Andrew produced a high-fidelity character turnaround for Tyler (`tyler-turnaround-orange-v2`) — curly high-top with faded sides, bright safety-orange bomber/hoodie over a charcoal tee, charcoal cargo pants, orange work boots, insulated gloves, a utility tool belt, and the Blackfox Studios fox mark on the hoodie back — plus a pose sheet (idle, walk loop, scavenge, engineer, share). Dropping illustration-grade art into a vector world would clash, so the agreed path was adaptation: rebuild Tyler as clean simplified vectors that keep every identity element.

A new generator (`gen_tyler.py`) produced eight sprites replacing the old five: the front set (idle, 2-frame walk, 2-frame engineer pose with a green "SYSTEM ONLINE" holographic panel) and a **new back set** (idle + 2-frame walk) carrying the fox mark. The turnaround's views map exactly as the production brief specified — front-¾ art is the SE facing, back-¾ art is the NW facing — and `scene.js` gained true **4-way facing**: it now tracks tile-movement direction and picks front vs. back art, mirroring horizontally for SW/NE. Verified via a 4× contact sheet of all eight sprites and in-game captures of both facings; the orange also fixed a longstanding readability niggle, since the old green hoodie used to blend into the grass.

## 11. The 8-direction Tyler

Andrew followed the pose sheet with a proper production-grade grid: 8 directions (N through NW) × idle + walk frames, in one consistent style — and an updated turnaround locking goggles and tan work boots into the canon. This solved the previous sheet's two weaknesses (inconsistent facing between rows, only two usable directions) and answered the isometric question cleanly: the four diagonal columns are true ¾ views, which is exactly what a 2:1 isometric character uses, and the game's tile movement only ever faces those four diagonals. No art modification was needed.

A grid-aware slicer with QA assertions (one figure per cell, height-outlier detection — guarding against the mis-slice failure seen in the Antigravity set) cut the sheet into 48 sprites: 8 idles and 5-frame walk loops per direction. One correction surfaced during verification: the sheet's direction labels were horizontally mirrored versus screen convention (its "SE" art walks down-left), confirmed by checking which way the boots point — fixed with a pure file-rename swap (se↔sw, ne↔nw, e↔w), art untouched.

Engine-side, the loader gained the 8-direction manifest and a `walkFrameCount()` helper so animation adapts to however many frames exist, and the renderer now prefers direction-specific art with **no mirroring at all** — the tool belt and back logo stay on their correct sides in every facing — falling back through the older 2-frame PNG set, then SVG, then procedural shapes. The fallback chain was regression-tested by deleting a direction's sprites at runtime and confirming the old art takes over without error.

**Not yet built, and explicitly out of scope for Sprint 2 per the jam's own rules:** the Class A/B/C build-quality depth beyond the current pass/fail reliability roll, the reputation/sales enterprise layer, and the neighborhood-adoption ending reveal — all correctly Sprint 3 scope per the project's own Macro Chart priority tags, once those tags are treated as a planning guide rather than a status report.
