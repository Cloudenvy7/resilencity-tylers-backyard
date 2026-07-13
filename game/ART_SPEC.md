# Resilencity: Tyler's Backyard — Art Specification (Makko Commission Sheet)

Blackfox Studios · Climate Jam 2026 · Sprint 3 art package
Contact: Andrew Powers · andrew@blackfoxstudios.org

This document is the complete, self-contained order sheet for the game's 2D art.
Every asset below drops into the running HTML5 build at a fixed anchor with **zero
code changes** — the engine already looks for these exact filenames in `game/assets/`.
Until a file exists, the game draws its greybox placeholder, so assets can be
delivered **incrementally, in any order**.

---

## 1. Style Guide

**World:** A real backyard in Des Moines, WA. Solarpunk × Afrofuturism × scrap-yard
science. Warm, hopeful, resourceful — never grim, even though the story is a crisis.
Reference the FarmBotVille one-sheet poster and the concept-art set (backyard at
golden hour: wooden fence, rain barrels, FarmBot gantry over raised beds, salvaged
solar panels; Tyler in a green hoodie with a tan work vest; Stone as a small
white-and-cyan robotic owl).

**Rendering rules:**
- **Projection:** isometric 2:1 (a ground tile is exactly twice as wide as tall).
- **Light:** warm golden-hour sun from the TOP-LEFT. South/east faces darker.
- **Legibility first:** a non-gamer must identify every machine at a glance
  (Mini Motorways clarity). Silhouette > surface detail.
- **Materials:** salvage aesthetic — visible screws, mixed panels, weathered wood,
  clean growing green against warm rust. Nothing looks factory-new except plants.

**Palette (use these hexes as the base; shade freely around them):**

| Role | Hex |
|---|---|
| Background near-black green | `#0c1410` |
| Leaf / accent green | `#7a9a4f` |
| Machine green | `#4a7c59` |
| Grass | `#59713b` |
| Power amber | `#f2c14e` |
| Sunset warm | `#c98a4b` |
| Rust | `#c1573a` |
| Wood light / dark | `#8a6a4a` / `#5a4632` |
| Soil | `#3f2e1d` |
| Solar blue | `#2f6db3` |
| Stone cyan | `#4ac2d8` |

## 2. Technical Rules

- **Format:** PNG with transparent background (SVG also accepted).
- **Base unit:** one ground tile = **64 × 32 px**. Deliver at 2× (128×64) if easier;
  we downscale.
- **Anchor:** unless noted, the sprite's anchor is the **center of the tile's ground
  diamond at the ground line** — i.e., horizontal center of the footprint, bottom of
  the sprite sits on the ground. Machines stand "on" the anchor; the code positions
  everything from it.

```
        ◇  ← tile diamond (64 wide, 32 tall)
      ◇ A ◇     A = anchor: sprite h-center, ground contact
        ◇
```

- **File naming:** exactly `{asset}_{state}.png`, lowercase, as listed below.
  Two-frame animations are `_a` / `_b` pairs.
- **States drawn by code (do NOT bake in):** the ⚡ no-power badge, progress bars,
  battery charge fill, night tint, powered-wire amber glow, selection highlights.

## 3. Asset List

### 3.1 Terrain & structures

| File(s) | Size (px) | Notes |
|---|---|---|
| `grass_a.png`, `grass_b.png` | 64×32 | two subtle grass diamond variants |
| `grass_worn.png` | 64×32 | trampled variant for high-traffic look |
| `paver.png` | 64×32 | stone paver diamond (path to the gate) |
| `fence_n.png` | 64×54 | fence run along a north-edge tile (planks + 2 rails) |
| `fence_e.png` | 64×54 | fence run along an east-edge tile |
| `fence_corner.png` | 64×54 | corner post |
| `gate_posts.png` | 64×60 | two taller posts framing the gate opening |
| `house.png` | 288×190 | 4×2-tile house: pitched roof, rooftop solar panel, porch door on the east side, windows (leave glass mid-tone; code adds glow). Anchor = center of footprint, ground line. |
| `barrels.png` | 64×58 | trio of blue rain barrels + downspout |
| `tree_a.png`, `tree_b.png` | 64×80 | round-canopy yard trees |
| `skyline.png` | 960×90 | background strip: neighborhood rooftops + hint of the highway ring ("contained, but not defeated"). Day version; code tints night. |
| `dump_tier0.png` | 200×120 | off-lot backdrop: chaotic waste mounds |
| `dump_tier2.png` | 200×120 | same spot organized: 4 labeled bins — METAL, PLASTICS, GLASS, ORGANICS ("SORT IT RIGHT!") |

### 3.2 Machines

All machines: **64-px-wide footprint**, states = `_idle` + `_run_a`/`_run_b`
(2-frame work loop). Keep the listed animated element the only thing that moves
between frames.

| File base | Size | Animated element |
|---|---|---|
| `solar` | 64×48 | salvaged tilted panel; frame b = sun glint. States: `solar_idle.png`, `solar_run_a.png`, `solar_run_b.png` (run = generating) |
| `battery` | 64×56 | stacked salvaged cells; leave a clear vertical charge window (code fills it). Idle only: `battery_idle.png` |
| `wire_straight.png`, `wire_corner.png`, `wire_t.png` | 64×32 | ground conduit segments, neutral gray (code tints amber when powered) |
| `polyformer` | 64×78 | hopper + extruder + filament spool; spool rotates between frames |
| `printer` | 64×74 | open-frame 3D printer; print head shifts between frames |
| `farmbot` | 64×70 | raised wooden bed + gantry rails + tool head; tool head shifts. PLUS sprout overlays: `sprouts_0.png` … `sprouts_3.png` (64×24, drawn by code onto the bed as crops grow) |
| `composter` | 64×62 | slatted wooden box; frame b adds a steam wisp |

### 3.3 Characters

| File(s) | Size | Notes |
|---|---|---|
| `tyler_idle.png` | 40×70 | Tyler King, 15 — **canonical design per the tyler-turnaround-orange-v2 sheet**: curly high-top hair w/ faded sides, bright safety-orange bomber/hoodie (open zip over charcoal tee), charcoal cargo pants, orange work boots, insulated dark gloves, utility tool belt (pouch + wrench + screwdriver legible at the hips). Front-¾ view = SE facing; code mirrors for SW. |
| `tyler_walk_a.png`, `tyler_walk_b.png` | 40×70 | walk cycle pair (front set) |
| `tyler_work_a.png`, `tyler_work_b.png` | 46×70 | engineer pose reaching toward the machine, with the green "SYSTEM ONLINE" holographic diagnostic panel cue |
| `tyler_back_idle.png` | 40×70 | back-¾ view = NW facing (code mirrors for NE). **Blackfox Studios fox mark on the hoodie back** — required. Hood hangs on shoulders. |
| `tyler_back_walk_a.png`, `tyler_back_walk_b.png` | 40×70 | back walk cycle pair |
| `stone_a.png`, `stone_b.png` | 24×24 | Stone: small white robotic owl, cyan eyes, wings slightly different per frame (hover) |
| `grandpa.png`, `grandma.png` | 30×56 | optional porch flavor, static |

### 3.4 UI glyphs (20×20, single color OK — used on dark panels)

`icon_wire.png`, `icon_solar.png`, `icon_battery.png`, `icon_polyformer.png`,
`icon_printer.png`, `icon_farmbot.png`, `icon_composter.png`, `icon_dumptrip.png`
(basket), `icon_share.png` (hands/plate), `icon_sleep.png` (moon),
`logo_leafgear.png` (leaf-in-gear mark, 48×48).

## 4. Priority Order (deliver in this order if batching)

1. **Tyler (all 5 frames) + `farmbot` + `sprouts_0–3`** — the player and the payoff.
2. **Machines:** `polyformer`, `printer`, `battery`, `solar`, `composter`, wires.
3. **Lot:** `house`, fence set, `barrels`, grass/paver, trees.
4. **Dump backdrops** (`dump_tier0`, `dump_tier2`) — the community-arc reveal.
5. **Stone, skyline, UI glyphs, grandparents.**

## 5. Delivery

Drop files into `game/assets/` (or send a zip; we place them). Any correctly named
file replaces its greybox placeholder on the next page load — no code work needed.
Questions → andrew@blackfoxstudios.org.
