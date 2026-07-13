/* Sprite pipeline. Mirrors ART_SPEC.md exactly: every entry here is a file the
 * artist can drop into game/assets/ to replace a greybox placeholder — no code
 * changes. Missing files are normal (we probe quietly); painters fall back.
 *
 * sprite(name)          -> Image or null
 * sprite(name, frame)   -> for 2-frame sets pass 0/1; falls back to frame 0.
 */

const SPRITE_MANIFEST = {
  // terrain & structures
  grass_a: "grass_a.png",
  grass_b: "grass_b.png",
  grass_worn: "grass_worn.png",
  paver: "paver.png",
  fence_n: "fence_n.png",
  fence_e: "fence_e.png",
  fence_corner: "fence_corner.png",
  gate_posts: "gate_posts.png",
  house: "house.png",
  barrels: "barrels.png",
  tree_a: "tree_a.png",
  tree_b: "tree_b.png",
  skyline: "skyline.png",
  dump_tier0: "dump_tier0.png",
  dump_tier2: "dump_tier2.png",

  // machines
  solar_idle: "solar_idle.png",
  solar_run_a: "solar_run_a.png",
  solar_run_b: "solar_run_b.png",
  battery_idle: "battery_idle.png",
  wire_straight: "wire_straight.png",
  wire_corner: "wire_corner.png",
  wire_t: "wire_t.png",
  polyformer_idle: "polyformer_idle.png",
  polyformer_run_a: "polyformer_run_a.png",
  polyformer_run_b: "polyformer_run_b.png",
  printer_idle: "printer_idle.png",
  printer_run_a: "printer_run_a.png",
  printer_run_b: "printer_run_b.png",
  farmbot_idle: "farmbot_idle.png",
  farmbot_run_a: "farmbot_run_a.png",
  farmbot_run_b: "farmbot_run_b.png",
  sprouts_0: "sprouts_0.png",
  sprouts_1: "sprouts_1.png",
  sprouts_2: "sprouts_2.png",
  sprouts_3: "sprouts_3.png",
  composter_idle: "composter_idle.png",
  composter_run_a: "composter_run_a.png",
  composter_run_b: "composter_run_b.png",

  // characters
  tyler_idle: "tyler_idle.png",
  tyler_walk_a: "tyler_walk_a.png",
  tyler_walk_b: "tyler_walk_b.png",
  tyler_work_a: "tyler_work_a.png",
  tyler_work_b: "tyler_work_b.png",
  tyler_back_idle: "tyler_back_idle.png",
  tyler_back_walk_a: "tyler_back_walk_a.png",
  tyler_back_walk_b: "tyler_back_walk_b.png",
  stone_a: "stone_a.png",
  stone_b: "stone_b.png",
  grandpa: "grandpa.png",
  grandma: "grandma.png",
};

// 8-direction Tyler set (per-direction art — no mirroring, so asymmetric
// details like the tool belt and fox logo stay on the correct side).
// Directions use screen convention: se = down-right, nw = up-left, etc.
const TYLER_DIRS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
TYLER_DIRS.forEach((d) => {
  SPRITE_MANIFEST["tyler_idle_" + d] = "tyler_idle_" + d + ".png";
  for (let f = 0; f < 6; f++) {
    SPRITE_MANIFEST["tyler_walk_" + d + "_" + f] = "tyler_walk_" + d + "_" + f + ".png";
  }
});

const _spriteCache = {}; // name -> Image (only successfully loaded ones)

(function loadSprites() {
  if (typeof Image === "undefined") return; // node / headless
  Object.entries(SPRITE_MANIFEST).forEach(([name, file]) => {
    // PNG (painted art) wins; SVG (first-party vector pack) is the fallback;
    // greybox drawing is the final fallback when neither exists.
    const png = new Image();
    png.onload = () => { _spriteCache[name] = png; };
    png.onerror = () => {
      const svg = new Image();
      svg.onload = () => { if (!_spriteCache[name]) _spriteCache[name] = svg; };
      svg.onerror = () => {}; // quiet
      svg.src = "assets/" + file.replace(/\.png$/, ".svg");
    };
    png.src = "assets/" + file;
  });
})();

function sprite(name, frame) {
  // 8-dir walk sets resolve "tyler_walk_{dir}" + numeric frame
  if (frame !== undefined && name.startsWith("tyler_walk_") ) {
    return _spriteCache[name + "_" + frame] || null;
  }
  if (frame === 1) {
    // 2-frame sets use _a/_b; allow sprite("tyler_walk", 1) style lookups
    const b = _spriteCache[name + "_b"];
    if (b) return b;
    const a = _spriteCache[name + "_a"];
    if (a) return a;
  } else if (frame === 0) {
    const a = _spriteCache[name + "_a"];
    if (a) return a;
  }
  return _spriteCache[name] || null;
}

/* Number of loaded walk frames for a direction (0 = no 8-dir set for it). */
function walkFrameCount(dir) {
  let n = 0;
  while (_spriteCache["tyler_walk_" + dir + "_" + n]) n++;
  return n;
}

/* Draw a sprite standing on the ground-line anchor of tile (x,y):
 * horizontally centered, bottom of image at the tile's ground contact.
 * Returns true if drawn; false means caller should draw its fallback. */
function drawSpriteOr(ctx, name, frame, x, y, fallbackFn, opts) {
  const img = sprite(name, frame);
  if (!img) { if (fallbackFn) fallbackFn(); return false; }
  const { sx, sy } = isoPt(x, y);
  const groundY = sy + TILE_H / 2 + (opts && opts.dy ? opts.dy : 0);
  const dx = sx - img.width / 2 + (opts && opts.dx ? opts.dx : 0);
  if (opts && opts.mirror) {
    ctx.save();
    ctx.translate(sx, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -img.width / 2, groundY - img.height);
    ctx.restore();
  } else {
    ctx.drawImage(img, dx, groundY - img.height);
  }
  return true;
}

if (typeof module !== "undefined") {
  module.exports = { SPRITE_MANIFEST, sprite, drawSpriteOr, walkFrameCount };
}
